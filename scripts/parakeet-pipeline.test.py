"""Behavioral tests using only the approved decoder/numerical worker environment."""

import io
import sys
import unittest
import wave
from itertools import pairwise
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from ascend_engine.transcription.pipeline import decode_audio, windows
from ascend_engine.transcription.policy import AudioError


class PipelineTests(unittest.TestCase):
    def test_two_hours_plus_one_sample_is_rejected(self):
        path = Path(__file__).resolve().parents[1] / "runtime/parakeet-qa/too-long.wav"
        with path.open("rb") as source, self.assertRaisesRegex(AudioError, "too_long"):
            list(decode_audio(source, "wav", lambda _: None))

    def test_corrupt_file_and_playlist_fail_closed(self):
        for format_name in ["wav", "flac", "mp3", "mov", "aac", "m3u"]:
            with self.assertRaises(AudioError):
                list(
                    decode_audio(
                        io.BytesIO(b"#EXTM3U\nhttps://example.com/private.wav"),
                        format_name,
                        lambda _: None,
                    )
                )

    def test_missing_duration_still_uses_actual_decoded_sample_budget(self):
        # Keep the real decoder and resampler, but hide WAV duration as raw streams do.
        from unittest.mock import patch

        import av

        path = Path(__file__).resolve().parents[1] / "runtime/parakeet-qa/too-long.wav"

        class Stream:
            duration = None

            def __init__(self, original):
                self.codec_context = original.codec_context

        class Container:
            def __init__(self, original):
                self.original = original
                self.streams = type("Streams", (), {"audio": [Stream(original.streams.audio[0])]})()

            def __enter__(self):
                return self

            def __exit__(self, *args):
                self.original.close()

            def decode(self, _):
                return self.original.decode(self.original.streams.audio[0])

        real_open = av.open
        with (
            path.open("rb") as source,
            patch(
                "ascend_engine.transcription.pipeline.av.open",
                side_effect=lambda *args, **kwargs: Container(real_open(*args, **kwargs)),
            ),
            self.assertRaisesRegex(AudioError, "too_long"),
        ):
            for _ in decode_audio(source, "wav", lambda _: None):
                pass

    def test_real_mp3_aac_and_m4a_containers_decode(self):
        import av

        for container_name, codec, decoder_format in [
            ("mp3", "libmp3lame", "mp3"),
            ("adts", "aac", "aac"),
            ("ipod", "aac", "mov"),
        ]:
            with self.subTest(container=container_name):
                output = io.BytesIO()
                with av.open(output, "w", format=container_name) as container:
                    stream = container.add_stream(codec, rate=16000)
                    stream.layout = "mono"
                    for index in range(3):
                        frame = av.AudioFrame.from_ndarray(
                            np.zeros((1, 16000), dtype=np.float32), format="fltp", layout="mono"
                        )
                        frame.sample_rate = 16000
                        frame.pts = index * 16000
                        for packet in stream.encode(frame):
                            container.mux(packet)
                    for packet in stream.encode(None):
                        container.mux(packet)
                output.seek(0)
                count = sum(
                    len(block) for block in decode_audio(output, decoder_format, lambda _: None)
                )
                self.assertGreaterEqual(count, 3 * 16000)
                self.assertLess(count, 4 * 16000)

    @staticmethod
    def mp4_recording(include_audio):
        import av

        output = io.BytesIO()
        with av.open(output, "w", format="mp4") as container:
            video = container.add_stream("mpeg4", rate=1)
            video.width = video.height = 32
            video.pix_fmt = "yuv420p"
            audio = container.add_stream("aac", rate=16000) if include_audio else None
            if audio is not None:
                audio.layout = "mono"
            frame = av.VideoFrame.from_ndarray(np.zeros((32, 32, 3), dtype=np.uint8), "rgb24")
            frame.pts = 0
            for packet in video.encode(frame):
                container.mux(packet)
            for packet in video.encode(None):
                container.mux(packet)
            if audio is not None:
                frame = av.AudioFrame.from_ndarray(
                    np.zeros((1, 3 * 16000), dtype=np.float32), format="fltp", layout="mono"
                )
                frame.sample_rate = 16000
                frame.pts = 0
                for packet in audio.encode(frame):
                    container.mux(packet)
                for packet in audio.encode(None):
                    container.mux(packet)
        output.seek(0)
        return output

    def test_mp4_with_video_decodes_only_audio(self):
        import av

        output = self.mp4_recording(include_audio=True)
        with av.open(io.BytesIO(output.getvalue())) as container:
            self.assertEqual(len(container.streams.video), 1)
            self.assertEqual(len(container.streams.audio), 1)
        metadata = []
        count = sum(len(block) for block in decode_audio(output, "mov", metadata.append))
        self.assertAlmostEqual(metadata[0], 3.0)
        self.assertGreaterEqual(count, 3 * 16000)
        self.assertLess(count, 4 * 16000)

    def test_video_only_mp4_is_rejected(self):
        with self.assertRaisesRegex(AudioError, "invalid_file"):
            list(decode_audio(self.mp4_recording(include_audio=False), "mov", lambda _: None))

    def test_resamples_stereo_and_covers_every_sample_with_bounded_windows(self):
        pcm = np.zeros((60 * 48000 + 6, 2), dtype="<i2")
        pcm[48000:96000] = 2000
        output = io.BytesIO()
        with wave.open(output, "wb") as audio:
            audio.setnchannels(2)
            audio.setsampwidth(2)
            audio.setframerate(48000)
            audio.writeframes(pcm.tobytes())
        output.seek(0)
        metadata = []
        chunks = list(windows(decode_audio(output, "wav", metadata.append)))
        self.assertAlmostEqual(metadata[0], 60.000125)
        self.assertEqual(chunks[0].start, 0)
        self.assertEqual(chunks[-1].end, 60 * 16000 + 2)
        for previous, following in pairwise(chunks):
            self.assertEqual(previous.end, following.start)
        self.assertTrue(all(len(chunk.audio) <= 30 * 16000 for chunk in chunks))


if __name__ == "__main__":
    unittest.main()
