import type { TranscriptionBridge } from "./transcription-contract";
import type { ProductivityBridge } from "./productivity-contract";
import type { ClipboardHistoryBridge } from "./clipboard-contract";
import type { WindowBridge } from "./window-contract";
declare global {
  interface Window {
    ascend: TranscriptionBridge;
    productivity: ProductivityBridge;
    clipboardHistory: ClipboardHistoryBridge;
    ascendWindow: WindowBridge;
  }
}
