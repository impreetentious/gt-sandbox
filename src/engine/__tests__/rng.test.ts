import { describe, expect, it } from "vitest";
import { createEventRng, createRng, deriveRngSeed } from "@/engine/rng";

describe("seeded RNG", () => {
  it("is deterministic by seed and produces values in range", () => {
    const first = createRng(42);
    const second = createRng(42);
    const different = createRng(43);
    const firstSequence = Array.from({ length: 8 }, () => first.next());

    expect(firstSequence).toEqual(
      Array.from({ length: 8 }, () => second.next()),
    );
    expect(firstSequence).not.toEqual(
      Array.from({ length: 8 }, () => different.next()),
    );
    expect(firstSequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it("returns bounded integer draws and rejects invalid bounds", () => {
    const rng = createRng(7);
    const draws = Array.from({ length: 40 }, () => rng.integer(-2, 3));

    expect(draws.every((draw) => draw >= -2 && draw < 3)).toBe(true);
    expect(() => createRng(1.5)).toThrow(TypeError);
    expect(() => rng.integer(2, 2)).toThrow(RangeError);
    expect(() => rng.integer(0.5, 3)).toThrow(TypeError);
  });

  it("derives independent event-addressed streams and validates addresses", () => {
    const address = {
      masterSeed: 11,
      matchId: "match-a",
      purpose: "policy" as const,
      actor: "row" as const,
      round: 3,
    };

    expect(deriveRngSeed(address)).toBe(deriveRngSeed(address));
    expect(deriveRngSeed({ ...address, actor: "column" })).not.toBe(
      deriveRngSeed(address),
    );
    expect(createEventRng(address).next()).toBe(createEventRng(address).next());
    expect(() => deriveRngSeed({ ...address, matchId: "" })).toThrow(/matchId/);
    expect(() => deriveRngSeed({ ...address, round: -1 })).toThrow(/round/);
  });
});
