export const MAX_SHUFFLE_SEED = 0xffffffff;

export function parseShuffleSeed(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;

  const seed = Number(value);
  return Number.isSafeInteger(seed) && seed <= MAX_SHUFFLE_SEED ? seed : null;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function deterministicShuffle<T>(
  items: readonly T[],
  seed: number,
): T[] {
  const queue = [...items];
  const random = createSeededRandom(seed);

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [queue[index], queue[swapIndex]] = [queue[swapIndex], queue[index]];
  }

  return queue;
}

let fallbackCounter = 0;

export function generateShuffleSeed(): number {
  try {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  } catch {
    fallbackCounter = (fallbackCounter + 1) >>> 0;
    return (Date.now() ^ fallbackCounter) >>> 0;
  }
}
