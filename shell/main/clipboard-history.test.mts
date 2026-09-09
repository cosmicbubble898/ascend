import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  clipboard: {},
  nativeImage: {
    createFromBuffer: () => ({
      resize: () => ({ toPNG: () => Buffer.from("thumbnail") }),
    }),
  },
  safeStorage: {},
  shell: { openPath: () => Promise.resolve("") },
}));

import {
  ClipboardHistory,
  excludesClipboardHistory,
  isFileClipboard,
  retainClipboardItems,
  type ClipboardFilePort,
  type ClipboardPort,
  type ClipboardVault,
  type StoredClipboardItem,
} from "./clipboard-history.js";

class MemoryClipboard implements ClipboardPort {
  formats: string[] = ["text/plain"];
  text = "starting value";
  written = "";
  image: Buffer = Buffer.alloc(0);
  writtenImage: Buffer = Buffer.alloc(0);
  file: Buffer = Buffer.alloc(0);
  availableFormats(): string[] {
    return this.formats;
  }
  readBuffer(format: string): Buffer {
    if (format === "CanIncludeInClipboardHistory") return Buffer.alloc(4);
    if (format === "FileNameW" || format === "FileName") return this.file;
    return Buffer.from(this.text);
  }
  readHTML(): string {
    return "";
  }
  readImagePng(): Buffer {
    return this.image;
  }
  readRTF(): string {
    return "";
  }
  readText(): string {
    return this.text;
  }
  writeImage(value: Buffer): void {
    this.writtenImage = value;
  }
  writeText(data: { text: string }): void {
    this.written = data.text;
    this.text = data.text;
  }
}

class MemoryFiles implements ClipboardFilePort {
  paths: string[] = [];
  written: string[] = [];
  batch: Parameters<ClipboardFilePort["writeBatch"]>[0] | undefined;
  readPaths(): Promise<string[]> {
    return Promise.resolve(this.paths);
  }
  writePaths(paths: readonly string[]): Promise<void> {
    this.written = [...paths];
    return Promise.resolve();
  }
  writeBatch(
    entries: Parameters<ClipboardFilePort["writeBatch"]>[0],
  ): Promise<string[]> {
    this.batch = entries;
    const paths = entries.map((entry, index) =>
      "sourcePath" in entry
        ? entry.sourcePath
        : `C:\\Ascend\\clipboard\\${String(index + 1)}-${entry.fileName}`,
    );
    this.written = paths;
    return Promise.resolve(paths);
  }
}

class MemoryVault implements ClipboardVault {
  items: StoredClipboardItem[] = [];
  saves = 0;
  load(): Promise<StoredClipboardItem[]> {
    return Promise.resolve(this.items);
  }
  save(items: StoredClipboardItem[]): Promise<void> {
    this.items = structuredClone(items);
    this.saves += 1;
    return Promise.resolve();
  }
}

describe("clipboard history", () => {
  let clipboard: MemoryClipboard;
  let vault: MemoryVault;
  let files: MemoryFiles;
  let opened: string[];

  beforeEach(() => {
    clipboard = new MemoryClipboard();
    vault = new MemoryVault();
    files = new MemoryFiles();
    opened = [];
  });

  const createHistory = (): Promise<ClipboardHistory> =>
    ClipboardHistory.create(
      "unused",
      clipboard,
      vault,
      Date.now,
      files,
      (sourcePath) => {
        opened.push(sourcePath);
        return Promise.resolve("");
      },
    );

  it("does not save the startup value, then captures and copies a new value", async () => {
    const history = await createHistory();
    await history.capture();
    expect(history.snapshot().items).toHaveLength(0);
    clipboard.text = "a newly copied thought";
    await history.capture();
    expect(history.snapshot().items[0]?.preview).toBe("a newly copied thought");
    const item = history.snapshot().items[0];
    expect(item).toBeDefined();
    if (item) await history.request({ action: "copy", id: item.id });
    expect(clipboard.written).toBe("a newly copied thought");
    await history.close();
    expect(vault.saves).toBeGreaterThan(0);
  });

  it("honors Windows clipboard-history exclusion formats", async () => {
    const history = await createHistory();
    clipboard.formats = [
      "text/plain",
      "ExcludeClipboardContentFromMonitorProcessing",
    ];
    clipboard.text = "password";
    await history.capture();
    expect(history.snapshot().items).toHaveLength(0);
    expect(history.snapshot().status).toContain("protected");
    await history.close();
  });

  it("captures and restores images", async () => {
    const history = await createHistory();
    clipboard.formats = ["image/png"];
    clipboard.image = Buffer.from("png-image");
    await history.capture();
    const item = history.snapshot().items[0];
    expect(item?.kind).toBe("image");
    expect(item?.imageDataUrl).toContain("data:image/png;base64,");
    if (item) await history.request({ action: "copy", id: item.id });
    expect(clipboard.writtenImage).toEqual(Buffer.from("png-image"));
    await history.close();
  });

  it("classifies and restores copied media files", async () => {
    const history = await createHistory();
    clipboard.formats = ["FileNameW"];
    clipboard.file = Buffer.from("C:\\Recordings\\voice.mp3\0", "utf16le");
    files.paths = ["C:\\Recordings\\voice.mp3"];
    await history.capture();
    const item = history.snapshot().items[0];
    expect(item?.kind).toBe("audio");
    expect(item?.title).toBe("voice.mp3");
    if (item) await history.request({ action: "copy", id: item.id });
    expect(files.written).toEqual(["C:\\Recordings\\voice.mp3"]);
    await history.close();
  });

  it("distinguishes successive Windows files by their actual paths", async () => {
    const history = await createHistory();
    clipboard.formats = ["text/uri-list"];
    clipboard.file = Buffer.from("same-wrapper");
    files.paths = ["C:\\Documents\\first.pdf"];
    await history.capture();
    files.paths = ["C:\\Documents\\second.mp4"];
    await history.capture();
    expect(history.snapshot().items.map((item) => item.title)).toEqual([
      "second.mp4",
      "first.pdf",
    ]);
    await history.close();
  });

  it("keeps files native when a recent batch also contains text", async () => {
    const history = await createHistory();
    clipboard.text = "A note for the chat";
    await history.capture();
    clipboard.formats = ["text/uri-list"];
    files.paths = ["C:\\Documents\\brief.pdf"];
    await history.capture();
    await history.request({ action: "copyRecent", count: 2 });
    expect(files.batch).toHaveLength(2);
    expect(files.batch?.[0]).toMatchObject({
      fileName: "A note for the chat.txt",
    });
    expect(files.batch?.[1]).toEqual({
      sourcePath: "C:\\Documents\\brief.pdf",
    });
    expect(clipboard.written).not.toContain("brief.pdf");
    await history.close();
  });

  it("exports in-memory images as files in a mixed attachment batch", async () => {
    const history = await createHistory();
    clipboard.formats = ["image/png"];
    clipboard.image = Buffer.from("png-image");
    await history.capture();
    clipboard.formats = ["text/uri-list"];
    files.paths = ["C:\\Documents\\recording.mp4"];
    await history.capture();
    await history.request({ action: "copyRecent", count: 2 });
    expect(files.batch).toHaveLength(2);
    expect(files.batch?.[0]).toMatchObject({ fileName: "Copied image.png" });
    expect(files.batch?.[1]).toEqual({
      sourcePath: "C:\\Documents\\recording.mp4",
    });
    await history.close();
  });

  it("opens an existing source file from its Windows path", async () => {
    vault.items = [
      {
        id: "00000000-1234-1234-1234-123456789abc",
        kind: "file",
        title: "runtime",
        preview: process.execPath,
        createdAt: Date.now(),
        byteSize: 0,
        sourcePaths: [process.execPath],
      },
    ];
    const history = await createHistory();
    const item = vault.items[0];
    expect(item).toBeDefined();
    if (item) await history.request({ action: "open", id: item.id });
    expect(opened).toEqual([process.execPath]);
    await history.close();
  });
});

describe("clipboard history helpers", () => {
  it("recognizes Windows Explorer file-drop formats before image formats", () => {
    expect(isFileClipboard(["image/png", "Shell IDList Array"])).toBe(true);
    expect(isFileClipboard(["text/uri-list"])).toBe(true);
  });

  it("recognizes an explicit zero history flag", () => {
    expect(
      excludesClipboardHistory(["CanIncludeInClipboardHistory"], () =>
        Buffer.alloc(4),
      ),
    ).toBe(true);
  });

  it("keeps only the newest 100 entries in the current session", () => {
    const values: StoredClipboardItem[] = Array.from(
      { length: 105 },
      (_, index) => ({
        id: `${String(index).padStart(8, "0")}-1234-1234-1234-123456789abc`,
        kind: "text",
        title: String(index),
        preview: String(index),
        createdAt: Date.now(),
        byteSize: 1,
        text: String(index),
      }),
    );
    expect(retainClipboardItems(values)).toHaveLength(100);
    expect(retainClipboardItems(values)).not.toContainEqual(values[104]);
  });

  it("removes entries older than seven days", () => {
    const now = Date.now();
    const value: StoredClipboardItem = {
      id: "00000000-1234-1234-1234-123456789abc",
      kind: "text",
      title: "old",
      preview: "old",
      createdAt: now - 8 * 24 * 60 * 60 * 1000,
      byteSize: 3,
      text: "old",
    };
    expect(retainClipboardItems([value], now)).toEqual([]);
  });
});
