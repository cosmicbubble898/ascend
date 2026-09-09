export type ClipboardKind = "text" | "image" | "audio" | "video" | "file";

export interface ClipboardHistoryItem {
  id: string;
  kind: ClipboardKind;
  title: string;
  preview: string;
  createdAt: number;
  byteSize: number;
  imageDataUrl?: string;
  hasSourceFile?: boolean;
}

export interface ClipboardHistorySnapshot {
  items: ClipboardHistoryItem[];
  maximumItems: number;
  retentionDays: number;
  status: string;
}

export interface ClipboardPreview {
  id: string;
  imageDataUrl: string;
}

export type ClipboardHistoryCommand =
  | { action: "state" }
  | { action: "copy"; id: string }
  | { action: "open"; id: string }
  | { action: "copyRecent"; count: number }
  | { action: "delete"; id: string }
  | { action: "clear" };

export interface ClipboardHistoryBridge {
  request(command: ClipboardHistoryCommand): Promise<ClipboardHistorySnapshot>;
  preview(id: string): Promise<ClipboardPreview>;
}

export const validClipboardItemId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

export function validClipboardHistoryCommand(
  value: unknown,
): value is ClipboardHistoryCommand {
  if (typeof value !== "object" || value === null) return false;
  const command = value as Record<string, unknown>;
  if (command.action === "state" || command.action === "clear") {
    return Object.keys(command).length === 1;
  }
  if (
    command.action === "copy" ||
    command.action === "open" ||
    command.action === "delete"
  ) {
    return (
      Object.keys(command).length === 2 && validClipboardItemId(command.id)
    );
  }
  return (
    command.action === "copyRecent" &&
    Object.keys(command).length === 2 &&
    Number.isInteger(command.count) &&
    Number(command.count) >= 1 &&
    Number(command.count) <= 20
  );
}
