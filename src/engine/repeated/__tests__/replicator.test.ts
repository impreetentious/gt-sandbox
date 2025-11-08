import { describe, expect, it } from "vitest";
import {
  defaultEvolutionPreset,
  evolutionPresets,
  predicateHolds,
} from "@/content/evolution-presets";
import { runIpdEvolution, runReplicatorDynamics } from "@/engine/repeated/replicator";

const baseEvolutionConfig = {
  strategies: ["allc", "alld"] as const,
  initialShares: [0.5, 0.5],
  masterSeed: 940_416,
  continuationProbability: 0.95,
  noise: 0,
  repetitions: 20,
  roundCap: 500,
  generations: 100,
};

function finalShares(result: ReturnType<typeof runIpdEvolution>): readonly number[] {
  const final = result.result.generations.at(-1);

  if (!final) {
    throw new Error("Expected at least the initial generation.");
  }

  return final.shares;
}

describe("P8 replicator dynamics", () => {
  it("follows the known monotone AllC/AllD path from an equal population", () => {
    const result = runReplicatorDynamics(
      [
        [3, 0],
        [5, 1],
      ],
      [0.5, 0.5],
      4,
    );

    expect(result.status).toBe("complete");
    if (result.status !== "complete") {
      return;
    }

    expect(result.generations[1]?.shares[1]).toBeCloseTo(2 / 3);
    const defectShares = result.generations.map((generation) => generation.shares[1] ?? 0);
    expect(defectShares.slice(1).every((share, index) => share > defectShares[index]!)).toBe(true);
  });

  it("keeps all-one-strategy fixed points fixed", () => {
    const matrix = [
      [3, 0],
      [5, 1],
    ];

    for (const initialShares of [
      [1, 0],
      [0, 1],
    ]) {
      const result = runReplicatorDynamics(matrix, initialShares, 3);
      expect(result.status).toBe("complete");
      expect(result.generations.map((generation) => generation.shares)).toEqual([
        initialShares,
        initialShares,
        initialShares,
        initialShares,
      ]);
    }
  });

  it("returns a typed failure rather than dividing by zero mean fitness", () => {
    const result = runReplicatorDynamics(
      [
        [0, 0],
        [0, 0],
      ],
      [0.5, 0.5],
      2,
    );

    expect(result.status).toBe("zero-mean-fitness");
    if (result.status === "zero-mean-fitness") {
      expect(result.generation).toBe(0);
      expect(result.generations).toHaveLength(1);
    }
  });

  it("rejects malformed population and payoff inputs before iterating", () => {
    expect(() => runReplicatorDynamics([[1]], [], 1)).toThrow(/at least one/);
    expect(() => runReplicatorDynamics([[1]], [1, 0], 1)).toThrow(/one row/);
    expect(() => runReplicatorDynamics([[1], [0]], [1, 0], 1)).toThrow(/square/);
    expect(() => runReplicatorDynamics([[1]], [0], 1)).toThrow(/positive/);
    expect(() => runReplicatorDynamics([[-1]], [1], 1)).toThrow(/nonnegative/);
    expect(() => runReplicatorDynamics([[1]], [1], 501)).toThrow(/0 to 500/);
  });

  it("reproduces every reviewed seeded preset, matrix, endpoint, and predicate", () => {
    for (const preset of evolutionPresets) {
      const run = runIpdEvolution(preset.config);

      expect(run.result.status, preset.id).toBe("complete");
      expect(run.payoffMatrix, preset.id).toEqual(preset.payoffMatrix);
      expect(finalShares(run), preset.id).toEqual(preset.finalShares);
      expect(
        predicateHolds(finalShares(run), run.config.strategies, preset.metricPredicate),
        preset.id,
      ).toBe(true);
    }
  });

  it("keeps the documented 50/50 exploitation condition as the default preset", () => {
    expect(defaultEvolutionPreset.id).toBe("exploitation");
    expect(defaultEvolutionPreset.config.initialShares).toEqual([0.5, 0.5]);
    expect(defaultEvolutionPreset.config.strategies).toEqual(["allc", "alld"]);
  });

  it("rejects invalid IPD evolution configuration before simulating", () => {
    expect(() =>
      runIpdEvolution({
        ...baseEvolutionConfig,
        strategies: ["allc"],
      }),
    ).toThrow(/two to eight/);
    expect(() =>
      runIpdEvolution({
        ...baseEvolutionConfig,
        initialShares: [1],
      }),
    ).toThrow(/align/);
    expect(() =>
      runIpdEvolution({
        ...baseEvolutionConfig,
        masterSeed: 0.5,
      }),
    ).toThrow(/safe integer/);
  });
});
