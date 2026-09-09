(() => {
  type Snapshot = Awaited<ReturnType<typeof window.productivity.request>>;
  type Command = Parameters<typeof window.productivity.request>[0];
  type WithoutPeriod<T> = T extends unknown
    ? Omit<T, "start" | "end" | "range">
    : never;
  type Action = WithoutPeriod<Command>;
  type Block = Snapshot["rows"][number];
  const required = <T extends HTMLElement>(
    id: string,
    constructor: new () => T,
  ): T => {
    const found = document.getElementById(id);
    if (!(found instanceof constructor))
      throw new Error("interface_unavailable");
    return found;
  };
  const element = (id: string): HTMLElement => required(id, HTMLElement);
  const input = (id: string): HTMLInputElement =>
    required(id, HTMLInputElement);
  const button = (id: string): HTMLButtonElement =>
    required(id, HTMLButtonElement);
  const select = (id: string): HTMLSelectElement =>
    required(id, HTMLSelectElement);
  const textarea = (id: string): HTMLTextAreaElement =>
    required(id, HTMLTextAreaElement);
  const dateInput = input("activity-date");
  const tracking = button("tracking-toggle");
  const settingsDialog = required("settings-dialog", HTMLDialogElement);
  const correctionDialog = required("correction-dialog", HTMLDialogElement);
  const deleteDialog = required("delete-dialog", HTMLDialogElement);
  let snapshot: Snapshot | undefined;
  let selected: Block | undefined;
  let busy = false;
  let engineUnavailable = false;
  let scheduled: Promise<boolean> = Promise.resolve(true);
  const dateString = (date: Date): string =>
    `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  dateInput.value = dateString(new Date());
  dateInput.max = dateInput.value;
  dateInput.min = dateString(new Date(Date.now() - 29 * 86400000));
  const duration = (ms: number): string => {
    if (ms > 0 && ms < 60000) return "<1m";
    const minutes = Math.floor(ms / 60000);
    return minutes >= 60
      ? `${String(Math.floor(minutes / 60))}h ${String(minutes % 60)}m`
      : `${String(minutes)}m`;
  };
  const friendlyApp = (app: string, title = ""): string =>
    app.toLowerCase() === "electron.exe" &&
    title.toLowerCase().startsWith("ascend")
      ? "Ascend app"
      : app.replace(/\.exe$/i, "");
  const clock = (ms: number): string =>
    new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const make = (tag: string, text = "", className = ""): HTMLElement => {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  };
  const period = (): { start: number; end: number } => {
    const first = new Date(dateInput.value + "T00:00:00");
    const next = new Date(first);
    next.setDate(next.getDate() + 1);
    return { start: first.getTime(), end: next.getTime() };
  };
  const error = (id: string, message: string): void => {
    element(id).textContent = message;
    element(id).hidden = !message;
  };
  const view = (
    name: "productivity" | "transcription" | "clipboard" | "settings",
  ): void => {
    for (const tab of [
      "productivity",
      "transcription",
      "clipboard",
      "settings",
    ] as const) {
      element(`${tab}-page`).hidden = tab !== name;
      element(`tab-${tab}`).classList.toggle("selected", tab === name);
      if (tab === name)
        element(`tab-${tab}`).setAttribute("aria-current", "page");
      else element(`tab-${tab}`).removeAttribute("aria-current");
    }
  };
  element("tab-productivity").addEventListener("click", () => {
    view("productivity");
  });
  element("tab-transcription").addEventListener("click", () => {
    view("transcription");
  });
  element("tab-clipboard").addEventListener("click", () => {
    view("clipboard");
  });
  element("tab-settings").addEventListener("click", () => {
    view("settings");
  });
  const applyZoom = async (action: "in" | "out" | "reset"): Promise<void> => {
    const percent = await window.ascendWindow.zoom(action);
    element("zoom-reset").textContent = `${String(percent)}%`;
  };
  element("zoom-out").addEventListener("click", () => void applyZoom("out"));
  element("zoom-reset").addEventListener(
    "click",
    () => void applyZoom("reset"),
  );
  element("zoom-in").addEventListener("click", () => void applyZoom("in"));

  const openBlock = (block: Block): void => {
    selected = block;
    element("correction-title").textContent = friendlyApp(
      block.app,
      block.title,
    );
    element("correction-context").textContent =
      `${clock(block.start)}–${clock(block.end)} · ${block.service || block.title || "App-level metadata"} · ${block.monitor || "Display unavailable"}`;
    select("block-category").value = block.category;
    input("block-project").value = block.project;
    input("block-task").value = block.task;
    select("block-planning").value = block.planning;
    input("context-pattern").value = "";
    element("category-reason").textContent =
      "Category source: " +
      block.reason +
      (block.visionSummary ? ` · ${block.visionSummary}` : "");
    element("ai-preview").textContent =
      "Ask local AI sends only this app name and the window title shown above to your installed Ollama model. " +
      (snapshot?.settings.aiModel
        ? "Model: " + snapshot.settings.aiModel
        : "Set a local model in Tracking settings first.");
    button("correction-undo").disabled = !block.corrected;
    error("correction-error", "");
    correctionDialog.showModal();
    renderAI();
  };
  const renderTimeline = (): void => {
    if (!snapshot) return;
    const container = element("activity-timeline");
    container.replaceChildren();
    const query = input("activity-search").value.toLowerCase();
    const rows = snapshot.rows.filter((row) =>
      `${row.app} ${row.title} ${row.service} ${row.visionSummary} ${row.project} ${row.task} ${row.category}`
        .toLowerCase()
        .includes(query),
    );
    if (!rows.length) {
      const empty = make("div", "", "activity-empty");
      empty.append(
        make("span", "↗", "empty-arrow"),
        make("h3", query ? "No matching activity" : "Your day starts here."),
        make(
          "p",
          query
            ? "Try another app, category, or project."
            : "Use your computer with tracking enabled. Your activity will appear here as it happens.",
        ),
      );
      container.append(empty);
    }
    for (const row of rows) {
      const item = make("div", "", "timeline-row");
      const time = make("div", "", "timeline-time");
      time.append(
        make("span", clock(row.start)),
        make("small", duration(row.end - row.start)),
      );
      const detail = make("div", "", "timeline-detail");
      detail.append(
        make(
          "strong",
          row.kind === "idle" ? "Idle" : friendlyApp(row.app, row.title),
        ),
        make(
          "span",
          row.kind === "idle"
            ? "No input for at least 5 minutes"
            : [row.project, row.task].filter(Boolean).join(" · ") ||
                row.service ||
                row.title ||
                "App-level metadata",
        ),
      );
      if (row.kind === "active")
        detail.append(
          make(
            "small",
            `${row.corrected ? row.reason : row.evidenceSource || row.reason} · ${row.corrected ? "100" : String(Math.round(row.contextConfidence / 10))}% confidence · ${row.planning}` +
              (row.visionSummary &&
              row.visionSummary !== "App activity captured"
                ? " · " + row.visionSummary
                : ""),
          ),
        );
      const tag = make(
        "span",
        row.kind === "idle" ? "Idle" : row.category,
        "category-tag",
      );
      item.append(time, detail, tag);
      if (row.kind === "active") {
        const edit = make(
          "button",
          row.live ? "Live" : "Review",
          "timeline-action",
        ) as HTMLButtonElement;
        edit.disabled = row.live;
        edit.title = row.live
          ? "Pause tracking to review the current block"
          : "Correct category or project";
        edit.addEventListener("click", () => {
          openBlock(row);
        });
        item.append(edit);
      }
      container.append(item);
    }
    element("timeline-count").textContent =
      snapshot.totalRows > 200
        ? `Showing the latest 200 of ${String(snapshot.totalRows)} blocks. Totals include the whole day.`
        : `${String(snapshot.totalRows)} blocks · Windows metadata · Most recent first`;
  };
  const renderSettingsPage = (state: Snapshot): void => {
    if (!element("settings-page").contains(document.activeElement)) {
      input("profile-name").value = state.settings.profileName;
      input("profile-role").value = state.settings.profileRole;
      textarea("profile-notes").value = state.settings.profileNotes;
    }
    element("settings-tracking-state").textContent = state.running
      ? "Running"
      : state.pausedUntil
        ? `Paused until ${new Date(state.pausedUntil).toLocaleString()}`
        : "Needs attention";
    const log = state.visionLog;
    const activityLog = state.activityAnalysisLog;
    element("usage-screenshots").textContent = log.screenshots.toLocaleString();
    element("usage-success").textContent = (
      log.successful + activityLog.successful
    ).toLocaleString();
    element("usage-failed").textContent = (
      log.failed + activityLog.failed
    ).toLocaleString();
    element("usage-cost").textContent =
      `$${(log.estimatedUsd + activityLog.estimatedUsd).toFixed(4)}`;
    element("vision-log-model").textContent = "Haiku vision · Sonnet activity";
    element("usage-token-detail").textContent =
      `Vision: ${log.attempts.toLocaleString()} attempts, ${log.inputTokens.toLocaleString()} in, ${log.outputTokens.toLocaleString()} out, $${log.estimatedUsd.toFixed(4)}. ` +
      `Activity: ${activityLog.attempts.toLocaleString()} attempts, ${activityLog.labels.toLocaleString()} labels, ${activityLog.inputTokens.toLocaleString()} in, ${activityLog.outputTokens.toLocaleString()} out, $${activityLog.estimatedUsd.toFixed(4)}.`;
    const container = element("analysis-log");
    container.replaceChildren();
    if (!log.entries.length && !activityLog.entries.length) {
      container.append(
        make(
          "p",
          "No Claude analysis has been recorded yet.",
          "analysis-log-empty",
        ),
      );
      return;
    }
    const entries = [
      ...log.entries.map((entry) => ({
        ...entry,
        kind: "vision" as const,
        labels: 0,
      })),
      ...activityLog.entries.map((entry) => ({
        ...entry,
        kind: "activity" as const,
        screenshotCaptured: 0,
        evidenceCommitted: entry.status === "success" ? 1 : 0,
        imageDisposition: "not_captured",
        disposedAt: 0,
      })),
    ]
      .sort((left, right) => right.observedAt - left.observedAt)
      .slice(0, 100);
    for (const entry of entries) {
      const row = make("div", "", "analysis-log-row");
      const result = make(
        "span",
        entry.status === "success" ? "Processed" : entry.errorCode || "Failed",
      );
      result.classList.add(
        entry.status === "success" ? "log-success" : "log-failed",
      );
      row.append(
        make("time", new Date(entry.observedAt).toLocaleString()),
        result,
        make(
          "span",
          entry.kind === "activity"
            ? `Metadata · ${entry.labels.toLocaleString()} labels`
            : entry.imageDisposition === "discarded_after_commit"
              ? entry.evidenceCommitted
                ? "Evidence saved ✓ · Image deleted ✓"
                : "Image deleted ✓"
              : entry.imageDisposition === "legacy_discarded"
                ? "Legacy · deletion unverified"
                : entry.imageDisposition === "pending"
                  ? "Awaiting deletion receipt"
                  : "Not captured",
        ),
        make(
          "span",
          `${entry.inputTokens.toLocaleString()} in · ${entry.outputTokens.toLocaleString()} out`,
        ),
        make("span", `${(entry.latencyMs / 1000).toFixed(1)}s`),
      );
      container.append(row);
    }
  };
  const render = (state: Snapshot): void => {
    engineUnavailable = false;
    snapshot = state;
    tracking.disabled = false;
    tracking.textContent = state.error
      ? "Retry tracking"
      : state.pausedUntil
        ? "Resume tracking"
        : "Tracking settings";
    tracking.classList.toggle("is-tracking", state.running);
    element("tracking-indicator").classList.toggle("active", state.running);
    element("tracking-status").textContent = !state.running
      ? state.pausedUntil
        ? "Tracking paused · Resumes automatically"
        : "Tracking stopped · Check the message below"
      : state.current.state === "excluded"
        ? "Tracking enabled · Current app or window excluded"
        : state.current.state === "locked"
          ? "Tracking enabled · Desktop locked, capture suspended"
          : state.current.state !== "active"
            ? "Tracking enabled · Waiting for Windows activity"
            : state.current.idle
              ? "Idle · Active time is not increasing"
              : `Tracking ${friendlyApp(state.current.app, state.current.title)}${state.current.context === "context_unavailable" ? " · Window details unavailable" : ""}`;
    error(
      "activity-error",
      state.error
        ? "Tracking stopped because activity could not be captured or saved. Your previous saved history is preserved. Try starting again."
        : "",
    );
    element("metric-active").textContent = duration(state.summary.trackedMs);
    element("metric-focus").textContent = duration(state.summary.focusMs);
    element("metric-switches").textContent = String(state.summary.switches);
    element("metric-idle").textContent = duration(state.summary.idleMs);
    button("delete-day").disabled = state.totalRows === 0;
    element("activity-save-status").textContent = state.lastSaved
      ? `Saved locally ${clock(state.lastSaved)} · Checkpoints every 30s · 30-day history`
      : "Encrypted local history · Checkpoints every 30s · 30-day retention";
    const hours = element("activity-hours");
    hours.replaceChildren();
    for (const [hour, ms] of state.summary.hourly.entries()) {
      const bar = make("div", "", "hour-column");
      const fill = make("div", "", "hour-fill");
      fill.style.height = `${String(Math.min(100, Math.max(2, (ms / 3600000) * 100)))}%`;
      fill.classList.toggle("has-activity", ms > 0);
      bar.title = `${String(hour)}:00 · ${duration(ms)} active`;
      bar.append(fill);
      hours.append(bar);
    }
    const apps = element("activity-apps");
    apps.replaceChildren();
    if (!state.summary.apps.length)
      apps.append(
        make("p", "Your most-used apps will appear here.", "activity-hint"),
      );
    for (const app of state.summary.apps.slice(0, 6)) {
      const row = make("div", "", "app-share");
      const label = make("div");
      label.append(
        make("span", friendlyApp(app.name)),
        make("strong", duration(app.ms)),
      );
      const track = make("div", "", "app-share-track");
      const fill = make("i");
      fill.style.width = `${String((app.ms / Math.max(1, state.summary.trackedMs)) * 100)}%`;
      track.append(fill);
      row.append(label, track);
      apps.append(row);
    }
    const insights = element("activity-insights");
    insights.replaceChildren(
      ...state.summary.insights.map((text) => make("p", text, "pattern-note")),
    );
    if (!element("activity-timeline").contains(document.activeElement))
      renderTimeline();
    renderExpansion(state);
    renderSettingsPage(state);
  };
  const perform = async (action: Action): Promise<boolean> => {
    busy = true;
    try {
      render(
        await window.productivity.request({
          ...action,
          ...period(),
          range: select("review-range").value as "day" | "week",
        }),
      );
      return true;
    } catch {
      engineUnavailable = true;
      error(
        "activity-error",
        "The local activity engine could not complete this action. Saved history is preserved. Try again; if it persists, restart Ascend.",
      );
      tracking.disabled = false;
      tracking.textContent = "Retry tracking";
      element("tracking-status").textContent =
        "Activity engine unavailable · Tracking status cannot be confirmed";
      element("tracking-indicator").classList.remove("active");
      if (snapshot) snapshot.running = false;
      return false;
    } finally {
      busy = false;
    }
  };
  const request = (action: Action): Promise<boolean> => {
    if (action.action === "state" && busy) return Promise.resolve(false);
    scheduled = scheduled.then(() => perform(action));
    return scheduled;
  };
  tracking.addEventListener("click", () => {
    if (
      engineUnavailable ||
      snapshot?.pausedUntil ||
      snapshot?.error ||
      !snapshot
    )
      void request({ action: "start" });
    else openSettings();
  });
  dateInput.addEventListener("change", () => {
    clearPlan();
    if (dateInput.validity.valid && dateInput.value)
      void request({ action: "state" });
  });
  const changeDay = (delta: number): void => {
    const day = new Date(dateInput.value + "T12:00:00");
    day.setDate(day.getDate() + delta);
    const value = dateString(day);
    if (value < dateInput.min || value > dateInput.max) return;
    dateInput.value = value;
    clearPlan();
    void request({ action: "state" });
  };
  element("previous-day").addEventListener("click", () => {
    changeDay(-1);
  });
  element("next-day").addEventListener("click", () => {
    changeDay(1);
  });
  element("today").addEventListener("click", () => {
    clearPlan();
    dateInput.value = dateString(new Date());
    void request({ action: "state" });
  });
  element("activity-search").addEventListener("input", renderTimeline);
  const openSettings = (): void => {
    if (!snapshot) return;
    input("capture-details").checked = snapshot.settings.details;
    input("vision-enabled").checked = snapshot.settings.visionEnabled;
    input("activity-analysis-enabled").checked =
      snapshot.settings.activityAnalysisEnabled;
    element("vision-status").textContent = snapshot.vision.configured
      ? `Claude vision: ${snapshot.vision.status}. ${String(snapshot.vision.requests)} analyses in this view; ${String(snapshot.vision.inputTokens)} input tokens and ${String(snapshot.vision.outputTokens)} output tokens.`
      : "Claude vision key is not configured for this Windows account.";
    element("activity-analysis-status").textContent = snapshot.activityAnalysis
      .configured
      ? `Claude Sonnet activity analysis: ${snapshot.activityAnalysis.status}. ${snapshot.activityAnalysisLog.labels.toLocaleString()} timeline labels stored.`
      : "Claude Sonnet activity-analysis key is not configured for this Windows account.";
    textarea("excluded-apps").value = snapshot.settings.excluded.join("\n");
    select("break-reminder").value = String(snapshot.settings.breakMinutes);
    input("ai-model").value = snapshot.settings.aiModel;
    element("vault-location").textContent =
      `Encrypted history: ${snapshot.storagePath}`;
    error("settings-error", "");
    settingsDialog.showModal();
    renderRules();
  };
  element("activity-settings").addEventListener("click", openSettings);
  element("open-tracking-settings").addEventListener("click", openSettings);
  element("profile-save").addEventListener("click", () => {
    element("profile-status").textContent = "Saving…";
    void request({
      action: "profile",
      name: input("profile-name").value.trim(),
      role: input("profile-role").value.trim(),
      notes: textarea("profile-notes").value.trim(),
    }).then((saved) => {
      element("profile-status").textContent = saved
        ? "Saved on this device."
        : "Could not save.";
    });
  });
  element("settings-cancel").addEventListener("click", () => {
    settingsDialog.close();
  });
  element("settings-save").addEventListener("click", () => {
    const model = input("ai-model").value.trim();
    if (
      (model && !/^[A-Za-z0-9_.:/-]{1,100}$/.test(model)) ||
      model.toLowerCase().includes("cloud")
    ) {
      error(
        "settings-error",
        "Enter an installed local model name. Cloud models are not supported here.",
      );
      return;
    }
    const excluded = textarea("excluded-apps")
      .value.split(/[\n,]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (
      excluded.length > 100 ||
      excluded.some((item) => !/^[\w .()\-]{1,116}\.exe$/i.test(item))
    ) {
      error(
        "settings-error",
        "Enter executable names such as chrome.exe, one per line (up to 100).",
      );
      return;
    }
    void request({
      action: "settings",
      settings: {
        details: input("capture-details").checked,
        excluded,
        visionEnabled: input("vision-enabled").checked,
        activityAnalysisEnabled: input("activity-analysis-enabled").checked,
      },
    }).then(async (ok) => {
      if (ok)
        ok = await request({
          action: "preferences",
          goalMinutes: snapshot?.settings.goalMinutes ?? 120,
          breakMinutes: Number(select("break-reminder").value),
          aiModel: input("ai-model").value.trim(),
        });
      if (ok) settingsDialog.close();
      else
        error(
          "settings-error",
          "Settings could not be saved. Please try again.",
        );
    });
  });
  const correct = (undo: boolean): void => {
    if (!selected) return;
    void request({
      action: "correct",
      ids: selected.ids,
      category: undo ? null : select("block-category").value,
      project: undo ? "" : input("block-project").value,
      task: undo ? "" : input("block-task").value,
      planning: select("block-planning").value as Block["planning"],
    } as Command).then((ok) => {
      if (ok) correctionDialog.close();
      else
        error(
          "correction-error",
          "The correction could not be saved. Please try again.",
        );
    });
  };
  element("correction-save").addEventListener("click", () => {
    correct(false);
  });
  element("correction-undo").addEventListener("click", () => {
    correct(true);
  });
  element("correction-cancel").addEventListener("click", () => {
    correctionDialog.close();
  });
  element("correction-rule").addEventListener("click", () => {
    if (!selected) return;
    void request({
      action: "rule",
      app: selected.app,
      category: select("block-category").value,
    } as Command).then((ok) => {
      if (ok) correctionDialog.close();
      else error("correction-error", "The app rule could not be saved.");
    });
  });
  element("delete-day").addEventListener("click", () => {
    element("delete-description").textContent = dateInput.value;
    deleteDialog.showModal();
  });
  element("delete-cancel").addEventListener("click", () => {
    deleteDialog.close();
  });
  element("delete-confirm").addEventListener("click", () => {
    void request({ action: "delete_day" }).then((ok) => {
      if (ok) deleteDialog.close();
    });
  });
  for (const category of [
    "Work",
    "Communication",
    "Learning",
    "Personal",
    "Uncategorized",
  ]) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    element("block-category").append(option);
  }
  let editingPlan = "";
  let editingCompleted = false;
  const showPane = (name: string): void => {
    for (const pane of ["day", "plan", "review"]) {
      element(pane + "-pane").hidden = pane !== name;
      element("show-" + pane).classList.toggle("selected", pane === name);
      element("show-" + pane).setAttribute(
        "aria-pressed",
        String(pane === name),
      );
    }
  };
  for (const pane of ["day", "plan", "review"])
    element("show-" + pane).addEventListener("click", () => {
      showPane(pane);
    });
  select("review-range").addEventListener("change", () => {
    void request({ action: "state" });
  });
  element("pause-apply").addEventListener("click", () => {
    void request({
      action: "pause",
      hours: Number(select("pause-hours").value),
    }).then((ok) => {
      if (ok) settingsDialog.close();
    });
  });
  element("resume-now").addEventListener("click", () => {
    void request({ action: "start" }).then((ok) => {
      if (ok) settingsDialog.close();
    });
  });
  const line = (label: string, value: string): HTMLElement => {
    const row = make("div", "", "review-line");
    row.append(make("span", label), make("strong", value));
    return row;
  };
  const actionButton = (label: string, action: () => void): HTMLElement => {
    const control = make("button", label, "text-button");
    control.addEventListener("click", () => {
      control.blur();
      action();
    });
    return control;
  };
  const renderRules = (): void => {
    const list = element("context-rule-list");
    list.replaceChildren();
    for (const rule of snapshot?.settings.contextRules ?? []) {
      const row = make("div", "", "rule-row");
      row.append(
        make("span", rule.app + " · " + rule.pattern + " → " + rule.category),
        actionButton("Forget rule", () => {
          void request({ action: "remove_context_rule", ruleId: rule.id });
        }),
      );
      list.append(row);
    }
    if (!list.children.length)
      list.append(
        make(
          "p",
          "Review a block to remember a window-context rule.",
          "activity-hint",
        ),
      );
  };
  const renderAI = (): void => {
    const ai = snapshot?.ai;
    const matches = Boolean(
      selected &&
      ai?.ids?.length &&
      selected.ids.length === ai.ids.length &&
      selected.ids.every((id) => ai.ids?.includes(id)),
    );
    button("ask-local-ai").disabled =
      !snapshot?.settings.aiModel || ai?.status === "running";
    element("apply-local-ai").hidden = !(matches && ai?.status === "ready");
    element("ai-result").textContent =
      ai?.status === "error"
        ? (ai.message ?? "")
        : matches && ai?.status === "running"
          ? "Your local model is reviewing the selected metadata…"
          : matches && ai?.status === "ready"
            ? String(ai.category) +
              " · " +
              String(ai.reason) +
              " · Suggested by " +
              String(ai.model)
            : "";
  };
  const drawCountdowns = (): void => {
    if (!snapshot) return;
    const remaining = Math.max(0, snapshot.pausedUntil - Date.now());
    element("pause-banner").hidden = !remaining;
    element("pause-banner").textContent = remaining
      ? "Tracking is paused. Resumes in " +
        duration(remaining) +
        " · " +
        new Date(snapshot.pausedUntil).toLocaleString()
      : "";
    const focus = snapshot.focus;
    const timer = Math.max(0, (focus.end ?? 0) - Date.now());
    const label =
      focus.phase === "complete"
        ? focus.finishedPhase === "break"
          ? "Break complete."
          : "Focus timer complete."
        : focus.phase
          ? (focus.phase === "break" ? "Break · " : "Focus · ") +
            String(Math.floor(timer / 60000)).padStart(2, "0") +
            ":" +
            String(Math.floor(timer / 1000) % 60).padStart(2, "0")
          : "Ready when you are.";
    element("focus-clock").textContent = label;
    element("timer-banner").hidden = !focus.phase;
    element("timer-banner").textContent =
      label + (focus.task ? " · " + focus.task : "");
    element("focus-detail").textContent = [focus.project, focus.task]
      .filter(Boolean)
      .join(" · ");
  };
  const renderExpansion = (state: Snapshot): void => {
    element("startup-status").textContent = state.startupStatus ?? "";
    element("notification-health").textContent = state.notificationStatus ?? "";
    drawCountdowns();
    renderAI();
    if (settingsDialog.open) renderRules();
    const runningTimer =
      state.focus.phase === "focus" || state.focus.phase === "break";
    button("focus-start").disabled = !state.running || runningTimer;
    button("break-start").disabled =
      !state.running || state.focus.phase === "break";
    button("focus-cancel").disabled = !state.focus.phase;
    if (document.activeElement !== input("goal-minutes"))
      input("goal-minutes").value = String(state.settings.goalMinutes);
    element("goal-progress").textContent =
      duration(state.summary.focusMs) +
      " of " +
      String(state.settings.goalMinutes) +
      " minutes of sustained work recorded on the selected day.";
    const chooser = select("focus-plan");
    chooser.disabled = runningTimer;
    if (document.activeElement !== chooser) {
      const previous = chooser.value;
      chooser.replaceChildren(
        new Option("General focus", ""),
        ...state.plans
          .filter((plan) => !plan.completed || plan.id === state.focus.planId)
          .map((plan) => new Option(plan.title, plan.id)),
      );
      chooser.value = [...chooser.options].some(
        (option) => option.value === previous,
      )
        ? previous
        : "";
      if (runningTimer) chooser.value = state.focus.planId ?? "";
    }
    const tasks = element("task-list");
    if (!tasks.contains(document.activeElement)) {
      tasks.replaceChildren();
      for (const plan of state.plans) {
        const row = make("div", "", "task-row");
        const description = make("div");
        description.append(
          make("strong", (plan.completed ? "✓ " : "") + plan.title),
          make(
            "p",
            [plan.project, String(plan.minutes) + " planned minutes"]
              .filter(Boolean)
              .join(" · "),
            "activity-hint",
          ),
        );
        const controls = make("div", "", "task-actions");
        controls.append(
          actionButton(plan.completed ? "Reopen" : "Done", () => {
            void request({
              action: "save_plan",
              planId: plan.id,
              title: plan.title,
              project: plan.project,
              minutes: plan.minutes,
              completed: !plan.completed,
            });
          }),
          actionButton("Edit", () => {
            editingPlan = plan.id;
            editingCompleted = Boolean(plan.completed);
            input("plan-title").value = plan.title;
            input("plan-project").value = plan.project;
            input("plan-minutes").value = String(plan.minutes);
            input("plan-title").focus();
          }),
          actionButton("Focus", () => {
            void request({
              action: "focus_start",
              minutes: Math.min(120, plan.minutes),
              planId: plan.id,
            });
          }),
          actionButton("Delete task", () => {
            void request({ action: "delete_plan", planId: plan.id }).then(
              () => {
                (document.activeElement as HTMLElement | null)?.blur();
              },
            );
          }),
        );
        row.append(description, controls);
        tasks.append(row);
      }
      if (!state.plans.length)
        tasks.append(
          make("p", "Choose one task to start your plan.", "activity-hint"),
        );
    }
    const report = state.report;
    const stats = element("review-stats");
    stats.replaceChildren(
      line("Captured active time", duration(report.activeMs)),
      line("Sustained work", duration(report.focusMs)),
      line("App changes", String(report.switches)),
      line(
        "Previous period",
        report.previousObserved
          ? duration(report.previousActiveMs) +
              " active · " +
              duration(report.previousFocusMs) +
              " sustained"
          : "No active samples",
      ),
    );
    element("review-days").replaceChildren(
      ...report.days.map((day) =>
        line(day.day, day.observed ? duration(day.ms) : "No active samples"),
      ),
    );
    element("review-projects").replaceChildren(
      ...report.projects.map((project) =>
        line(project.name, duration(project.ms)),
      ),
    );
    element("review-categories").replaceChildren(
      ...report.categories.map((category) =>
        line(category.name, duration(category.ms)),
      ),
    );
    element("review-planning").replaceChildren(
      ...Object.entries(report.planning).map(([name, ms]) =>
        line(name.charAt(0).toUpperCase() + name.slice(1), duration(ms)),
      ),
    );
    element("review-coaching").replaceChildren(
      make("h3", report.coaching.title),
      make("p", report.coaching.evidence),
      make("p", report.coaching.action, "coaching-action"),
    );
    const workflows = element("review-workflows");
    const habits = element("review-habits");
    habits.replaceChildren();
    for (const habit of report.habits) {
      const card = make("div", "", "workflow-note");
      card.append(
        make("h3", habit.title),
        make("p", habit.evidence),
        make("p", habit.action, "coaching-action"),
      );
      habits.append(card);
    }
    if (!report.habits.length)
      habits.append(
        make(
          "p",
          "No recurring pattern has met the evidence threshold in this period. Use the seven-day review as your history grows.",
          "activity-hint",
        ),
      );
    workflows.replaceChildren();
    for (const workflow of report.workflows) {
      const card = make("div", "", "workflow-note");
      card.append(
        make("h3", workflow.sequence.join(" → ")),
        make("p", workflow.evidence),
        make("p", workflow.action),
      );
      workflows.append(card);
    }
    if (!report.workflows.length)
      workflows.append(
        make(
          "p",
          "No sequence has repeated at least three times within the current review period. More activity may reveal a useful candidate.",
          "activity-hint",
        ),
      );
  };
  const clearPlan = (): void => {
    editingPlan = "";
    editingCompleted = false;
    required("plan-form", HTMLFormElement).reset();
  };
  element("plan-reset").addEventListener("click", clearPlan);
  element("plan-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!required("plan-form", HTMLFormElement).reportValidity()) return;
    void request({
      action: "save_plan",
      planId: editingPlan,
      title: input("plan-title").value.trim(),
      project: input("plan-project").value.trim(),
      minutes: Number(input("plan-minutes").value),
      completed: editingCompleted,
    }).then((ok) => {
      error(
        "plan-error",
        ok
          ? ""
          : "The task could not be saved. Check the fields and 30-task daily limit.",
      );
      if (ok) clearPlan();
    });
  });
  element("focus-start").addEventListener("click", () => {
    void request({
      action: "focus_start",
      minutes: Number(select("focus-minutes").value),
      planId: select("focus-plan").value,
    });
  });
  element("break-start").addEventListener("click", () => {
    void request({ action: "break_start" });
  });
  element("focus-cancel").addEventListener("click", () => {
    void request({ action: "focus_cancel" });
  });
  element("goal-save").addEventListener("click", () => {
    if (!snapshot || !input("goal-minutes").reportValidity()) return;
    void request({
      action: "preferences",
      goalMinutes: Number(input("goal-minutes").value),
      breakMinutes: snapshot.settings.breakMinutes,
      aiModel: snapshot.settings.aiModel,
    });
  });
  element("coach-to-plan").addEventListener("click", () => {
    if (!snapshot) return;
    input("plan-title").value = snapshot.report.coaching.action.slice(0, 100);
    input("plan-project").value = "Productivity experiment";
    input("plan-minutes").value = "25";
    editingPlan = "";
    editingCompleted = false;
    showPane("plan");
    input("plan-title").focus();
  });
  element("remember-context").addEventListener("click", () => {
    if (!selected) return;
    const pattern = input("context-pattern").value.trim();
    if (pattern.length < 3) {
      error(
        "correction-error",
        "Enter at least three characters to match in the window title.",
      );
      return;
    }
    void request({
      action: "context_rule",
      app: selected.app,
      pattern,
      category: select("block-category").value as Block["category"],
      project: input("block-project").value,
      task: input("block-task").value,
      planning: select("block-planning").value as Block["planning"],
    }).then((ok) => {
      if (ok) correctionDialog.close();
    });
  });
  element("ask-local-ai").addEventListener("click", () => {
    if (selected) void request({ action: "ai_suggest", ids: selected.ids });
  });
  element("apply-local-ai").addEventListener("click", () => {
    void request({
      action: "apply_ai",
      project: input("block-project").value,
      task: input("block-task").value,
      planning: select("block-planning").value as Block["planning"],
    }).then((ok) => {
      if (ok) correctionDialog.close();
    });
  });
  setInterval(drawCountdowns, 1000);
  void request({ action: "state" });
  setInterval(() => {
    dateInput.max = dateString(new Date());
    if (!busy) void request({ action: "state" });
  }, 3000);
})();
