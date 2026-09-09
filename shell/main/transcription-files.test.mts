import { mkdtemp, open, readFile, rm, link } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { audioFormat, writeTranscript } from "./transcription-files.js";

it("refuses network paths, alternate streams and unsupported media", () => {
  expect(audioFormat("https://example.com/a.wav")).toBeUndefined();
  expect(audioFormat("\\\\server\\share\\a.wav")).toBeUndefined();
  expect(audioFormat("C:\\audio.wav:secret.wav")).toBeUndefined();
  expect(audioFormat("C:\\audio.m3u")).toBeUndefined();
  expect(audioFormat("D:\\Meeting.M4A")).toBe("mov");
});

it("accepts MP4 recordings from local folders with spaces", () => {
  expect(
    audioFormat("C:\\Users\\samar\\Downloads\\Telegram Desktop\\1_001.mp4"),
  ).toBe("mov");
  expect(audioFormat("D:\\Meeting.MP4")).toBe("mov");
});

it("cannot overwrite the source through a hard link", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "ascend-export-test-"),
  );
  const sourcePath = path.join(directory, "public.wav");
  const source = await open(sourcePath, "w+");
  try {
    await source.writeFile("original");
    const alias = path.join(directory, "alias.txt");
    await link(sourcePath, alias);
    await expect(
      writeTranscript(alias, "transcript", await source.stat()),
    ).rejects.toThrow("save_failed");
    expect(await readFile(sourcePath, "utf8")).toBe("original");
    const target = path.join(directory, "transcript.txt");
    await writeTranscript(
      target,
      "Private words.\n\nNext paragraph.\n",
      await source.stat(),
    );
    expect(await readFile(target, "utf8")).toBe(
      "Private words.\n\nNext paragraph.\n",
    );
  } finally {
    await source.close();
    await rm(directory, { recursive: true, force: true });
  }
});
