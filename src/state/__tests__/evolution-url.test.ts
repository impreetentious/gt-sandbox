import { describe, expect, it } from "vitest";
import { defaultEvolutionPreset } from "@/content/evolution-presets";
import { runIpdEvolution } from "@/engine/repeated/replicator";
import {
  decodeEvolutionSearch,
  encodeEvolutionConfig,
  EVOLUTION_URL_MAX_LENGTH,
} from "@/state/evolution-url";

describe("P8 evolution URL state", () => {
  it("round-trips a complete bounded configuration bit-for-bit", () => {
    const first = runIpdEvolution(defaultEvolutionPreset.config);
    const search = encodeEvolutionConfig(first.config);
    const decoded = decodeEvolutionSearch(search);
    const second = runIpdEvolution(decoded.config);

    expect(decoded.notice).toBeUndefined();
    expect(second).toEqual(first);
  });

  it("accepts a normalized custom population and fixed environment", () => {
    const decoded = decodeEvolutionSearch(
      "?ev=1&s=alld%2Ctft&x=0.2%2C0.8&d=0.9&n=0.05&r=10&seed=42&cap=400&g=80",
    );

    expect(decoded).toEqual({
      config: {
        strategies: ["alld", "tft"],
        initialShares: [0.2, 0.8],
        continuationProbability: 0.9,
        noise: 0.05,
        repetitions: 10,
        masterSeed: 42,
        roundCap: 400,
        generations: 80,
      },
    });
  });

  it("falls back cleanly for malformed, duplicate, and oversized links", () => {
    for (const search of [
      "?ev=1&s=alld%2Ctft&x=1%2C0&d=0.9&n=0&r=20&seed=1&cap=500&g=100&x=0%2C1",
      "?ev=1&s=alld%2Ctft&x=0.5%2C0.5&d=0.2&n=0&r=20&seed=1&cap=500&g=100",
      "?" + "x".repeat(EVOLUTION_URL_MAX_LENGTH + 1),
    ]) {
      const decoded = decodeEvolutionSearch(search);

      expect(decoded.config).toEqual(defaultEvolutionPreset.config);
      expect(decoded.notice).toBeDefined();
    }
  });

  it("rejects repetitions above 20 and round caps above 1000", () => {
    for (const search of [
      "?ev=1&s=alld%2Ctft&x=0.5%2C0.5&d=0.9&n=0&r=21&seed=1&cap=500&g=80",
      "?ev=1&s=alld%2Ctft&x=0.5%2C0.5&d=0.9&n=0&r=10&seed=1&cap=1001&g=80",
    ]) {
      const decoded = decodeEvolutionSearch(search);

      expect(decoded.config).toEqual(defaultEvolutionPreset.config);
      expect(decoded.notice).toBeDefined();
    }
  });
});
