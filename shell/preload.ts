import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  ProductivityBridge,
  ProductivitySnapshot,
} from "./productivity-contract";
import type {
  TranscriptionBridge,
  TranscriptionSnapshot,
} from "./transcription-contract";
import type {
  ClipboardHistoryBridge,
  ClipboardPreview,
  ClipboardHistorySnapshot,
} from "./clipboard-contract";
import type { WindowBridge } from "./window-contract";

const bridge: TranscriptionBridge = {
  state: () =>
    ipcRenderer.invoke("transcription:state") as Promise<TranscriptionSnapshot>,
  choose: () => ipcRenderer.invoke("transcription:choose") as Promise<void>,
  start: (token) =>
    ipcRenderer.invoke("transcription:start", token) as Promise<void>,
  cancel: () => ipcRenderer.invoke("transcription:cancel") as Promise<void>,
  clear: () => ipcRenderer.invoke("transcription:clear") as Promise<void>,
  save: () => ipcRenderer.invoke("transcription:save") as Promise<boolean>,
  subscribe: (callback) => {
    const listener = (
      _event: IpcRendererEvent,
      state: TranscriptionSnapshot,
    ): void => {
      callback(state);
    };
    ipcRenderer.on("transcription:state", listener);
    return () => {
      ipcRenderer.removeListener("transcription:state", listener);
    };
  },
};
contextBridge.exposeInMainWorld("ascend", Object.freeze(bridge));
const productivity: ProductivityBridge = {
  request: (command) =>
    ipcRenderer.invoke(
      "productivity:request",
      command,
    ) as Promise<ProductivitySnapshot>,
};
contextBridge.exposeInMainWorld("productivity", Object.freeze(productivity));
const clipboardHistory: ClipboardHistoryBridge = {
  request: (command) =>
    ipcRenderer.invoke(
      "clipboard:request",
      command,
    ) as Promise<ClipboardHistorySnapshot>,
  preview: (id) =>
    ipcRenderer.invoke("clipboard:preview", id) as Promise<ClipboardPreview>,
};
contextBridge.exposeInMainWorld(
  "clipboardHistory",
  Object.freeze(clipboardHistory),
);
const ascendWindow: WindowBridge = {
  zoom: (action) =>
    ipcRenderer.invoke("window:zoom", action) as Promise<number>,
};
contextBridge.exposeInMainWorld("ascendWindow", Object.freeze(ascendWindow));
