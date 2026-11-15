/** A separate localStorage per simulated phone. */
export function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => { map.delete(k); },
    setItem: (k, v) => { map.set(k, String(v)); },
  };
}

export const userA = { id: 'user-a', displayName: 'Ana', createdAt: '2026-11-15T10:00:00.000Z' };
export const userB = { id: 'user-b', displayName: 'Ben', createdAt: '2026-11-15T10:00:00.000Z' };
