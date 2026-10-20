"""Tests for runtime resource limits without downloading or loading models."""
from unittest import TestCase, main
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
import server


class RuntimeLimits(TestCase):
    def setUp(self):
        self.previous_state = server.state.copy()
        self.previous_model = server.tts_model

    def tearDown(self):
        server.state.clear()
        server.state.update(self.previous_state)
        server.tts_model = self.previous_model

    @patch("server.torch.set_num_threads")
    def test_cpu_profile_limits_work_and_threads(self, set_threads):
        server.state.update(device="cpu")
        with patch("server.os.cpu_count", return_value=32):
            server.apply_runtime_profile()
        self.assertEqual(server.state["steps"], 8)
        self.assertEqual(server.state["precision"], "float32")
        self.assertEqual(server.state["maxTextChars"], 300)
        set_threads.assert_called_once_with(6)

    def test_cpu_rejects_large_reply_before_generation(self):
        model = MagicMock()
        server.tts_model = model
        server.state.update(tts="ready", device="cpu", maxTextChars=300)
        with self.assertRaises(HTTPException) as caught:
            server.generate_speech("a" * 301)
        self.assertEqual(caught.exception.status_code, 413)
        model.generate.assert_not_called()
        self.assertFalse(server.generation_lock.locked())

    @patch("server.torch.set_num_threads")
    @patch("server.torch.cuda.empty_cache")
    @patch("server.torch.cuda.is_initialized", return_value=True)
    def test_cuda_oom_applies_cpu_limit_before_retry(self, is_initialized, empty_cache, set_threads):
        model = MagicMock()
        model.generate.side_effect = server.torch.cuda.OutOfMemoryError("test allocation")
        model.to.return_value = model
        model.float.return_value = model
        server.tts_model = model
        server.state.update(tts="ready", device="cuda:0", maxTextChars=6000)
        with patch.dict("server.os.environ", {"OMNIVOICE_DEVICE": "auto"}):
            with self.assertRaises(HTTPException) as caught:
                server.generate_speech("a" * 301)
        self.assertEqual(caught.exception.status_code, 413)
        self.assertEqual(model.generate.call_count, 1)
        self.assertEqual(server.state["device"], "cpu")
        self.assertFalse(server.generation_lock.locked())
        self.assertEqual(empty_cache.call_count, 2)

    @patch("server.torch.set_num_threads")
    @patch("server.torch.cuda.empty_cache")
    @patch("server.torch.cuda.is_initialized", return_value=True)
    def test_cuda_accelerator_error_retries_short_speech_on_cpu(self, is_initialized, empty_cache, set_threads):
        model = MagicMock()
        model.generate.side_effect = [
            server.torch.AcceleratorError("simulated GPU failure"),
            [server.np.zeros(800, dtype=server.np.float32)],
        ]
        model.to.return_value = model
        model.float.return_value = model
        model.sampling_rate = 24_000
        server.tts_model = model
        server.state.update(tts="ready", device="cuda:0", maxTextChars=6000)
        with patch.dict("server.os.environ", {"OMNIVOICE_DEVICE": "auto"}):
            audio = server.generate_speech("Olá, estou ouvindo você.")
        self.assertEqual(audio[:4], b"RIFF")
        self.assertEqual(model.generate.call_count, 2)
        self.assertEqual(model.to.call_args.args, ("cpu",))
        self.assertEqual(server.state["device"], "cpu")
        self.assertFalse(server.generation_lock.locked())
        self.assertEqual(empty_cache.call_count, 2)


if __name__ == "__main__":
    main()
