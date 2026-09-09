import { open } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";

const FORMATS: Readonly<Record<string, string>> = {
  ".wav": "wav",
  ".mp3": "mp3",
  ".m4a": "mov",
  ".mp4": "mov",
  ".aac": "aac",
  ".flac": "flac",
};

export function isLocalPath(value: string): boolean {
  return (
    /^[a-z]:\\/i.test(value) &&
    !value.slice(2).includes(":") &&
    !value.includes("\0")
  );
}

export function audioFormat(value: string): string | undefined {
  return isLocalPath(value)
    ? FORMATS[path.win32.extname(value).toLowerCase()]
    : undefined;
}

export async function writeTranscript(
  target: string,
  text: string,
  source: Stats,
): Promise<void> {
  if (!isLocalPath(target) || path.extname(target).toLowerCase() !== ".txt")
    throw new Error("save_failed");
  // Open without truncating. Compare file identity after opening to defeat source aliases/races.
  const output = await open(target, "r+").catch(async (error: unknown) => {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return open(target, "wx");
    }
    throw new Error("save_failed");
  });
  try {
    const destination = await output.stat();
    if (
      !destination.isFile() ||
      (destination.dev === source.dev && destination.ino === source.ino)
    ) {
      throw new Error("save_failed");
    }
    await output.truncate(0);
    await output.writeFile(text, "utf8");
    await output.sync();
  } finally {
    await output.close();
  }
}
