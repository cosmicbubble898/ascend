import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { open, realpath, type FileHandle } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import {
  app,
  dialog,
  type BrowserWindow,
  type IpcMainInvokeEvent,
} from "electron";
import { audioFormat, writeTranscript } from "./transcription-files";
import { TranscriptionState } from "./transcription-state";
import { retireWorker } from "./worker-retirement";

interface Source {
  handle: FileHandle;
  stat: Stats;
  format: string;
}

export function trustedSender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
): boolean {
  return (
    event.sender === window.webContents &&
    event.senderFrame === window.webContents.mainFrame &&
    event.senderFrame.url === "ascend://app/"
  );
}

export class TranscriptionSession {
  readonly state = new TranscriptionState();
  private source: Source | undefined;
  private child: ChildProcessWithoutNullStreams | undefined;
  private watchdog: NodeJS.Timeout | undefined;
  private deadline = 0;
  private lastProgress = 0;
  private dialogOpen = false;
  private epoch = 0;
  private retiring: Promise<void> = Promise.resolve();
  private runtimePrepared = false;

  constructor(
    private readonly window: BrowserWindow,
    private readonly root: string,
  ) {}
  private notify(): void {
    if (!this.window.isDestroyed())
      this.window.webContents.send(
        "transcription:state",
        this.state.snapshot(),
      );
  }
  private releaseWorker(force = true): void {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = undefined;
    const child = this.child;
    this.child = undefined;
    if (child) {
      this.retiring = retireWorker(child, force);
      // A subsequent start observes any teardown failure; never spawn on uncertainty.
      void this.retiring.catch(() => undefined);
    }
  }
  private finishCancellation(): void {
    this.releaseWorker();
    // No further reads or results are accepted. GPU teardown may finish later;
    // start() still waits for it before granting the next worker any audio.
    this.state.canceled();
    this.notify();
  }
  private fail(code: string): void {
    this.releaseWorker();
    this.state.fail(code);
    this.notify();
  }

  async choose(): Promise<void> {
    if (this.state.active || this.dialogOpen) return;
    this.dialogOpen = true;
    const epoch = this.epoch;
    let failure = "invalid_file";
    try {
      const result = await dialog.showOpenDialog(this.window, {
        title: "Choose an English recording",
        properties: ["openFile", "dontAddToRecent"],
        filters: [
          {
            name: "Audio and MP4 recordings",
            extensions: ["wav", "mp3", "m4a", "aac", "flac", "mp4"],
          },
        ],
      });
      if (result.canceled || !result.filePaths[0] || epoch !== this.epoch)
        return;
      const requested = result.filePaths[0];
      if (app.isPackaged && !this.runtimePrepared) {
        failure = "sandbox_unavailable";
        await promisify(execFile)(
          path.join(
            this.root,
            "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none/pythonw.exe",
          ),
          [
            "-I",
            "-B",
            path.join(this.root, "scripts/parakeet-sandbox.py"),
            "--setup",
          ],
          { windowsHide: true, timeout: 60000, maxBuffer: 1024 },
        );
        this.runtimePrepared = true;
        failure = "invalid_file";
      }
      if (!audioFormat(requested)) throw new Error("invalid_file");
      const resolved = await realpath(requested);
      const format = audioFormat(resolved);
      if (!format) throw new Error("invalid_file");
      const drive = await promisify(execFile)(
        path.join(
          this.root,
          "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none/pythonw.exe",
        ),
        [
          "-I",
          "-B",
          path.join(this.root, "scripts/parakeet-sandbox.py"),
          "--drive",
          resolved.slice(0, 3),
        ],
        { windowsHide: true, timeout: 5000, maxBuffer: 1024 },
      );
      if (!["2", "3"].includes(drive.stdout.trim()))
        throw new Error("invalid_file");
      const handle = await open(resolved, "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size <= 0 || stat.size > 16 * 1024 ** 3)
          throw new Error("invalid_file");
        if (epoch !== this.epoch) {
          await handle.close();
          return;
        }
        await this.source?.handle.close();
        this.source = { handle, stat, format };
        this.state.select({
          name: path.basename(requested),
          bytes: stat.size,
          token: randomUUID(),
        });
        this.notify();
      } catch {
        await handle.close();
        throw new Error("invalid_file");
      }
    } catch {
      this.state.fail(failure);
      this.notify();
    } finally {
      this.dialogOpen = false;
    }
  }

  async start(token: unknown): Promise<void> {
    if (
      typeof token !== "string" ||
      token.length > 64 ||
      !this.source ||
      this.dialogOpen
    )
      return;
    try {
      this.state.start(token);
    } catch {
      return;
    }
    const source = this.source;
    const epoch = ++this.epoch;
    this.notify();
    try {
      await this.retiring;
    } catch {
      if (epoch === this.epoch) {
        this.state.fail("worker_timeout");
        this.notify();
      }
      return;
    }
    if (epoch !== this.epoch) return;
    if (this.state.snapshot().stage === "canceling") {
      this.state.canceled();
      this.notify();
      return;
    }
    const python = path.join(
      this.root,
      "runtime/uv-python-0.11.29/cpython-3.13.14-windows-x86_64-none/pythonw.exe",
    );
    const child = spawn(
      python,
      [
        "-I",
        "-B",
        "-u",
        path.join(this.root, "scripts/parakeet-sandbox.py"),
        "--parent",
        String(process.pid),
      ],
      {
        cwd: this.root,
        windowsHide: true,
        stdio: "pipe",
        // The worker does not inherit service tokens, API keys, PYTHONPATH or shell credentials.
        env: {
          SystemRoot: process.env.SystemRoot ?? "C:\\Windows",
          WINDIR: process.env.WINDIR ?? "C:\\Windows",
          PATH: path.join(process.env.SystemRoot ?? "C:\\Windows", "System32"),
          USERPROFILE: process.env.USERPROFILE ?? "",
          LOCALAPPDATA: process.env.LOCALAPPDATA ?? "",
          CUDA_CACHE_DISABLE: "1",
          HF_HUB_OFFLINE: "1",
          HF_HUB_DISABLE_TELEMETRY: "1",
        },
      },
    );
    this.child = child;
    this.deadline = Date.now() + 4 * 3600 * 1000;
    this.lastProgress = Date.now();
    let buffer = "";
    let processing = Promise.resolve();
    const send = (message: object): void => {
      if (this.child === child && !child.stdin.destroyed)
        child.stdin.write(JSON.stringify(message) + "\n");
    };
    const handleMessage = async (line: string): Promise<void> => {
      if (epoch !== this.epoch || this.child !== child) return;
      const input: unknown = JSON.parse(line);
      if (typeof input !== "object" || input === null)
        throw new Error("worker_failed");
      const message = input as Record<string, unknown>;
      if (this.state.snapshot().stage === "canceling") {
        send({ type: "cancel" });
        return;
      }
      if (message.type === "read") {
        if (
          this.state.snapshot().stage !== "running" ||
          typeof message.offset !== "number" ||
          typeof message.length !== "number" ||
          !Number.isSafeInteger(message.offset) ||
          !Number.isSafeInteger(message.length) ||
          message.offset < 0 ||
          message.length <= 0 ||
          message.length > 1024 ** 2 ||
          message.offset + message.length > source.stat.size
        )
          throw new Error("worker_failed");
        const current = await source.handle.stat();
        if (
          current.size !== source.stat.size ||
          current.mtimeMs !== source.stat.mtimeMs
        ) {
          this.fail("source_changed");
          return;
        }
        const bytes = Buffer.alloc(message.length);
        const result = await source.handle.read(
          bytes,
          0,
          bytes.length,
          message.offset,
        );
        if (result.bytesRead !== bytes.length) {
          this.fail("source_changed");
          return;
        }
        if (epoch === this.epoch)
          send({ type: "data", data: bytes.toString("base64") });
      } else {
        this.state.accept(message);
        this.lastProgress = Date.now();
        if (message.type === "ready")
          send({
            type: "start",
            bytes: source.stat.size,
            format: source.format,
          });
        this.notify();
        if (!this.state.active)
          this.releaseWorker(this.state.snapshot().stage !== "complete");
      }
    };
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (part: string) => {
      if (epoch !== this.epoch || this.child !== child) return;
      buffer += part;
      if (buffer.length > 2 * 1024 ** 2) {
        this.fail("worker_failed");
        return;
      }
      let end: number;
      while ((end = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        processing = processing
          .then(() => handleMessage(line))
          .catch(() => {
            if (epoch === this.epoch) this.fail("worker_failed");
          });
      }
    });
    child.stderr.resume(); // Discard content-bearing native exception messages.
    child.stdin.on("error", () => {
      /* Exit handler owns the terminal state. */
    });
    child.on("error", () => {
      if (epoch === this.epoch && this.child === child)
        this.fail("worker_failed");
    });
    child.on("exit", () => {
      void processing.finally(() => {
        if (epoch !== this.epoch || this.child !== child) return;
        if (this.state.snapshot().stage === "canceling") {
          this.finishCancellation();
        } else if (this.state.active) {
          this.fail("worker_failed");
        }
      });
    });
    this.watchdog = setInterval(() => {
      const stage = this.state.snapshot().stage;
      const stalled = Date.now() - this.lastProgress;
      if (stage === "canceling" && stalled >= 5000) {
        this.finishCancellation();
      } else if (
        Date.now() > this.deadline ||
        stalled > (stage === "loading" ? 180000 : 120000)
      ) {
        this.fail("worker_timeout");
      }
    }, 250);
    this.notify();
  }

  cancel(): void {
    if (!this.state.active || this.state.snapshot().stage === "canceling")
      return;
    this.state.cancel();
    this.lastProgress = Date.now();
    this.child?.stdin.write('{"type":"cancel"}\n');
    this.notify();
  }
  async clear(): Promise<void> {
    ++this.epoch;
    this.releaseWorker();
    const source = this.source;
    this.source = undefined;
    this.state.clear();
    this.notify();
    await source?.handle.close();
  }
  async save(): Promise<boolean> {
    const epoch = this.epoch;
    const snapshot = this.state.snapshot();
    const source = this.source;
    if (!source || this.state.active || !snapshot.text || this.dialogOpen)
      return false;
    this.dialogOpen = true;
    try {
      const result = await dialog.showSaveDialog(this.window, {
        title:
          snapshot.stage === "complete"
            ? "Save transcript"
            : "Save partial transcript",
        defaultPath: path.join(
          app.getPath("downloads"),
          snapshot.stage === "complete"
            ? "Ascend transcript.txt"
            : "Ascend partial transcript.txt",
        ),
        filters: [{ name: "Text document", extensions: ["txt"] }],
        properties: ["showOverwriteConfirmation", "dontAddToRecent"],
      });
      if (result.canceled || !result.filePath || epoch !== this.epoch)
        return false;
      await writeTranscript(result.filePath, snapshot.text + "\n", source.stat);
      return true;
    } catch {
      this.state.fail("save_failed");
      this.notify();
      return false;
    } finally {
      this.dialogOpen = false;
    }
  }
}
