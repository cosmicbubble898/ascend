# Recovered Local Productivity Agent / Parakeet context

**Verified:** 2026-09-05. File and documentation search only; no old application was launched, dependencies installed, or audio transcribed.

## Main finding

The requested predecessor exists. Its GPU transcription code selects `nemo-parakeet-tdt-0.6b-v2` through `onnx_asr`, with ONNX Runtime's CUDA provider. Ascend explicitly lists this project and its benchmark folder as historical donor sources. This is actual source code and recorded experiments, not merely a future-model mention.

## Where the files are

| Location | Contents and meaning |
| --- | --- |
| [Original staging project](C:/Users/samar/local-productivity-agent) | Python voice/dictation application, model picker, GPU worker, tests, ADRs, and session notes |
| [GPU worker](C:/Users/samar/local-productivity-agent/worker/gpu_transcribe_server.py:49) | Exact Parakeet v2 model selection, CUDA provider, 5 GiB arena cap, local HTTP service |
| [Parakeet experiments](C:/Users/samar/parakeet-test) | Test scripts, CUDA diagnostics, public JFK audio fixtures, historical benchmark output |
| [Later LPA v1](C:/Users/samar/lpa-v1) | Separate Electron/Python release project; README explicitly describes cloud-first transcription plus an offline CPU tier, without GPU |
| [Desktop history](C:/Users/samar/Desktop/Ascend-Project-History) | Copies of staging, LPA v1, Parakeet experiments, and Ascend handover |
| [D: staging source backup](D:/C-Backup-2026-08-13-FINAL/USER-PROFILE-FULL/local-productivity-agent) | Preserved original source tree |
| [D: experiment backup](D:/C-Backup-2026-08-13-FINAL/USER-PROFILE-FULL/parakeet-test) | Preserved benchmark folder |
| [D: v1 source backup](D:/C-Backup-2026-08-13-FINAL/USER-PROFILE-FULL/lpa-v1) | Preserved separate release source |
| [D: staging application data](<D:/Backup/Apps/LocalProductivityAgent (Staging)>) | Historical local data and llama.cpp files; not a recovered Parakeet installation |
| [D: v1 application data](<D:/C-Backup-2026-08-13-FINAL/USER-PROFILE-FULL/AppData/Local/LocalProductivityAgent (v1)>) | Historical profile, logs, models, and local storage |

The GPU worker is byte-identical in the original C: source, Desktop history, and D: source backup: SHA-256 `11D7E8244A88B13D576C56C5EB2780EF5F3AC669ACE8311BBC7EC4C80135B155`. It is 5,285 bytes, last modified June 11, 2026. The original repository's latest commit is `4238acd`, August 11, a pre-reinstall backup commit; that date is not a new GPU implementation date.

## What was previously built

- A separate worker serves Parakeet and Whisper-GPU on `127.0.0.1:8765`; the main app uses `WorkerClient` in `core/transcriber.py`. Input is 16 kHz mono PCM. This process boundary was intended to isolate CUDA/NumPy dependencies from the main application.
- [ADR-0007](C:/Users/samar/local-productivity-agent/docs/adr/ADR-0007-transcription-engines.md) and the May 30 session describe the original work. A June 1 correction explicitly restores Parakeet and Whisper-GPU to the owner's staging app after an unwanted removal. The separate v1 release has a different CPU/cloud scope.
- [Historical benchmark output](C:/Users/samar/parakeet-test/out.txt) records average times of approximately 0.071, 0.189, and 0.346 seconds for the 10-, 30-, and 60-second test clips. These are old warm-run measurements, not a fresh speed or accuracy guarantee.
- [May 31 session](C:/Users/samar/local-productivity-agent/docs/session-log/SESSION-2026-05-31.md:39) records repeated long-clip slowdown from GPU memory pressure and a 5 GiB arena cap. The current recovered worker retains that cap. Other notes record missing CUDA DLLs and unintended CPU fallback.
- The launcher's current command uses staging's `.venv`, whereas the original isolation design names `parakeet-test\.venv`. This discrepancy needs resolving when restoring the runtime.

## Current readiness

The current machine detects an NVIDIA GeForce RTX 4060 Laptop GPU with 8,188 MiB memory and driver 610.88. Neither expected `.venv\Scripts\python.exe` exists in the C: source/experiment folders or their D: source backups. The expected Hugging Face cache is also absent in both user-profile locations. No Parakeet model weights were identified in the searched file paths. Moonshine ONNX files found in LPA v1 are a different CPU model.

No listener was found on the old worker/app ports during inspection. Source recovery is confirmed; a working transcription runtime is not. The restored worker needs a fresh isolated environment, model availability checks, and a public-audio smoke test that verifies actual CUDA use. Its existing unauthenticated local HTTP endpoint and CPU fallback also need review before reuse in Ascend.

## Connection to Ascend

[Ascend's reference register](C:/Users/samar/Desktop/ascend/docs/REFERENCE-SOURCES.md:23) names staging, LPA v1, and Parakeet experiments. [The capability proposal](C:/Users/samar/Desktop/ascend/docs/FUTURE-CAPABILITY-ARCHITECTURE-PROPOSAL.md:59) explicitly refers to the historical Parakeet/ONNX worker and RTX 4060 evidence. Current Ascend does not yet implement that runtime.

## Search coverage

Recursive filename searches covered accessible C: and D: trees, including hidden files, Desktop histories, user profiles, and D: backups. Follow-up content searches found 261 matching Markdown/Python/TOML files across C:\Users and D:. Dependency trees, Git internals, generated caches, and conversation stores were excluded from content search. Protected filesystem areas were skipped when inaccessible. Archive filenames were searched; unrelated archives were not exhaustively unpacked. Credentials, databases, and private recordings were not opened.
