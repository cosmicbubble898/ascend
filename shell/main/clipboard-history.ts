import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { clipboard, nativeImage, safeStorage, shell } from "electron";

import type {
  ClipboardHistoryCommand,
  ClipboardHistoryItem,
  ClipboardPreview,
  ClipboardHistorySnapshot,
  ClipboardKind,
} from "../clipboard-contract";

const MAXIMUM_ITEMS = 100;
const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const MAXIMUM_VAULT_BYTES = 100 * 1024 * 1024;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_RICH_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const FILE_FORMATS = [
  "text/uri-list",
  "Shell IDList Array",
  "FileDrop",
  "FileNameW",
  "FileName",
] as const;

export interface StoredClipboardItem extends ClipboardHistoryItem {
  text?: string;
  html?: string;
  rtf?: string;
  png?: string;
  sourcePaths?: string[];
}

export interface ClipboardPort {
  availableFormats(): string[];
  readBuffer(format: string): Buffer;
  readHTML(): string;
  readImagePng(): Buffer;
  readRTF(): string;
  readText(): string;
  writeImage(value: Buffer): void;
  writeText(data: { text: string; html?: string; rtf?: string }): void;
}

export interface ClipboardFilePort {
  readPaths(): Promise<string[]>;
  writePaths(paths: readonly string[]): Promise<void>;
  writeBatch(entries: readonly ClipboardBatchEntry[]): Promise<string[]>;
}

export type ClipboardBatchEntry =
  { sourcePath: string } | { fileName: string; contents: Buffer };

export interface ClipboardVault {
  load(): Promise<StoredClipboardItem[]>;
  save(items: StoredClipboardItem[]): Promise<void>;
}

const electronClipboard: ClipboardPort = {
  availableFormats: () => clipboard.availableFormats(),
  readBuffer: (format) => clipboard.readBuffer(format),
  readHTML: () => clipboard.readHTML(),
  readImagePng: () => clipboard.readImage().toPNG(),
  readRTF: () => clipboard.readRTF(),
  readText: () => clipboard.readText(),
  writeImage: (value) => {
    clipboard.writeImage(nativeImage.createFromBuffer(value));
  },
  writeText: (data) => {
    clipboard.write(data);
  },
};

const runPowerShell = (
  script: string,
  arguments_: readonly string[] = [],
  input?: string,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-Command",
        script,
        ...arguments_,
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    child.stdin.end(input);
    const output: Buffer[] = [];
    let errorOutput = "";
    let outputBytes = 0;
    let settled = false;
    const finish = (action: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => {
        reject(new Error("clipboard_helper_timeout"));
      });
    }, 5000);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 1024 * 1024) {
        child.kill();
        finish(() => {
          reject(new Error("clipboard_helper_output_limit"));
        });
        return;
      }
      output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString("utf8").slice(0, 1000);
    });
    child.on("error", (error) => {
      finish(() => {
        reject(error);
      });
    });
    child.on("close", (code) => {
      finish(() => {
        if (code === 0) resolve(Buffer.concat(output).toString("utf8"));
        else reject(new Error(errorOutput || "clipboard_helper_failed"));
      });
    });
  });

const safeAttachmentName = (value: string): string => {
  const cleaned = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 100) || "clipboard-item";
};

const createWindowsClipboardFiles = (userData: string): ClipboardFilePort => {
  const cacheFolder = path.resolve(userData, "clipboard", "paste-cache");
  const cleanupCache = async (): Promise<void> => {
    await mkdir(cacheFolder, { recursive: true });
    const names = await readdir(cacheFolder);
    await Promise.all(
      names.map(async (name) => {
        const candidate = path.resolve(cacheFolder, name);
        if (path.dirname(candidate) !== cacheFolder) return;
        try {
          const details = await stat(candidate);
          if (Date.now() - details.mtimeMs >= RETENTION_MS)
            await rm(candidate, { recursive: true, force: true });
        } catch {
          // The entry may have been removed by another cleanup.
        }
      }),
    );
  };

  const port: ClipboardFilePort = {
    async readPaths(): Promise<string[]> {
      const output = await runPowerShell(
        "Add-Type -AssemblyName System.Windows.Forms; foreach($item in [System.Windows.Forms.Clipboard]::GetFileDropList()){ [Console]::Out.WriteLine([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes([string]$item))) }",
      );
      return output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((value) => Buffer.from(value, "base64").toString("utf8"))
        .map((value) => path.resolve(value))
        .filter((value, index, values) => values.indexOf(value) === index);
    },
    async writePaths(paths: readonly string[]): Promise<void> {
      if (
        !paths.length ||
        paths.some((value) => !path.isAbsolute(value) || !existsSync(value))
      )
        throw new Error("clipboard_source_missing");
      await runPowerShell(
        "[Console]::InputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Windows.Forms; $payload=[Console]::In.ReadToEnd() | ConvertFrom-Json; $list=New-Object System.Collections.Specialized.StringCollection; foreach($candidate in @($payload)){ $full=[IO.Path]::GetFullPath([string]$candidate); if(-not [IO.File]::Exists($full) -and -not [IO.Directory]::Exists($full)){ throw 'clipboard_source_missing' }; [void]$list.Add($full) }; $written=$false; for($attempt=0;$attempt -lt 10 -and -not $written;$attempt++){ try { [System.Windows.Forms.Clipboard]::SetFileDropList($list); $written=$true } catch { Start-Sleep -Milliseconds 75 } }; if(-not $written){ throw 'clipboard_write_failed' }",
        [],
        JSON.stringify(paths),
      );
    },
    async writeBatch(
      entries: readonly ClipboardBatchEntry[],
    ): Promise<string[]> {
      if (!entries.length) throw new Error("clipboard_history_empty");
      await cleanupCache();
      const batchFolder = path.join(
        cacheFolder,
        `${String(Date.now())}-${randomUUID()}`,
      );
      const paths: string[] = [];
      let generated = false;
      for (const [index, entry] of entries.entries()) {
        if ("sourcePath" in entry) {
          if (
            !path.isAbsolute(entry.sourcePath) ||
            !existsSync(entry.sourcePath)
          )
            throw new Error("clipboard_source_missing");
          paths.push(entry.sourcePath);
          continue;
        }
        if (!generated) {
          await mkdir(batchFolder, { recursive: true });
          generated = true;
        }
        const numberedName = `${String(index + 1).padStart(2, "0")} - ${safeAttachmentName(entry.fileName)}`;
        const target = path.join(batchFolder, numberedName);
        await writeFile(target, entry.contents);
        paths.push(target);
      }
      await port.writePaths(paths);
      return paths;
    },
  };
  return port;
};

export class EncryptedClipboardVault implements ClipboardVault {
  readonly #folder: string;
  readonly #file: string;

  constructor(userData: string) {
    this.#folder = path.join(userData, "clipboard");
    this.#file = path.join(this.#folder, "history.bin");
  }

  async load(): Promise<StoredClipboardItem[]> {
    if (!safeStorage.isEncryptionAvailable()) return [];
    try {
      const encrypted = await readFile(this.#file);
      const parsed: unknown = JSON.parse(safeStorage.decryptString(encrypted));
      return Array.isArray(parsed) ? (parsed as StoredClipboardItem[]) : [];
    } catch {
      return [];
    }
  }

  async save(items: StoredClipboardItem[]): Promise<void> {
    if (!safeStorage.isEncryptionAvailable())
      throw new Error("clipboard_encryption_unavailable");
    await mkdir(this.#folder, { recursive: true });
    let retained = [...items];
    let plain = Buffer.from(JSON.stringify(retained), "utf8");
    while (plain.length > MAXIMUM_VAULT_BYTES && retained.length > 1) {
      retained = retained.slice(0, -1);
      plain = Buffer.from(JSON.stringify(retained), "utf8");
    }
    if (plain.length > MAXIMUM_VAULT_BYTES)
      throw new Error("clipboard_vault_limit");
    const temporary = `${this.#file}.${String(process.pid)}.tmp`;
    await writeFile(
      temporary,
      safeStorage.encryptString(plain.toString("utf8")),
    );
    await rename(temporary, this.#file);
  }
}

const extensionKind = (fileName: string): ClipboardKind => {
  const extension = path.extname(fileName).toLowerCase();
  if ([".aac", ".flac", ".m4a", ".mp3", ".ogg", ".wav"].includes(extension))
    return "audio";
  if ([".avi", ".mkv", ".mov", ".mp4", ".webm", ".wmv"].includes(extension))
    return "video";
  if ([".bmp", ".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension))
    return "image";
  return "file";
};

export const isFileClipboard = (formats: readonly string[]): boolean =>
  FILE_FORMATS.some((format) => formats.includes(format));

const fileFingerprint = (paths: readonly string[]): string => {
  const hash = createHash("sha256");
  hash.update("files\0");
  for (const sourcePath of paths) {
    hash.update(sourcePath.toLocaleLowerCase());
    hash.update("\0");
  }
  return hash.digest("hex");
};

export const excludesClipboardHistory = (
  formats: readonly string[],
  readBuffer: (format: string) => Buffer,
): boolean => {
  if (formats.includes("ExcludeClipboardContentFromMonitorProcessing"))
    return true;
  if (!formats.includes("CanIncludeInClipboardHistory")) return false;
  const value = readBuffer("CanIncludeInClipboardHistory");
  return value.length >= 4 && value.readUInt32LE(0) === 0;
};

export const retainClipboardItems = (
  items: readonly StoredClipboardItem[],
  now = Date.now(),
): StoredClipboardItem[] =>
  items
    .filter((item) => now - item.createdAt < RETENTION_MS)
    .slice(0, MAXIMUM_ITEMS);

export class ClipboardHistory {
  readonly #clipboard: ClipboardPort;
  readonly #files: ClipboardFilePort;
  readonly #vault: ClipboardVault;
  readonly #now: () => number;
  readonly #openPath: (sourcePath: string) => Promise<string>;
  #items: StoredClipboardItem[] = [];
  #fingerprint = "";
  #timer: NodeJS.Timeout | undefined;
  #status = "Clipboard history is starting.";
  #saving: Promise<void> = Promise.resolve();
  #capturing = false;

  private constructor(
    clipboardPort: ClipboardPort,
    filePort: ClipboardFilePort,
    vault: ClipboardVault,
    now: () => number,
    openPath: (sourcePath: string) => Promise<string>,
  ) {
    this.#clipboard = clipboardPort;
    this.#files = filePort;
    this.#vault = vault;
    this.#now = now;
    this.#openPath = openPath;
  }

  static async create(
    userData: string,
    clipboardPort: ClipboardPort = electronClipboard,
    vault: ClipboardVault = new EncryptedClipboardVault(userData),
    now: () => number = Date.now,
    filePort?: ClipboardFilePort,
    openPath: (sourcePath: string) => Promise<string> = (sourcePath) =>
      shell.openPath(sourcePath),
  ): Promise<ClipboardHistory> {
    const history = new ClipboardHistory(
      clipboardPort,
      filePort ?? createWindowsClipboardFiles(userData),
      vault,
      now,
      openPath,
    );
    history.#items = retainClipboardItems(await vault.load(), now());
    history.#status = "Saved locally and encrypted for 7 days.";
    try {
      history.#fingerprint = history.currentFingerprint();
    } catch {
      history.#fingerprint = "";
    }
    history.#timer = setInterval(() => {
      void history.capture();
    }, 750);
    history.#timer.unref();
    return history;
  }

  snapshot(): ClipboardHistorySnapshot {
    return {
      items: this.#items.map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        preview: item.preview,
        createdAt: item.createdAt,
        byteSize: item.byteSize,
        ...(item.imageDataUrl ? { imageDataUrl: item.imageDataUrl } : {}),
        ...(item.sourcePaths?.length ? { hasSourceFile: true } : {}),
      })),
      maximumItems: MAXIMUM_ITEMS,
      retentionDays: RETENTION_DAYS,
      status: this.#status,
    };
  }

  async request(
    command: ClipboardHistoryCommand,
  ): Promise<ClipboardHistorySnapshot> {
    if (command.action === "copy") await this.copy(command.id);
    if (command.action === "open") await this.open(command.id);
    if (command.action === "copyRecent") await this.copyRecent(command.count);
    if (command.action === "delete") {
      this.#items = this.#items.filter((item) => item.id !== command.id);
      await this.persist();
    }
    if (command.action === "clear") {
      this.#items = [];
      await this.persist();
    }
    return this.snapshot();
  }

  async capture(): Promise<void> {
    if (this.#capturing) return;
    this.#capturing = true;
    try {
      const formats = this.#clipboard.availableFormats();
      if (
        excludesClipboardHistory(formats, (format) =>
          this.#clipboard.readBuffer(format),
        )
      ) {
        this.#fingerprint = `protected:${[...formats].sort().join("|")}`;
        this.#status = "A protected clipboard item was not retained.";
        return;
      }
      const filePaths = isFileClipboard(formats)
        ? await this.#files.readPaths()
        : undefined;
      const fingerprint = filePaths
        ? fileFingerprint(filePaths)
        : this.currentFingerprint(formats);
      if (!fingerprint || fingerprint === this.#fingerprint) return;
      this.#fingerprint = fingerprint;
      const items = await this.readItems(formats, filePaths);
      if (!items.length) return;
      this.#items = retainClipboardItems(
        [...items, ...this.#items],
        this.#now(),
      );
      this.#status = "Saved locally and encrypted for 7 days.";
      await this.persist();
    } catch {
      this.#status = "The latest clipboard item could not be captured.";
    } finally {
      this.#capturing = false;
    }
  }

  async close(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    await this.#saving;
  }

  preview(id: string): ClipboardPreview {
    const item = this.#items.find((candidate) => candidate.id === id);
    if (!item?.png) throw new Error("clipboard_preview_missing");
    return { id, imageDataUrl: `data:image/png;base64,${item.png}` };
  }

  private currentFingerprint(
    formats = this.#clipboard.availableFormats(),
  ): string {
    if (!formats.length) return "";
    const hash = createHash("sha256");
    const fileFormat = FILE_FORMATS.find((format) => formats.includes(format));
    if (fileFormat) {
      hash.update(fileFormat);
      hash.update(this.#clipboard.readBuffer(fileFormat));
    } else if (formats.some((format) => format.startsWith("image/"))) {
      hash.update("image");
      hash.update(this.#clipboard.readImagePng());
    } else {
      hash.update("text");
      hash.update(this.#clipboard.readText());
    }
    return hash.digest("hex");
  }

  private async readItems(
    formats: string[],
    knownFilePaths?: string[],
  ): Promise<StoredClipboardItem[]> {
    const createdAt = this.#now();
    if (isFileClipboard(formats)) {
      const paths = knownFilePaths ?? (await this.#files.readPaths());
      return paths.map((sourcePath) => ({
        id: randomUUID(),
        kind: extensionKind(sourcePath),
        title: path.basename(sourcePath),
        preview: sourcePath,
        createdAt,
        byteSize: 0,
        sourcePaths: [sourcePath],
      }));
    }
    if (formats.some((format) => format.startsWith("image/"))) {
      const png = this.#clipboard.readImagePng();
      if (!png.length || png.length > MAX_IMAGE_BYTES) {
        this.#status = "Image was too large to save.";
        return [];
      }
      return [
        {
          id: randomUUID(),
          kind: "image",
          title: "Copied image",
          preview: "Encrypted local image · removed after 7 days",
          createdAt,
          byteSize: png.length,
          imageDataUrl: `data:image/png;base64,${nativeImage
            .createFromBuffer(png)
            .resize({ width: 320, height: 220, quality: "good" })
            .toPNG()
            .toString("base64")}`,
          png: png.toString("base64"),
        },
      ];
    }
    const text = this.#clipboard.readText();
    const bytes = Buffer.byteLength(text, "utf8");
    if (!text || bytes > MAX_TEXT_BYTES) {
      if (bytes > MAX_TEXT_BYTES) this.#status = "Text was too large to save.";
      return [];
    }
    let html = formats.includes("text/html") ? this.#clipboard.readHTML() : "";
    let rtf = formats.includes("text/rtf") ? this.#clipboard.readRTF() : "";
    if (
      bytes + Buffer.byteLength(html) + Buffer.byteLength(rtf) >
      MAX_RICH_TEXT_BYTES
    ) {
      html = "";
      rtf = "";
    }
    const firstLine = text.split(/\r?\n/, 1)[0]?.slice(0, 80) ?? "";
    return [
      {
        id: randomUUID(),
        kind: "text",
        title: firstLine.length ? firstLine : "Copied text",
        preview: text.slice(0, 600),
        createdAt,
        byteSize: bytes + Buffer.byteLength(html) + Buffer.byteLength(rtf),
        text,
        ...(html ? { html } : {}),
        ...(rtf ? { rtf } : {}),
      },
    ];
  }

  private async copy(id: string): Promise<void> {
    const item = this.#items.find((candidate) => candidate.id === id);
    if (!item) throw new Error("clipboard_item_missing");
    if (item.sourcePaths?.length) {
      await this.#files.writePaths(item.sourcePaths);
      this.#fingerprint = fileFingerprint(item.sourcePaths);
    } else if (item.kind === "image" && item.png) {
      this.#clipboard.writeImage(Buffer.from(item.png, "base64"));
    } else if (item.text) {
      this.#clipboard.writeText({
        text: item.text,
        ...(item.html ? { html: item.html } : {}),
        ...(item.rtf ? { rtf: item.rtf } : {}),
      });
    }
    if (!item.sourcePaths?.length) this.refreshFingerprint();
    this.#status = "Copied again. Ready to paste.";
  }

  private async open(id: string): Promise<void> {
    const item = this.#items.find((candidate) => candidate.id === id);
    const sourcePath = item?.sourcePaths?.[0];
    if (!item || !sourcePath || !existsSync(sourcePath))
      throw new Error("clipboard_source_missing");
    const error = await this.#openPath(sourcePath);
    if (error) throw new Error("clipboard_open_failed");
    this.#status = `Opened ${item.title}.`;
  }

  private async copyRecent(count: number): Promise<void> {
    const selected = this.#items.slice(0, count).reverse();
    if (!selected.length) throw new Error("clipboard_history_empty");
    if (selected.length === 1) {
      const first = selected[0];
      if (!first) throw new Error("clipboard_history_empty");
      await this.copy(first.id);
      return;
    }
    const containsAttachment = selected.some(
      (item) => Boolean(item.sourcePaths?.length) || item.kind === "image",
    );
    if (containsAttachment) {
      const entries: ClipboardBatchEntry[] = [];
      for (const item of selected) {
        if (item.sourcePaths?.length) {
          entries.push(
            ...item.sourcePaths.map((sourcePath) => ({ sourcePath })),
          );
        } else if (item.kind === "image" && item.png) {
          entries.push({
            fileName: `${item.title || "Copied image"}.png`,
            contents: Buffer.from(item.png, "base64"),
          });
        } else if (item.text) {
          entries.push({
            fileName: `${item.title || "Copied text"}.txt`,
            contents: Buffer.from(item.text, "utf8"),
          });
        }
      }
      const paths = await this.#files.writeBatch(entries);
      this.#fingerprint = fileFingerprint(paths);
    } else {
      const combined = selected
        .map((item) => item.text ?? item.title)
        .join("\n\n");
      this.#clipboard.writeText({ text: combined });
      this.refreshFingerprint();
    }
    this.#status = `Copied the latest ${String(selected.length)} items together.`;
  }

  private refreshFingerprint(): void {
    try {
      this.#fingerprint = this.currentFingerprint();
    } catch {
      this.#fingerprint = "";
    }
  }

  private persist(): Promise<void> {
    const values = this.#items;
    this.#saving = this.#saving
      .catch(() => undefined)
      .then(() => this.#vault.save(values));
    return this.#saving;
  }
}
