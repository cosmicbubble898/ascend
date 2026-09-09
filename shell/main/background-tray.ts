import { Menu, nativeImage, Tray, type BrowserWindow } from "electron";
import type { ProductivitySnapshot } from "../productivity-contract";

export function trayStatus(state?: ProductivitySnapshot): string {
  if (!state || state.error) return "Tracking unavailable · Retrying";
  if (state.pausedUntil > Date.now())
    return "Paused until " + new Date(state.pausedUntil).toLocaleString();
  return state.running ? "Tracking activity" : "Tracking unavailable";
}

function fallbackIcon(paused: boolean) {
  const pixels = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const arrow =
        (x >= 4 && x <= 11 && Math.abs(x + y - 15) <= 1) ||
        (x >= 6 && x <= 11 && y >= 3 && y <= 4) ||
        (x >= 11 && x <= 12 && y >= 3 && y <= 9);
      const offset = (y * 16 + x) * 4;
      pixels[offset] = arrow ? 255 : paused ? 35 : 65;
      pixels[offset + 1] = arrow ? 255 : paused ? 120 : 87;
      pixels[offset + 2] = arrow ? 255 : paused ? 180 : 45;
      pixels[offset + 3] = 255;
    }
  }
  return nativeImage.createFromBitmap(pixels, { width: 16, height: 16 });
}

function appIcon(iconPath: string, paused: boolean) {
  const branded = nativeImage.createFromPath(iconPath);
  return branded.isEmpty()
    ? fallbackIcon(paused)
    : branded.resize({ width: 16, height: 16, quality: "best" });
}

export function createBackgroundTray(window: BrowserWindow, iconPath: string) {
  const tray = new Tray(appIcon(iconPath, false));
  const show = (): void => {
    if (window.isDestroyed()) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };
  tray.on("click", show);
  tray.on("double-click", show);
  let last = "";
  const update = (state?: ProductivitySnapshot): void => {
    if (tray.isDestroyed()) return;
    const status = trayStatus(state);
    if (last === status) return;
    last = status;
    tray.setToolTip("Ascend · " + status);
    tray.setImage(appIcon(iconPath, !state?.running));
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Ascend", click: show },
        { label: status, enabled: false },
        { type: "separator" },
        { label: "Pause tracking in Ascend Settings", click: show },
      ]),
    );
  };
  update();
  return {
    update,
    destroy: () => {
      tray.destroy();
    },
  };
}
