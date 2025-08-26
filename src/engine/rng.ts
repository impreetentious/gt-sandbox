export interface SeededRng {
  readonly next: () => number;
  readonly integer: (
    minimumInclusive: number,
    maximumExclusive: number,
  ) => number;
}

/** Identifies an event-addressed random stream in a repeated-game match. */
export interface RngStreamAddress {
  readonly masterSeed: number;
  readonly matchId: string;
  readonly purpose: "length" | "policy" | "noise";
  readonly actor?: "row" | "column";
  readonly round?: number;
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

function mixHash(hash: number, value: number): number {
  return Math.imul(hash ^ value, 0x0100_0193) >>> 0;
}

function hashText(hash: number, value: string): number {
  let next = hash;

  for (let index = 0; index < value.length; index += 1) {
    next = mixHash(next, value.charCodeAt(index));
  }

  return next;
}

/**
 * Derives a stable independent RNG seed for one match event. Addressing draws
 * by purpose, actor, and round keeps the environment fixed if a policy changes
 * how many choices it happens to make internally.
 */
export function deriveRngSeed(address: RngStreamAddress): number {
  assertSafeInteger(address.masterSeed, "masterSeed");

  if (address.matchId.trim() === "") {
    throw new TypeError("matchId must be non-empty.");
  }

  if (
    address.round !== undefined &&
    (!Number.isSafeInteger(address.round) || address.round < 0)
  ) {
    throw new RangeError("round must be a non-negative safe integer.");
  }

  let hash = (address.masterSeed >>> 0) ^ 0x811c_9dc5;
  hash = hashText(hash, address.matchId);
  hash = hashText(hash, address.purpose);
  hash = hashText(hash, address.actor ?? "-");
  hash = mixHash(hash, address.round ?? -1);

  return hash >>> 0;
}

/** Creates an independent deterministic stream for one addressed match event. */
export function createEventRng(address: RngStreamAddress): SeededRng {
  return createRng(deriveRngSeed(address));
}
