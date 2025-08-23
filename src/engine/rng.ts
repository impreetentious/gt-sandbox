export interface SeededRng {
  readonly next: () => number;
  readonly integer: (
    minimumInclusive: number,
    maximumExclusive: number,
  ) => number;
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer.`);
  }
}

/** mulberry32 with an explicit seed; the only randomness source for the engine. */
export function createRng(seed: number): SeededRng {
  assertSafeInteger(seed, "seed");
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const integer = (
    minimumInclusive: number,
    maximumExclusive: number,
  ): number => {
    assertSafeInteger(minimumInclusive, "minimumInclusive");
    assertSafeInteger(maximumExclusive, "maximumExclusive");

    if (maximumExclusive <= minimumInclusive) {
      throw new RangeError(
        "maximumExclusive must be greater than minimumInclusive.",
      );
    }

    return (
      minimumInclusive +
      Math.floor(next() * (maximumExclusive - minimumInclusive))
    );
  };

  return { next, integer };
}
