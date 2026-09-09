import { describe, expect, it } from "vitest";
import { TranscriptionState } from "./transcription-state.js";

describe("transcription session", () => {
  it("preserves formatted worker fragments exactly in partial and complete text", () => {
    const state = new TranscriptionState();
    state.select({ name: "public.wav", bytes: 1, token: "one" });
    state.start("one");
    state.accept({ type: "ready", backend: "CUDA" });
    state.accept({ type: "progress", seconds: 28, text: "First paragraph." });
    state.accept({ type: "progress", seconds: 55, text: "\n\nNext sentence" });
    state.accept({ type: "progress", seconds: 65, text: " continues." });
    expect(state.snapshot().text).toBe(
      "First paragraph.\n\nNext sentence continues.",
    );
    state.cancel();
    state.canceled();
    expect(state.snapshot().text).toBe(
      "First paragraph.\n\nNext sentence continues.",
    );
    state.start("one");
    state.accept({ type: "ready", backend: "CUDA" });
    state.accept({ type: "progress", seconds: 5, text: "A fresh start." });
    state.accept({ type: "complete", seconds: 5 });
    expect(state.snapshot().text).toBe("A fresh start.");
  });
  it("does not report complete from progress and rejects nonfinite or regressing time", () => {
    const state = new TranscriptionState();
    state.select({ name: "public.wav", bytes: 1, token: "one" });
    state.start("one");
    state.accept({ type: "ready", backend: "CUDA" });
    state.accept({ type: "progress", seconds: 7200, text: "Final words." });
    expect(state.snapshot().stage).toBe("running");
    for (const seconds of [NaN, Infinity, -1, 7199, 7201]) {
      expect(() => {
        state.accept({ type: "complete", seconds });
      }).toThrow("worker_failed");
    }
    state.accept({ type: "complete", seconds: 7200 });
    expect(state.snapshot().stage).toBe("complete");
  });
  it("redacts unknown errors and ignores old worker events after clear", () => {
    const state = new TranscriptionState();
    state.select({ name: "public.wav", bytes: 1, token: "one" });
    state.start("one");
    state.accept({ type: "error", code: "C:\\private\\recording.wav" });
    expect(state.snapshot().error).toBe("worker_failed");
    state.clear();
    state.accept({ type: "progress", seconds: 12, text: "old transcript" });
    expect(state.snapshot().text).toBe("");
  });
  it("rejects stale starts and retains partial text on cancellation", () => {
    const state = new TranscriptionState();
    state.select({ name: "meeting.wav", bytes: 100, token: "current" });
    expect(() => {
      state.start("stale");
    }).toThrow("invalid_selection");
    state.start("current");
    expect(() => {
      state.start("current");
    }).toThrow("busy");
    state.accept({
      type: "ready",
      backend: "CUDA",
      model: "Parakeet TDT 0.6B v2",
    });
    state.accept({ type: "progress", seconds: 28, text: "A useful thought." });
    state.cancel();
    state.accept({ type: "complete", seconds: 28 });
    expect(state.snapshot().stage).toBe("canceling");
    state.canceled();
    expect(state.snapshot().text).toBe("A useful thought.");
    state.clear();
    expect(state.snapshot().text).toBe("");
    expect(state.snapshot().file).toBeNull();
  });
});
