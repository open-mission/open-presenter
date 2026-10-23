export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
}

export interface FrameCoalescer<T> {
  push(value: T): void;
  flush(): void;
  cancel(): void;
}

const defaultScheduler: FrameScheduler = {
  request(callback) {
    if (typeof requestAnimationFrame === "function") {
      return requestAnimationFrame(callback);
    }
    return setTimeout(() => callback(Date.now()), 16) as unknown as number;
  },
  cancel(handle) {
    if (typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(handle);
      return;
    }
    clearTimeout(handle);
  },
};

export function createFrameCoalescer<T>(
  apply: (value: T) => void,
  scheduler: FrameScheduler = defaultScheduler,
): FrameCoalescer<T> {
  let handle: number | null = null;
  let pending: T | undefined;
  let hasPending = false;

  function run(): void {
    handle = null;
    if (!hasPending) return;
    const value = pending as T;
    pending = undefined;
    hasPending = false;
    apply(value);
  }

  return {
    push(value) {
      pending = value;
      hasPending = true;
      if (handle === null) handle = scheduler.request(run);
    },
    flush() {
      if (handle !== null) {
        scheduler.cancel(handle);
        handle = null;
      }
      run();
    },
    cancel() {
      if (handle !== null) {
        scheduler.cancel(handle);
        handle = null;
      }
      pending = undefined;
      hasPending = false;
    },
  };
}