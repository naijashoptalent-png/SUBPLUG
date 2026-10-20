import { AsyncLocalStorage } from 'async_hooks';

/**
 * In-process serialization for wallet mutations when MongoDB transactions are
 * unavailable (standalone development database). Production refuses to start
 * without a replica set unless explicitly overridden.
 *
 * Re-entrant: a wallet operation that is already executing inside the same
 * key's critical section (e.g. purchase creation calling the ledger service)
 * continues without deadlocking.
 */
const locks = new Map<string, Promise<unknown>>();
const heldKeys = new AsyncLocalStorage<Set<string>>();

export async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const currentHeld = heldKeys.getStore();
  if (currentHeld?.has(key)) return fn();

  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  locks.set(key, tail);

  await previous.catch(() => undefined);
  const nextHeld = new Set(currentHeld ?? []);
  nextHeld.add(key);
  try {
    return await heldKeys.run(nextHeld, fn);
  } finally {
    release();
    if (locks.get(key) === tail) locks.delete(key);
  }
}
