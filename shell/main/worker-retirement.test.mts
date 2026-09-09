import { EventEmitter } from "node:events";
import { afterEach, expect, it, vi } from "vitest";
import { retireWorker } from "./worker-retirement.js";

function worker() {
  return Object.assign(new EventEmitter(), {
    stdin: { end: vi.fn() },
    kill: vi.fn(() => true),
  });
}
afterEach(() => vi.useRealTimers());
it("does not allow reuse merely because the supervisor exits", async () => {
  const child = worker();
  let done = false;
  const waiting = retireWorker(child, true).then(() => {
    done = true;
  });
  expect(child.kill).toHaveBeenCalledOnce();
  child.emit("exit", 1);
  await Promise.resolve();
  expect(done).toBe(false);
  child.emit("close", 1);
  await waiting;
  expect(done).toBe(true);
});
it("allows normal cleanup before escalating a stuck worker", async () => {
  vi.useFakeTimers();
  const child = worker();
  const waiting = retireWorker(child, false);
  expect(child.stdin.end).toHaveBeenCalledOnce();
  expect(child.kill).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(5000);
  expect(child.kill).toHaveBeenCalledOnce();
  child.emit("close", 0);
  await waiting;
});
it("fails visibly when shutdown cannot be confirmed", async () => {
  vi.useFakeTimers();
  const child = worker();
  const waiting = expect(retireWorker(child, true)).rejects.toThrow(
    "worker_timeout",
  );
  await vi.advanceTimersByTimeAsync(10000);
  await waiting;
});
