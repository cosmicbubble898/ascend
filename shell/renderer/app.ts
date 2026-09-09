(() => {
  const element = (id: string): HTMLElement => {
    const result = document.getElementById(id);
    if (!result) throw new Error("interface_unavailable");
    return result;
  };
  const choose = element("choose") as HTMLButtonElement;
  const start = element("start") as HTMLButtonElement;
  const cancel = element("cancel") as HTMLButtonElement;
  const save = element("save") as HTMLButtonElement;
  const clear = element("clear") as HTMLButtonElement;
  const transcript = element("transcript");
  let token = "";
  const time = (seconds: number): string =>
    `${Math.floor(seconds / 3600) ? String(Math.floor(seconds / 3600)) + ":" : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
  const errors: Record<string, string> = {
    privacy_boundary:
      "Processing stopped because an operation breached the local privacy boundary.",
    too_long: "This recording is over 2 hours. Choose a shorter file.",
    invalid_file:
      "Choose WAV, MP3, M4A, AAC, FLAC or MP4 with one supported audio track.",
    decode_failed:
      "This recording could not be decoded. Try another file or format.",
    gpu_unavailable:
      "The NVIDIA GPU is unavailable. Close other GPU apps and try again.",
    model_integrity:
      "The local model is missing or changed. Run Ascend setup again.",
    sandbox_unavailable:
      "Windows could not start the private worker. Run Ascend setup again.",
    out_of_memory:
      "There is not enough memory. Close other apps and try again.",
    source_changed:
      "The source file changed while processing. Choose it again.",
    save_failed:
      "Could not save. Choose a writable .txt file different from your recording.",
    worker_timeout:
      "Processing stopped responding. You can save completed text and try again.",
  };
  const render: Parameters<typeof window.ascend.subscribe>[0] = (state) => {
    token = state.file?.token ?? "";
    const active = ["loading", "running", "canceling"].includes(state.stage);
    element("file-name").textContent =
      state.file?.name ?? "Start with a recording";
    element("file-detail").textContent = state.file
      ? `${(state.file.bytes / 1024 ** 2).toFixed(1)} MB${state.duration === null ? " · Local recording" : " · " + time(state.duration)}`
      : "Choose English audio or an MP4 video. Up to 2 hours, entirely local.";
    choose.disabled = active;
    choose.textContent = state.file
      ? "Choose another file"
      : "Choose recording +";
    start.disabled = !state.file || active;
    start.hidden = active;
    cancel.hidden = !active;
    cancel.disabled = state.stage === "canceling";
    cancel.textContent =
      state.stage === "canceling" ? "Stopping…" : "Cancel transcription";
    clear.disabled = state.stage === "empty";
    save.disabled = active || !state.text;
    save.textContent =
      !state.text || state.stage === "complete"
        ? "Save .txt ↓"
        : "Save partial .txt ↓";
    transcript.hidden = !state.text;
    element("empty-transcript").hidden = Boolean(state.text);
    const atBottom =
      transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight <
      60;
    transcript.textContent = state.text;
    if (atBottom) transcript.scrollTop = transcript.scrollHeight;
    element("word-count").textContent = state.text
      ? `${state.text.trim().split(/\s+/).length.toLocaleString()} words · Unsaved`
      : "Nothing is saved automatically";
    const labels = {
      empty: "Ready when you are",
      selected: "Ready to transcribe",
      loading: "Preparing model",
      running: "Transcribing locally",
      canceling: "Stopping",
      canceled: "Canceled · partial",
      complete: "Complete",
      error: "Needs attention",
    };
    element("result-badge").textContent = labels[state.stage];
    element("job-status").hidden = ["empty", "selected"].includes(state.stage);
    const status = element("status-text");
    status.classList.toggle("error", state.stage === "error");
    status.textContent =
      state.stage === "error"
        ? (errors[state.error ?? ""] ??
          "Transcription stopped. You can save completed text and try again.")
        : state.stage === "loading"
          ? "Preparing your local model. This can take a moment…"
          : state.stage === "complete"
            ? state.text
              ? "Finished. Your transcript is ready to save."
              : "No speech detected."
            : state.stage === "canceled"
              ? "Stopped. Any text shown is a partial transcript."
              : state.stage === "canceling"
                ? "Stopping the local worker…"
                : "Transcribing on your NVIDIA GPU…";
    element("elapsed").textContent = state.processed
      ? `${time(state.processed)}${state.duration === null ? " processed" : " / " + time(state.duration)}`
      : "";
    const fill = element("progress-fill");
    fill.classList.toggle(
      "loading",
      state.stage === "loading" ||
        (state.stage === "running" && state.duration === null),
    );
    fill.style.width = `${String(state.stage === "complete" ? 100 : state.duration ? Math.min(99, (state.processed / state.duration) * 100) : 0)}%`;
    if (fill.classList.contains("loading")) fill.style.width = "35%";
  };
  const action = (operation: () => Promise<unknown>): void => {
    void operation().catch(() => {
      element("status-text").textContent =
        "Ascend could not complete that action. Please try again.";
      element("job-status").hidden = false;
    });
  };
  choose.addEventListener("click", () => {
    action(() => window.ascend.choose());
  });
  start.addEventListener("click", () => {
    action(() => window.ascend.start(token));
  });
  cancel.addEventListener("click", () => {
    action(() => window.ascend.cancel());
  });
  clear.addEventListener("click", () => {
    action(() => window.ascend.clear());
  });
  save.addEventListener("click", () => {
    action(async () => {
      if (await window.ascend.save())
        element("word-count").textContent = "Transcript saved";
    });
  });
  window.ascend.subscribe(render);
  action(async () => {
    render(await window.ascend.state());
  });
})();
