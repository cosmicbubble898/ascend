import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { app, Notification, type BrowserWindow } from "electron";
import type {
  ProductivityCommand,
  ProductivitySnapshot,
} from "../productivity-contract";

interface Pending {
  resolve: (state: ProductivitySnapshot) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class ProductivitySession {
  private child: ChildProcessWithoutNullStreams | undefined;
  private readonly pending = new Map<number, Pending>();
  private serial = 0;
  private closing = false;
  private failed = false;
  private readonly heartbeat: NodeJS.Timeout;
  private readonly shownNotices = new Set<string>();
  private notification: Notification | undefined;
  private notificationStatus =
    "Pause reminders repeat every 30 minutes, including while Ascend is in the tray.";

  constructor(
    private readonly window: BrowserWindow,
    private readonly root: string,
    private readonly statusChanged: (
      state?: ProductivitySnapshot,
    ) => void = () => undefined,
    private readonly startupStatus: () => string = () => "",
  ) {
    this.heartbeat = setInterval(() => {
      void this.refreshBackground().catch(() => undefined);
    }, 10000);
  }

  refreshBackground(): Promise<ProductivitySnapshot> {
    if (!this.child && !this.closing) this.failed = false;
    const start = new Date().setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    // Querying a fresh worker respects its saved pause. "start" would clear it.
    return this.request({ action: "state", start, end: end.getTime() });
  }

  private showNotices(state: ProductivitySnapshot): void {
    for (const notice of state.notices) {
      if (this.shownNotices.has(notice.id)) continue;
      this.shownNotices.add(notice.id);
      if (this.shownNotices.size > 100)
        this.shownNotices.delete(this.shownNotices.values().next().value ?? "");
      if (
        !app.commandLine.hasSwitch("user-data-dir") &&
        Notification.isSupported()
      ) {
        this.notification = new Notification({
          title: notice.title,
          body: notice.body,
          silent: true,
        });
        this.notification.on("click", () => {
          if (!this.window.isDestroyed()) {
            this.window.show();
            this.window.focus();
          }
        });
        this.notification.on("show", () => {
          this.notificationStatus =
            "The latest desktop reminder was handed to Windows.";
        });
        this.notification.on("failed", () => {
          this.notificationStatus =
            "Windows did not accept the latest desktop reminder. The in-app countdown remains visible.";
        });
        this.notification.show();
      } else if (!Notification.isSupported()) {
        this.notificationStatus =
          "Desktop reminders are unavailable here. The in-app countdown remains visible.";
      }
      if (notice.kind === "focus") {
        const start = new Date().setHours(0, 0, 0, 0);
        void this.request({
          action: "notice_seen",
          noticeId: notice.id,
          start,
          end: start + 86400000,
        }).catch(() => undefined);
      }
    }
  }

  private fail(): void {
    this.failed = !this.closing;
    if (!this.closing) this.statusChanged();
    for (const waiting of this.pending.values()) {
      clearTimeout(waiting.timer);
      waiting.reject(new Error("productivity_unavailable"));
    }
    this.pending.clear();
  }

  private launch(): ChildProcessWithoutNullStreams {
    if (this.child) return this.child;
    const executable = path.join(
      this.root,
      "runtime",
      "uv-python-0.11.29",
      "cpython-3.13.14-windows-x86_64-none",
      "python.exe",
    );
    const args = [
      "-I",
      "-X",
      "utf8",
      "-u",
      "-B",
      path.join(this.root, "scripts/productivity-entry.py"),
      "ascend_engine.productivity.service",
    ];
    if (app.commandLine.hasSwitch("user-data-dir")) {
      args.push(
        path.join(app.getPath("userData"), "productivity", "activity.vault"),
      );
    }
    const env: NodeJS.ProcessEnv = {};
    for (const key of [
      "SystemRoot",
      "WINDIR",
      "TEMP",
      "TMP",
      "USERPROFILE",
      "LOCALAPPDATA",
      "APPDATA",
    ]) {
      if (process.env[key]) env[key] = process.env[key];
    }
    if (app.commandLine.hasSwitch("user-data-dir"))
      env.ASCEND_DISABLE_CLOUD = "1";
    const child = spawn(executable, args, {
      cwd: this.root,
      windowsHide: true,
      env,
      stdio: "pipe",
    });
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stderr.resume();
    let buffer = "";
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      if (Buffer.byteLength(buffer) > 4000000) {
        child.kill();
        return;
      }
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const response = JSON.parse(line) as {
            id?: number;
            error?: string;
            state?: ProductivitySnapshot;
          };
          if (typeof response.id !== "number")
            throw new Error("invalid_response");
          const waiting = this.pending.get(response.id);
          if (!waiting) continue;
          this.pending.delete(response.id);
          clearTimeout(waiting.timer);
          if (response.error || !response.state)
            waiting.reject(new Error("productivity_unavailable"));
          else {
            this.showNotices(response.state);
            response.state.notificationStatus = this.notificationStatus;
            response.state.startupStatus = this.startupStatus();
            this.statusChanged(response.state);
            if (!this.window.isDestroyed()) {
              this.window.setTitle(
                response.state.running
                  ? "Ascend — Tracking activity"
                  : "Ascend",
              );
            }
            waiting.resolve(response.state);
          }
        } catch {
          child.kill();
        }
      }
    });
    child.on("error", () => {
      this.fail();
    });
    child.on("close", () => {
      if (this.child === child) this.child = undefined;
      this.fail();
      if (!this.window.isDestroyed())
        this.window.setTitle("Ascend — Tracking stopped");
    });
    child.stdin.on("error", () => {
      this.fail();
    });
    return child;
  }

  request(command: ProductivityCommand): Promise<ProductivitySnapshot> {
    if (this.failed) {
      if (command.action !== "start")
        return Promise.reject(new Error("productivity_unavailable"));
      this.failed = false;
    }
    if (this.closing || this.pending.size >= 32)
      return Promise.reject(new Error("productivity_unavailable"));
    const child = this.launch();
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("productivity_unavailable"));
        child.kill();
      }, 8000);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ ...command, id }) + "\n");
    });
  }

  async close(): Promise<void> {
    if (this.closing) return;
    this.closing = true;
    clearInterval(this.heartbeat);
    const child = this.child;
    if (child) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          child.kill();
          resolve();
        }, 5000);
        child.once("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        child.stdin.end();
      });
    }
    this.fail();
  }
}
