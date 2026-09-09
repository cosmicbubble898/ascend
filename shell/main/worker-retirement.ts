interface Worker {
  once(event: "close", callback: () => void): unknown;
  kill(): boolean;
  stdin: { end(): unknown };
}

// The AppContainer inherits the pipes. "close", unlike supervisor "exit",
// confirms those handles have closed before another model may be started.
export function retireWorker(child: Worker, force: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      reject(new Error("worker_timeout"));
    }, 10000);
    const escalation = force ? undefined : setTimeout(() => child.kill(), 5000);
    child.once("close", () => {
      clearTimeout(deadline);
      clearTimeout(escalation);
      resolve();
    });
    if (force) child.kill();
    else child.stdin.end();
  });
}
