"""EndoBot's loopback-only OmniVoice TTS and faster-whisper ASR service."""
from __future__ import annotations

import argparse
import asyncio
from contextlib import asynccontextmanager
import gc
import io
import logging
import os
from pathlib import Path
import re
import threading
import time

os.environ.setdefault("HF_HUB_DISABLE_TELEMETRY", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("HF_XET_CACHE", str(Path(__file__).resolve().parent / "models" / ".xet"))

import numpy as np
import soundfile as sf
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response
from huggingface_hub import snapshot_download
from pydantic import BaseModel, Field
import torch

HERE = Path(__file__).resolve().parent
MODEL_CACHE = HERE / "models"
OMNI_MODEL = "k2-fsa/OmniVoice"
OMNI_REVISION = "c5fdb5ccb189668d56333f77ba2629f4cd7535f4"
WHISPER_MODEL = "Systran/faster-whisper-small"
WHISPER_REVISION = "536b0662742c02347bc0e980a01041f333bce120"
MAX_AUDIO_BYTES = 8 * 1024 * 1024
MAX_AUDIO_SECONDS = 65
MAX_CPU_TEXT_CHARS = 300
CPU_TEXT_LIMIT_MESSAGE = "A voz na CPU aceita até 300 caracteres. Peça uma resposta mais curta para ouvir."
VOICE_ATTRIBUTES = "female, middle-aged, moderate pitch"
logger = logging.getLogger("endobot.voice")
logging.getLogger("httpx").setLevel(logging.WARNING)
state = {"status": "loading", "tts": "loading", "asr": "loading", "device": None}
tts_model = None
asr_model = None
generation_lock = threading.Lock()
transcription_lock = threading.Lock()


def apply_runtime_profile():
    cpu = state.get("device") == "cpu"
    threads = min(6, os.cpu_count() or 4) if cpu else 4
    torch.set_num_threads(threads)
    state.update(steps=8 if cpu else 16, threads=threads,
                 precision="float32" if cpu else "float16",
                 audioChunkDuration=60.0 if cpu else 8.0,
                 audioChunkThreshold=90.0 if cpu else 12.0,
                 maxTextChars=MAX_CPU_TEXT_CHARS if cpu else 6000)


def download_models(offline_first=False):
    MODEL_CACHE.mkdir(parents=True, exist_ok=True)
    def fetch_model(repo, revision, patterns, required):
        if offline_first:
            try:
                cached = snapshot_download(repo, revision=revision, cache_dir=str(MODEL_CACHE), local_files_only=True)
                if all((Path(cached) / filename).is_file() for filename in required):
                    return cached
            except Exception:
                pass
        return snapshot_download(repo, revision=revision, cache_dir=str(MODEL_CACHE), allow_patterns=patterns)

    omni_path = fetch_model(OMNI_MODEL, OMNI_REVISION,
        ["*.json", "*.jinja", "*.safetensors", "audio_tokenizer/*"],
        ["model.safetensors", "config.json", "tokenizer.json", "audio_tokenizer/model.safetensors"])
    whisper_path = fetch_model(WHISPER_MODEL, WHISPER_REVISION,
        ["*.json", "*.bin", "*.txt"], ["model.bin", "config.json", "tokenizer.json"])
    return omni_path, whisper_path


def load_models():
    global tts_model, asr_model
    try:
        from faster_whisper import WhisperModel
        from omnivoice import OmniVoice
        omni_path, whisper_path = download_models(offline_first=True)
        asr_model = WhisperModel(whisper_path, device="cpu", compute_type="int8", cpu_threads=4)
        state["asr"] = "ready"
        requested_device = os.getenv("OMNIVOICE_DEVICE", "auto").lower()
        device = "cpu"
        cpu_decoder = False
        if requested_device.startswith("cuda"):
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA requested but unavailable")
            device = requested_device
        elif requested_device == "auto" and torch.cuda.is_available():
            free_bytes, _ = torch.cuda.mem_get_info()
            # The main model needs ~2.45 GB; keep the audio decoder on CPU
            # when sharing an 8 GB GPU with the Qwen model and the desktop.
            if free_bytes >= 2.8 * 1024**3:
                device = "cuda:0"
                cpu_decoder = free_bytes < 4.3 * 1024**3
        elif requested_device not in {"auto", "cpu"}:
            raise RuntimeError("OMNIVOICE_DEVICE must be auto, cpu or cuda:0")
        logger.info("Loading official OmniVoice on %s", device)
        try:
            tts_model = OmniVoice.from_pretrained(
                omni_path, device_map="cpu" if cpu_decoder else device,
                dtype=torch.float16 if device.startswith("cuda") else torch.float32,
                attn_implementation="sdpa", load_asr=False,
            ).eval()
            if cpu_decoder:
                # OmniVoice explicitly transfers generated tokens to the audio
                # tokenizer's device. Move only the main model, avoiding a
                # temporary full-model GPU allocation during initialization.
                decoder = tts_model.audio_tokenizer
                tts_model.audio_tokenizer = None
                try:
                    tts_model.to(device)
                finally:
                    tts_model.audio_tokenizer = decoder
                logger.info("OmniVoice main model uses GPU; audio decoder uses CPU")
        except torch.cuda.OutOfMemoryError:
            if requested_device != "auto":
                raise
            logger.warning("GPU memory is insufficient; loading OmniVoice on CPU")
            tts_model = None
            gc.collect()
            torch.cuda.empty_cache()
            device = "cpu"
            tts_model = OmniVoice.from_pretrained(
                omni_path, device_map="cpu", dtype=torch.float32,
                attn_implementation="sdpa", load_asr=False,
            ).eval()
        state.update(status="ready", tts="ready", device=device,
                     decoderDevice=str(tts_model.audio_tokenizer.device))
        apply_runtime_profile()
        logger.info("OmniVoice and local Whisper are ready")
    except Exception as error:
        state.update(status="error", tts="error")
        # Do not log submitted speech, text, environment secrets or cloud keys.
        logger.exception("Local voice model loading failed (%s)", type(error).__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    loading = asyncio.create_task(asyncio.to_thread(load_models))
    yield
    if not loading.done():
        loading.cancel()


app = FastAPI(title="EndoBot local voice", lifespan=lifespan, docs_url=None, redoc_url=None)


@app.middleware("http")
async def local_only(request: Request, call_next):
    if request.client and request.client.host not in {"127.0.0.1", "::1"}:
        return JSONResponse({"error": "Local connections only"}, status_code=403)
    # This service is reached through the backend. Block direct browser submissions.
    if request.headers.get("origin"):
        return JSONResponse({"error": "Use the EndoBot backend"}, status_code=403)
    content_length = request.headers.get("content-length")
    if content_length and (not content_length.isdigit() or int(content_length) > MAX_AUDIO_BYTES + 65536):
        return JSONResponse({"error": "Request too large"}, status_code=413)
    return await call_next(request)


class SpeechRequest(BaseModel):
    input: str = Field(min_length=1, max_length=6000)
    language: str = Field(default="pt", min_length=2, max_length=12)


def normalize_text(text: str):
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"https?://\S+", "", text)
    text = re.sub(r"[*_`#<>]", "", text)
    text = re.sub(r"(?m)^\s*[-•]\s*", "", text)
    # Remove model inline controls; answers are spoken as plain text.
    text = re.sub(r"\[[^\]]{1,80}\]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def generate_speech(text: str, language: str = "pt"):
    if state["tts"] != "ready" or tts_model is None:
        raise HTTPException(503, "OmniVoice ainda está carregando ou não pôde iniciar.")
    if len(text) > int(state.get("maxTextChars", 6000)):
        raise HTTPException(413, CPU_TEXT_LIMIT_MESSAGE)
    if not generation_lock.acquire(blocking=False):
        raise HTTPException(429, "Uma fala já está sendo preparada. Aguarde.")
    try:
        spoken = normalize_text(text)
        if not spoken:
            raise HTTPException(400, "Informe uma resposta com texto para ouvir.")
        def run_generation():
            with torch.inference_mode():
                return tts_model.generate(
                    text=spoken, language_id=language.split("-")[0].lower(),
                    instruct=VOICE_ATTRIBUTES, speed=0.95, num_step=int(state.get("steps", 16)),
                    audio_chunk_duration=float(state.get("audioChunkDuration", 8.0)),
                    audio_chunk_threshold=float(state.get("audioChunkThreshold", 12.0)),
                )[0]
        try:
            audio = run_generation()
        except (torch.cuda.OutOfMemoryError, torch.AcceleratorError) as accelerator_error:
            if os.getenv("OMNIVOICE_DEVICE", "auto").lower() != "auto":
                raise
            logger.warning("OmniVoice GPU generation failed (%s); moving to CPU and retrying", type(accelerator_error).__name__)
            try:
                tts_model.to("cpu").float()
            except Exception as fallback_error:
                logger.error("OmniVoice CPU recovery failed (%s)", type(fallback_error).__name__)
                raise HTTPException(503, "A voz local falhou na GPU. Reinicie o EndoCare e tente novamente.") from fallback_error
            try:
                if torch.cuda.is_initialized():
                    torch.cuda.empty_cache()
            except Exception:
                logger.warning("CUDA cache cleanup failed after moving OmniVoice to CPU")
            state.update(device="cpu", decoderDevice="cpu")
            apply_runtime_profile()
            if len(spoken) > int(state["maxTextChars"]):
                raise HTTPException(413, CPU_TEXT_LIMIT_MESSAGE)
            audio = run_generation()
        output = io.BytesIO()
        sf.write(output, np.asarray(audio), int(tts_model.sampling_rate), format="WAV", subtype="PCM_16")
        return output.getvalue()
    except torch.cuda.OutOfMemoryError as error:
        torch.cuda.empty_cache()
        logger.warning("OmniVoice ran out of GPU memory; retry after freeing memory or use CPU")
        raise HTTPException(503, "Memória da GPU insuficiente para preparar a voz.") from error
    finally:
        try:
            if torch.cuda.is_initialized():
                # Also release cached CUDA allocations after a CPU fallback,
                # so Qwen can immediately use the shared GPU.
                torch.cuda.empty_cache()
        finally:
            generation_lock.release()


@app.get("/health")
def health():
    return {**state, "service": "endobot-local-voice", "provider": "omnivoice", "model": OMNI_MODEL,
            "voice": VOICE_ATTRIBUTES, "asrModel": WHISPER_MODEL, "asrDevice": "cpu", "port": 7862}


@app.post("/v1/audio/speech")
async def speech(payload: SpeechRequest):
    try:
        audio = await asyncio.to_thread(generate_speech, payload.input, payload.language)
        return Response(audio, media_type="audio/wav", headers={"Cache-Control": "no-store"})
    except HTTPException:
        raise
    except Exception as error:
        logger.error("OmniVoice synthesis failed (%s)", type(error).__name__)
        raise HTTPException(503, "Não foi possível preparar a voz do OmniVoice.") from error


def transcribe_audio(audio: bytes):
    from faster_whisper.audio import decode_audio
    if asr_model is None:
        raise HTTPException(503, "O reconhecimento de voz local ainda está carregando.")
    if not transcription_lock.acquire(blocking=False):
        raise HTTPException(429, "Uma gravação já está sendo reconhecida. Aguarde.")
    try:
        decoded = decode_audio(io.BytesIO(audio), sampling_rate=16000)
        if len(decoded) / 16000 > MAX_AUDIO_SECONDS:
            raise HTTPException(413, "A gravação deve ter no máximo um minuto.")
        if len(decoded) == 0:
            raise HTTPException(422, "A gravação está vazia.")
        segments, _ = asr_model.transcribe(
            decoded, language="pt", beam_size=5, vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500, "speech_pad_ms": 300},
            condition_on_previous_text=False,
        )
        return " ".join(segment.text.strip() for segment in segments).strip()
    finally:
        transcription_lock.release()


@app.post("/v1/audio/transcriptions")
async def transcription(file: UploadFile = File(...)):
    audio = await file.read(MAX_AUDIO_BYTES + 1)
    await file.close()
    if not audio or len(audio) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Envie uma gravação curta de até 8 MB.")
    try:
        text = await asyncio.to_thread(transcribe_audio, audio)
        if not text or len(text) > 700:
            raise HTTPException(422, "Não foi possível entender uma pergunta curta na gravação.")
        return {"text": text, "provider": "faster-whisper"}
    except HTTPException:
        raise
    except Exception as error:
        logger.error("Local speech recognition failed (%s)", type(error).__name__)
        raise HTTPException(422, "Não foi possível entender a gravação.") from error


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if args.download_only:
        download_models()
        print("Official OmniVoice and Whisper model files downloaded.")
    elif args.smoke_test:
        load_models()
        started = time.monotonic()
        audio = generate_speech("Olá. Estou aqui para acolher você e ajudar a organizar suas perguntas para a consulta.")
        (HERE / "omnivoice-test.wav").write_bytes(audio)
        print({"audioFile": str(HERE / "omnivoice-test.wav"), "seconds": round(time.monotonic()-started, 2),
               "device": state["device"], "transcript": transcribe_audio(audio)})
    else:
        import uvicorn
        (HERE / "server.pid").write_text(str(os.getpid()), encoding="ascii")
        try:
            uvicorn.run(app, host="127.0.0.1", port=7862, access_log=False)
        finally:
            (HERE / "server.pid").unlink(missing_ok=True)
