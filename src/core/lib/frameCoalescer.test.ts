import test from "node:test";
import assert from "node:assert/strict";
import {
  createFrameCoalescer,
  type FrameCoalescer,
  type FrameScheduler,
} from "./frameCoalescer.ts";

function fakeScheduler() {
  let nextId = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const scheduler: FrameScheduler = {
    request(callback) {
      nextId += 1;
      callbacks.set(nextId, callback);
      return nextId;
    },
    cancel(handle) {
      callbacks.delete(handle);
    },
  };
  return {
    scheduler,
    tick() {
      const batch = [...callbacks.values()];
      callbacks.clear();
      for (const callback of batch) callback(0);
    },
    pending() {
      return callbacks.size;
    },
  };
}

test("aplica apenas o último valor por frame", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  const coalescer = createFrameCoalescer<number>((value) => seen.push(value), fake.scheduler);

  coalescer.push(1);
  coalescer.push(2);
  coalescer.push(3);

  assert.deepEqual(seen, []);
  assert.equal(fake.pending(), 1);
  fake.tick();
  assert.deepEqual(seen, [3]);
});

test("um push durante o apply agenda o próximo frame", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  let coalescer: FrameCoalescer<number>;
  coalescer = createFrameCoalescer<number>((value) => {
    seen.push(value);
    if (value === 1) coalescer.push(2);
  }, fake.scheduler);

  coalescer.push(1);
  fake.tick();
  assert.deepEqual(seen, [1]);
  assert.equal(fake.pending(), 1);

  fake.tick();
  assert.deepEqual(seen, [1, 2]);
});

test("cancel descarta o valor pendente", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  const coalescer = createFrameCoalescer<number>((value) => seen.push(value), fake.scheduler);

  coalescer.push(1);
  coalescer.cancel();
  fake.tick();

  assert.deepEqual(seen, []);
  assert.equal(fake.pending(), 0);
});

test("flush aplica imediatamente e cancela o frame", () => {
  const fake = fakeScheduler();
  const seen: number[] = [];
  const coalescer = createFrameCoalescer<number>((value) => seen.push(value), fake.scheduler);

  coalescer.push(7);
  coalescer.flush();
  fake.tick();

  assert.deepEqual(seen, [7]);
  assert.equal(fake.pending(), 0);
});

test("flush sem valor não chama apply", () => {
  const fake = fakeScheduler();
  let calls = 0;
  const coalescer = createFrameCoalescer<number>(() => {
    calls += 1;
  }, fake.scheduler);

  coalescer.flush();
  assert.equal(calls, 0);
});