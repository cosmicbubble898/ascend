# Ascend's first feature: local English audio transcription

**Status:** Approved and locally implemented on 2026-09-05, following "Please build this. I want to use it today only." Evidence and limitations: `docs/reviews/LOCAL-TRANSCRIPTION-2026-09-05.md`.

## What the user gets

Open Ascend, choose a local English recording, select **Transcribe**, see progress, and save the resulting text. Support audio up to **2:00:00 inclusive**. Processing uses NVIDIA Parakeet on this computer. No account, API key, internet service, summary, translation, or speaker identification is required.

Supported formats: WAV, MP3, M4A/AAC, FLAC, and MP4 recordings; mono or stereo, 8–192 kHz, one audio stream, at most 16 GiB per file. MP4 video tracks are ignored; only the audio is decoded in memory through the existing MOV/MP4 decoder. The language is fixed to English. This is an English model, not a reliable language detector: the UI must not claim it can certify that every input is English.

**2026-09-05 picker correction:** The owner reported being unable to select recordings in Telegram Desktop. That folder contains MP4 files, omitted by the chooser. Enable `.mp4` (case-insensitive, including paths with spaces) in both the native filter and source validation. Keep the existing decoder, duration/size limits, single-audio-track requirement, network denial and no-temporary-audio contract. Acceptance: a real MP4 containing video and public English audio completes transcription/export in Electron; video-only MP4 fails visibly. No new dependency or permission is required.

The user-facing controls are **Choose recording**, **Transcribe**, **Cancel**, **Save transcript (.txt)**, and **Clear**. Show filename, duration when known, processed audio time, and job state. Transcript text is selectable and displayed as text only. Progress must not show 100% or enable a normal complete export until decoding and transcription both finish. A canceled/failed job may expose completed text only through an explicitly labelled **Save partial transcript** action.

## Sentence-aligned paragraphs — requested 2026-09-05

The owner requested readable paragraphs of approximately 30 seconds without an LLM. Use the existing Parakeet token timestamps and recognized punctuation: from the first word of a paragraph, wait until roughly 30 seconds of recording time has elapsed, then break after the next sentence-ending full stop, question mark or exclamation mark. The next recognized word starts a new paragraph, separated by one blank line. A sentence may cross an inference window; that boundary alone must not split the displayed sentence. Longer unpunctuated sentences remain intact, so 30 seconds is a target, not a hard maximum. The final unfinished sentence remains visible/exportable, including on cancellation.

Common abbreviations, initials/acronyms, internal decimal points and ellipses are conservatively excluded from full-stop boundaries. Closing quotation marks/brackets remain attached. This is deterministic punctuation handling, not linguistic certainty or speaker/topic detection. It inserts whitespace only: recognized words, punctuation, order and repetition remain unchanged. No cloud call, LLM, dependency, automatic content persistence or model change is introduced. The previously observed recognition/chunk-edge omissions are a separate issue and are not claimed fixed by formatting.

Keep timing and formatting in the Python transcription worker. Each progress `text` value is an append-only fragment including its required joining whitespace; the main process concatenates it exactly. The existing text-only renderer preserves blank lines and the native TXT export preserves the same paragraphs. Clear/restart creates a fresh formatter. Validate with timed synthetic sentences spanning windows, punctuation edge cases, final/partial output, repeated words and plain-text export; then run public audio through the real GPU/Electron path and compare whitespace-normalized output against the saved test transcription. An already-open owner session must be preserved; reopening loads the updated shell.

## Delivery order and scope

This is the founder's first usable Ascend feature, ahead of account bootstrap. Keep the existing Electron/TypeScript shell and Python engine ownership. Implement a stateless transcription entry point in a separate Python worker environment; do not introduce a web app, UI framework, database table, provider gateway, or general agent platform.

The shell owns native file selection, one in-memory job, progress presentation, and explicit export. Python owns decoding, chunking, Parakeet inference, and the transcript. Use inherited private process pipes with bounded messages; no HTTP server or listening port. Validate the renderer sender and every preload message. The renderer receives an opaque job/file token, not authority to submit arbitrary filesystem paths.

OD-21 remains pending for persistent account/bootstrap work but is not a dependency of this stateless feature. This specification proposes only the concrete runtime separation needed here; it does not approve all of OD-18 or change other future-feature gates. Habit/productivity improvement remains Ascend's overall leading purpose; this transcription tool is the user's immediate delivery priority.

## Sensitive-data contract

1. Open the user-selected existing file read-only. Do not upload, copy, cache, rename, delete, or modify the source. The worker receives only the approved file capability and fixed model assets; it receives no database, credentials, provider grants, general shell execution, or unrelated input paths.
2. Decode incrementally into bounded memory buffers. No plaintext WAV chunks, transcript cache, history database, session recovery file, persistent job state, or debug dump. Original audio remains in the location chosen by the user.
3. Transcript exists in worker/main/renderer memory until **Save**, **Clear**, window close, or process exit. Clear and terminal shutdown release references and terminate the worker. Do not claim cryptographically guaranteed zeroization of managed memory or protection from Windows paging, hibernation, crash dumps, or same-user malware.
4. Saving is a deliberate UTF-8 text export through the native Save dialog. Never overwrite the selected source. Existing export targets use the normal overwrite confirmation. Explicitly saving into a synchronized folder can cause that folder's software to sync it; Ascend itself makes no network upload and does not describe exported files as encrypted.
5. Logs use fixed error codes, timings, and numerical resource information only. Do not log filenames/paths, audio, transcripts, metadata, native exception text, or IPC payloads. Do not start Electron crash reporting or diagnostic uploads.
6. Runtime loading uses verified local assets only. Do not install the Hugging Face client, provider SDKs, telemetry packages, or a cloud fallback. Reject missing/changed assets before opening the recording. Runtime download APIs are unavailable to the processing worker. The renderer keeps `connect-src 'none'`; external requests are blocked in its session.
7. Runtime tests must demonstrate successful transcription while outbound access is denied, and monitor for attempted outbound connections. A Python socket mock alone is insufficient evidence for native decoder/runtime behavior. No whole-machine networking change is made without authorization. A separate process is isolation for reliability, not proof of an OS sandbox; document the actual enforcement and limitations before sensitive-data use.

**Approved OD-03 exception:** After the public/synthetic acceptance checks and privacy review pass, this feature may process files explicitly selected by the owner without first implementing an encrypted Ascend vault, because it creates no automatic content persistence. This does not permit unencrypted histories, app-owned audio files, meeting capture, activity tracking, recovery caches, or other real-data storage. Those still require the existing encryption gate. Approval of this document explicitly decides this narrow exception; it is not inferred from an offline-processing claim.

## Two-hour processing and failure behavior

- One job and one model instance at a time; a second start returns `busy`. Preflight checks local regular-file access, allowed container/codec, channel/rate limits, size, and known duration. Refuse URLs, network shares, playlists, external media references, encrypted/DRM media, multiple audio tracks, unsupported formats, and files with no audio stream. Broker a read-only file handle/file object to the decoder, never a URL string from the renderer.
- PyAV decodes/resamples incrementally to 16 kHz mono float32. Reject nonfinite samples and invalid metadata. Count actual decoded samples, not just container metadata. More than **115,200,000 samples** (7,200 seconds at 16 kHz) fails visibly; never silently truncate and label the result complete. Unknown-duration files remain bounded by the same decoded count.
- Cap each inference window at **30 seconds**, with context across boundaries. Prefer nearby quiet boundaries; retain overlap when a boundary crosses speech. Use Parakeet token timestamps to reconcile overlapping regions in chronological order. Do not remove duplicate words by global string replacement, since legitimate repetition must survive. Boundary tests and public audio determine whether this is acceptable before declaring completion.
- Keep only the current/look-ahead audio windows plus the transcript in memory. Target an 8 GiB worker RAM ceiling and one CUDA arena capped initially at 5 GiB on the owner's 8 GiB RTX 4060. The CUDA arena setting is not a cap on total process GPU memory; measure real peaks during the long-file proof.
- Load the model from the pinned bundle and perform a synthetic warm-up before opening user audio. Require a working CUDA session; show `gpu_unavailable` if it cannot initialize. Do not silently switch to CPU, another model, a hosted NVIDIA API, or another service. CPU-side preprocessing/supported helper operations are distinct from replacing Parakeet GPU inference.
- Cancellation must remain responsive during decoding/inference: stop scheduling work, request worker exit, and terminate the owned process after a 5-second grace period. Closing Ascend ends the job and leaves no worker. No automatic retry or transcription after restart.
- Use bounded watchdogs: 180 seconds for model readiness, 120 seconds without progress on a chunk, and a four-hour total job ceiling. Timeouts return a typed failure and preserve only already-completed in-memory text for optional partial export. Show explicit invalid-file, too-long, decode-failed, GPU-unavailable, out-of-memory, canceled, and worker-failed states.
- Empty/silent audio produces a visible **No speech detected** result when no text is recognized. Do not promise perfect accuracy or invent summaries/cleaned-up wording; save the model transcription.

## Approved installed runtime and model

Use the existing CPython **3.13.14 x64** in a separate worker environment. The main Ascend Python environment and its lockfile stay separate.

| Direct package                         | Version | Purpose                                                       |
| -------------------------------------- | ------- | ------------------------------------------------------------- |
| onnx-asr                               | 0.12.0  | Parakeet loading, inference, timestamps                       |
| onnxruntime-gpu with cuda/cudnn extras | 1.29.0  | CUDA inference and matching runtime DLLs                      |
| numpy                                  | 2.5.2   | Bounded numerical audio buffers                               |
| av                                     | 18.1.0  | Local decoding and resampling; its wheel bundles FFmpeg 8.1.2 |

The exact 14-package dependency resolution and artifact hashes are in `docs/proposals/parakeet-worker-requirements.lock`, generated for Windows x64/Python 3.13 using the existing uv tool. Compatible Windows/universal wheels were identified for all 14 packages. All 14 locked packages are installed, and the actual CUDA/Windows AppContainer path passed short and two-hour public/synthetic tests. ONNX Runtime 1.29 uses CUDA 13, so the old CUDA 12 setup must not be copied blindly. Do not update the system GPU driver automatically.

Use **NVIDIA Parakeet TDT 0.6B v2**, the English model previously used by the owner, via the maintained `istupakov/parakeet-tdt-0.6b-v2-onnx` conversion. Pin revision `0bbb45a3365852604aef28b538a8f066f4ccaa85` and full-precision assets from `docs/proposals/parakeet-model-manifest.json`. This conversion is third-party, not an NVIDIA-published ONNX export. Do not load Python code or custom operators from a model repository. Validate external tensor references against the manifest and permit only the pinned sibling data file.

Initial download is approximately **3.84 GB**: 2.51 GB of model assets plus 1.32 GB of selected worker wheels, excluding existing Python. Require 12 GiB free for installation, unpacking, and staging. Downloading model/runtime assets is an explicit setup operation before selecting a sensitive recording; it sends no audio or transcript. Verify byte counts and SHA-256 before activation, keep incomplete downloads outside the active bundle, and never treat an incomplete bundle as ready. Use fixed package/model origins, bounded redirects, and no arbitrary archive paths. No model download occurs during transcription.

License basis: onnx-asr MIT; Parakeet v2 and its conversion CC-BY-4.0; PyAV BSD with bundled FFmpeg obligations; NumPy's declared license set; ONNX Runtime MIT and NVIDIA runtime component terms. Preserve attribution/license files and review exact wheel notices before activation. This approval covers local development/use on this machine, not redistribution or installer publication.

## Small tasks and acceptance evidence

1. **P1 — isolated setup and CUDA proof:** install only the proposed locked worker dependencies and verified model assets; load from local paths and transcribe a public English fixture while network is denied. Report actual CUDA execution, memory peak, setup size, and failure behavior. No user recording is needed for this proof.
2. **P2 — bounded file pipeline:** Implement and verify duration/sample limits, decoder streaming, short/long/silent/corrupt inputs, chunk coverage, legitimate repeated words, and context at boundaries. Confirm cancellation and truthful partial results. No whole-file PCM accumulation.
3. **P3 — Ascend interface and supervision:** Implement and verify narrow IPC, native chooser/export, one-job state transitions, progress, cancel/close, stale job rejection, worker exit, and text-only rendering. Add the first transcription screen in the existing shell.
4. **P4 — full proof and privacy review:** run a complete two-hour public/synthetic English recording through the real GPU path, plus a two-hour-plus-one-sample rejection. Verify first/middle/final speech, chunk joins, bounded memory, responsive cancellation, no orphan process, no unintended content writes/logs, and no attempted network calls. Re-run relevant Python/TypeScript tests, lint, formatting, type checks, and build. Review code/security before making sensitive-file use available.

The two-hour support claim requires P4's real end-to-end evidence; the old short-clip benchmark and unit tests alone are insufficient. If dependencies or runtime isolation fail their proof, report the exact failure and amend the concrete choice; do not conceal it with fallback behavior.

## Official / maintainer sources checked 2026-09-05

- [NVIDIA Parakeet v2 model card](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2): English scope and model license.
- [onnx-asr usage](https://istupakov.github.io/onnx-asr/usage/): array input, timestamps, local paths, and long-audio considerations.
- [ONNX Runtime CUDA requirements](https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html): CUDA 13 package baseline, cuDNN compatibility, DLL loading, and arena limits.
- [PyAV 18.1.0 release](https://github.com/PyAV-Org/PyAV/releases/tag/v18.1.0): packaged FFmpeg version and decoder changes.
- [Pinned ONNX conversion](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v2-onnx/tree/0bbb45a3365852604aef28b538a8f066f4ccaa85): file inventory, sizes, and LFS SHA-256 values.
- PyPI release metadata for the exact packages in the proposed lockfile: Windows wheel availability, dependency constraints, hashes, and declared licenses.

## Approval recorded

The founder approved P1–P4 as Ascend's first feature, the approximately 3.84 GB setup download and isolated locked runtime, the stateless process/IPC design, and the narrow OD-03 session-only exception. Build and verify with public/synthetic audio first; owner-selected sensitive audio is allowed only after the acceptance and privacy checks pass. Persistent histories, encrypted-vault work, other feature runtimes, provider connections, and public distribution remain outside this approval.
