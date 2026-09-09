import type {
  SelectedAudio,
  TranscriptionSnapshot,
} from "../transcription-contract";

export const ERROR_CODES = new Set([
  "privacy_boundary",
  "invalid_file",
  "invalid_selection",
  "too_long",
  "decode_failed",
  "gpu_unavailable",
  "out_of_memory",
  "canceled",
  "worker_failed",
  "model_integrity",
  "sandbox_unavailable",
  "source_changed",
  "transcript_limit",
  "worker_timeout",
  "save_failed",
  "busy",
]);

export class TranscriptionState {
  private value: TranscriptionSnapshot = this.empty();
  private empty(): TranscriptionSnapshot {
    return {
      stage: "empty",
      file: null,
      duration: null,
      processed: 0,
      text: "",
      error: null,
    };
  }
  snapshot(): TranscriptionSnapshot {
    return structuredClone(this.value);
  }
  get active(): boolean {
    return ["loading", "running", "canceling"].includes(this.value.stage);
  }
  select(file: SelectedAudio): void {
    if (this.active) throw new Error("busy");
    this.value = { ...this.empty(), stage: "selected", file };
  }
  start(token: string): void {
    if (this.active) throw new Error("busy");
    if (this.value.file?.token !== token) throw new Error("invalid_selection");
    this.value = { ...this.empty(), file: this.value.file, stage: "loading" };
  }
  fail(code: string): void {
    this.value.stage = "error";
    this.value.error = ERROR_CODES.has(code) ? code : "worker_failed";
  }
  cancel(): void {
    if (this.active) this.value.stage = "canceling";
  }
  canceled(): void {
    this.value.stage = "canceled";
    this.value.error = null;
  }
  clear(): void {
    this.value = this.empty();
  }
  accept(input: unknown): void {
    if (!this.active || this.value.stage === "canceling") return;
    if (typeof input !== "object" || input === null)
      throw new Error("worker_failed");
    const message = input as Record<string, unknown>;
    if (message.type === "error") {
      this.fail(
        typeof message.code === "string" ? message.code : "worker_failed",
      );
      return;
    }
    if (
      message.type === "ready" &&
      this.value.stage === "loading" &&
      message.backend === "CUDA"
    ) {
      this.value.stage = "running";
      return;
    }
    if (this.value.stage !== "running") throw new Error("worker_failed");
    if (message.type === "metadata") {
      if (
        message.seconds !== null &&
        (typeof message.seconds !== "number" ||
          !Number.isFinite(message.seconds) ||
          message.seconds <= 0 ||
          message.seconds > 7200)
      ) {
        throw new Error("worker_failed");
      }
      this.value.duration = message.seconds;
      return;
    }
    if (
      typeof message.seconds !== "number" ||
      !Number.isFinite(message.seconds) ||
      message.seconds < this.value.processed ||
      message.seconds > 7200
    )
      throw new Error("worker_failed");
    if (
      message.type === "progress" &&
      typeof message.text === "string" &&
      message.text.length <= 65536
    ) {
      // The worker owns joining spaces and paragraph breaks, including across windows.
      const text = this.value.text + message.text;
      if (text.length > 2 * 1024 ** 2) throw new Error("transcript_limit");
      this.value.text = text;
      this.value.processed = message.seconds;
    } else if (
      message.type === "complete" &&
      message.seconds === this.value.processed &&
      message.seconds > 0
    ) {
      this.value.duration = message.seconds;
      this.value.stage = "complete";
    } else {
      throw new Error("worker_failed");
    }
  }
}
