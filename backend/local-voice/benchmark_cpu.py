"""Developer benchmark for the verified FP32 CPU fallback; never changes models."""
from difflib import SequenceMatcher
import json
import logging
import os
import sys
import unicodedata
import time

os.environ["OMNIVOICE_DEVICE"] = "cpu"
import numpy as np
import soundfile as sf
import torch
import server
sys.stdout.reconfigure(encoding="utf-8")

SHORT = "Olá. Estou aqui para acolher você e ajudar a organizar perguntas para a consulta."


def measure(name, text, steps=8):
    started = time.monotonic()
    torch.manual_seed(2026)
    with torch.inference_mode():
        audio = server.tts_model.generate(
            text=text, language_id="pt", instruct=server.VOICE_ATTRIBUTES, speed=0.95,
            num_step=steps, audio_chunk_duration=60.0, audio_chunk_threshold=90.0,
        )[0]
    elapsed = time.monotonic() - started
    path = server.HERE / (name + ".wav")
    sf.write(str(path), np.asarray(audio), 24000, subtype="PCM_16")
    # ASR checks the short sample; the voice route intentionally limits questions
    # to 700 characters, whereas synthesis permits longer answers.
    transcript = server.transcribe_audio(path.read_bytes()) if len(audio)/24000 <= server.MAX_AUDIO_SECONDS else None
    def normalized(value):
        return " ".join("".join(c for c in unicodedata.normalize("NFD", value.lower()) if c.isalpha() or c.isspace()).split())
    similarity = SequenceMatcher(None, normalized(text), normalized(transcript or "")).ratio()
    result = {"profile": name, "threads": torch.get_num_threads(), "steps": steps,
        "words": len(text.split()), "durationSeconds": round(len(audio)/24000, 2),
        "ttsSeconds": round(elapsed, 2), "transcript": transcript, "textSimilarity": round(similarity, 3), "file": str(path)}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return result


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    server.load_models()
    if server.state["status"] != "ready":
        raise RuntimeError("CPU model did not load")
    torch.set_num_threads(6)
    measure("cpu-fp32-8steps", SHORT)
