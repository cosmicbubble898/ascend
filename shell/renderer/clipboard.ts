(() => {
  type Snapshot = Awaited<ReturnType<typeof window.clipboardHistory.request>>;
  const required = <T extends HTMLElement>(
    id: string,
    constructor: new () => T,
  ): T => {
    const found = document.getElementById(id);
    if (!(found instanceof constructor))
      throw new Error("clipboard_interface_unavailable");
    return found;
  };
  const element = (id: string): HTMLElement => required(id, HTMLElement);
  const list = element("clipboard-list");
  const copyRecent = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".clipboard-copy-recent"),
  );
  const customCount = required("clipboard-custom-count", HTMLSelectElement);
  const copyCustom = required("clipboard-copy-custom", HTMLButtonElement);
  const previewDialog = required("clipboard-preview-dialog", HTMLDialogElement);
  const previewImage = required("clipboard-preview-image", HTMLImageElement);
  const previewClose = required("clipboard-preview-close", HTMLButtonElement);
  let busy = false;

  const time = (value: number): string =>
    new Date(value).toLocaleString([], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const size = (bytes: number): string => {
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const render = (snapshot: Snapshot): void => {
    element("clipboard-count").textContent =
      snapshot.items.length.toLocaleString();
    element("clipboard-status").textContent = snapshot.status;
    element("clipboard-retention").textContent =
      `Newest first · up to ${String(snapshot.maximumItems)} items · encrypted locally for ${String(snapshot.retentionDays)} days`;
    for (const control of copyRecent) {
      const count = Number(control.dataset.count);
      control.disabled = busy || snapshot.items.length < count;
    }
    copyCustom.disabled =
      busy || snapshot.items.length < Number(customCount.value);
    list.replaceChildren();
    if (!snapshot.items.length) {
      const empty = document.createElement("div");
      empty.className = "clipboard-empty";
      const mark = document.createElement("span");
      mark.textContent = "□";
      const heading = document.createElement("h2");
      heading.textContent = "Copy something to begin.";
      const description = document.createElement("p");
      description.textContent =
        "New text, images, audio, video, and files will appear here automatically.";
      empty.append(mark, heading, description);
      list.append(empty);
      return;
    }
    for (const item of snapshot.items) {
      const card = document.createElement("article");
      card.className = "clipboard-item";
      const visual = document.createElement("button");
      visual.type = "button";
      visual.className = `clipboard-visual clipboard-${item.kind}`;
      visual.disabled = busy;
      if (item.imageDataUrl) {
        const image = document.createElement("img");
        image.src = item.imageDataUrl;
        image.alt = "Copied image preview";
        visual.append(image);
      } else {
        visual.textContent =
          item.kind === "text"
            ? "T"
            : item.kind === "audio"
              ? "♪"
              : item.kind === "video"
                ? "▶"
                : "↗";
      }
      visual.title = item.hasSourceFile ? `Open ${item.title}` : "Open preview";
      visual.setAttribute(
        "aria-label",
        item.hasSourceFile ? `Open ${item.title}` : "Open image preview",
      );
      if (item.hasSourceFile) {
        visual.addEventListener(
          "click",
          () => void run({ action: "open", id: item.id }),
        );
      } else if (item.kind === "image") {
        visual.addEventListener("click", () => void showPreview(item.id));
      } else {
        visual.disabled = true;
      }
      const content = document.createElement("div");
      content.className = "clipboard-item-content";
      const meta = document.createElement("div");
      meta.className = "clipboard-item-meta";
      const kind = document.createElement("span");
      kind.className = "clipboard-kind";
      kind.textContent = item.kind;
      const captured = document.createElement("span");
      captured.textContent = `${time(item.createdAt)} · ${item.byteSize ? size(item.byteSize) : "Windows path"}`;
      meta.append(kind, captured);
      const title = document.createElement("h3");
      title.textContent = item.title;
      const preview = document.createElement("p");
      preview.textContent = item.preview;
      content.append(meta, title, preview);
      const copy = document.createElement("button");
      copy.className = "button secondary clipboard-copy";
      copy.textContent = "Copy again";
      copy.disabled = busy;
      copy.addEventListener(
        "click",
        () => void run({ action: "copy", id: item.id }),
      );
      const actions = document.createElement("div");
      actions.className = "clipboard-item-actions";
      if (item.hasSourceFile) {
        const open = document.createElement("button");
        open.className = "button secondary clipboard-open";
        open.textContent = "Open";
        open.disabled = busy;
        open.addEventListener(
          "click",
          () => void run({ action: "open", id: item.id }),
        );
        actions.append(open);
      } else if (item.kind === "image") {
        const open = document.createElement("button");
        open.className = "button secondary clipboard-open";
        open.textContent = "Preview";
        open.disabled = busy;
        open.addEventListener("click", () => void showPreview(item.id));
        actions.append(open);
      }
      actions.append(copy);
      card.append(visual, content, actions);
      list.append(card);
    }
  };

  const run = async (
    command: Parameters<typeof window.clipboardHistory.request>[0],
  ): Promise<void> => {
    if (busy) return;
    busy = true;
    for (const control of copyRecent) control.disabled = true;
    try {
      const snapshot = await window.clipboardHistory.request(command);
      busy = false;
      render(snapshot);
    } catch {
      element("clipboard-status").textContent =
        "Clipboard action could not be completed.";
    } finally {
      busy = false;
    }
  };

  const showPreview = async (id: string): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      const preview = await window.clipboardHistory.preview(id);
      previewImage.src = preview.imageDataUrl;
      previewDialog.showModal();
    } catch {
      element("clipboard-status").textContent =
        "This image preview could not be opened.";
    } finally {
      busy = false;
    }
  };

  for (const control of copyRecent) {
    control.addEventListener("click", () => {
      const count = Number(control.dataset.count);
      if (Number.isInteger(count)) void run({ action: "copyRecent", count });
    });
  }
  const copySelected = (): void => {
    const count = Number(customCount.value);
    if (Number.isInteger(count) && count >= 1 && count <= 20)
      void run({ action: "copyRecent", count });
  };
  copyCustom.addEventListener("click", copySelected);
  customCount.addEventListener("change", () => void run({ action: "state" }));
  previewClose.addEventListener("click", () => {
    previewDialog.close();
  });
  previewDialog.addEventListener("close", () => {
    previewImage.removeAttribute("src");
  });
  void run({ action: "state" });
  window.setInterval(() => {
    if (!busy && !element("clipboard-page").hidden)
      void run({ action: "state" });
  }, 1000);
})();
