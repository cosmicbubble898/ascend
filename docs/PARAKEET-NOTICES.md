# Parakeet local-use attribution and runtime notices

This development feature uses [NVIDIA Parakeet TDT 0.6B v2](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2), licensed CC-BY-4.0, through the [istupakov ONNX conversion](https://huggingface.co/istupakov/parakeet-tdt-0.6b-v2-onnx/tree/0bbb45a3365852604aef28b538a8f066f4ccaa85). The conversion is third-party; Ascend does not claim NVIDIA endorsement. Ascend downloads the pinned fp32 export without modifying its weights. Model hashes, revision and filenames are recorded in `docs/proposals/parakeet-model-manifest.json`. See the [CC-BY-4.0 license](https://creativecommons.org/licenses/by/4.0/).

The exact worker lock retains 14 package versions and artifact hashes. Installed wheel metadata/notices were inspected. Preserve the installed `*.dist-info/licenses/` directories and package notices:

- onnx-asr: MIT; ONNX Runtime: MIT plus bundled third-party notices.
- PyAV: BSD-3-Clause. Its wheel contains FFmpeg libraries with their own notices and redistribution obligations; PyAV's license alone does not cover all bundled libraries.
- NumPy: BSD-3-Clause, 0BSD, MIT, Zlib and CC0 components, with individual notices preserved by its wheel.
- FlatBuffers: Apache-2.0; packaging: Apache-2.0 or BSD-2-Clause; protobuf: BSD-3-Clause.
- NVIDIA CUDA/cuDNN/cuBLAS/cuFFT/cuRAND/NVRTC/nvJitLink components: the NVIDIA SDK/component license files retained in their installed distributions. These are proprietary terms, not MIT licenses.

This feature's approval covers use on the owner's local development machine. No installer, model redistribution or package publication was performed. A separate distribution/license review remains required before redistribution.

Public QA speech comes from the [OpenAI Whisper JFK test fixture](https://github.com/openai/whisper/blob/main/tests/jfk.flac). Generated repetitions, decoded fixtures and QA exports stay in the ignored runtime folder, never in a user's transcript history.
