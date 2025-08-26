import { describe, expect, it } from "vitest";
import { equals } from "@/engine/rational";
import {
  DEFAULT_IPD_ROUND_CAP,
  resolveHumanIpdRound,
  sampleIpdMatchLength,
  simulateIpdMatch,
  type IpdMatchConfig,
} from "@/engine/repeated/match";
import { decideIpdStrategy, ipdStrategies } from "@/engine/repeated/strategies";

function fixedMatch(
  rowStrategy: IpdMatchConfig["rowStrategy"],
  columnStrategy: IpdMatchConfig["columnStrategy"],
  overrides: Partial<IpdMatchConfig> = {},
): IpdMatchConfig {
  return {
    rowStrategy,
    columnStrategy,
    masterSeed: 4401,
    matchId: "p6-test",
    continuationProbability: 1,
    noise: 0,
    roundCap: 5,
    ...overrides,
  };
}

function actionPairs(
  result: ReturnType<typeof simulateIpdMatch>,
): Array<readonly [number, number]> {
  return result.history.map((round) => [round.row.action, round.column.action]);
}

describe("P6 event-addressed IPD match engine", () => {
  it("defines all eight finite-state or seeded strategies", () => {
    const base = {
      ownActions: [],
      opponentActions: [],
      ownPayoffs: [],
      policyDraw: 0.9,
    } as const;

    expect(ipdStrategies.map((strategy) => strategy.id)).toEqual([
      "allc",
      "alld",
      "tft",
      "grim",
      "pavlov",
      "gtft",
      "joss",
      "random",
    ]);
    expect(decideIpdStrategy("allc", base)).toBe(0);
    expect(decideIpdStrategy("alld", base)).toBe(1);
    expect(decideIpdStrategy("tft", { ...base, opponentActions: [1] })).toBe(1);
    expect(decideIpdStrategy("grim", { ...base, opponentActions: [1] })).toBe(
      1,
    );
    expect(
      decideIpdStrategy("pavlov", {
        ...base,
        ownActions: [1],
        ownPayoffs: [{ numerator: 5n, denominator: 1n }],
      }),
    ).toBe(1);
    expect(
      decideIpdStrategy("gtft", {
        ...base,
        opponentActions: [1],
        policyDraw: 0,
      }),
    ).toBe(0);
    expect(decideIpdStrategy("joss", { ...base, policyDraw: 0 })).toBe(1);
    expect(decideIpdStrategy("random", { ...base, policyDraw: 0.75 })).toBe(1);
  });

  it("pins the exact TFT versus TFT transcript and totals", () => {
    const result = simulateIpdMatch(fixedMatch("tft", "tft"));

    expect(actionPairs(result)).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ]);
    expect(equals(result.rowTotal, { numerator: 15n, denominator: 1n })).toBe(
      true,
    );
    expect(
      equals(result.columnTotal, { numerator: 15n, denominator: 1n }),
    ).toBe(true);
  });

  it("pins TFT versus AllD move-by-move and at total length L", () => {
    const result = simulateIpdMatch(fixedMatch("tft", "alld"));

    expect(actionPairs(result)).toEqual([
      [0, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
    expect(equals(result.rowTotal, { numerator: 4n, denominator: 1n })).toBe(
      true,
    );
    expect(equals(result.columnTotal, { numerator: 9n, denominator: 1n })).toBe(
      true,
    );
  });

  it("pins Pavlov's C,D alternation against AllD", () => {
    const result = simulateIpdMatch(fixedMatch("pavlov", "alld"));

    expect(result.history.map((round) => round.row.action)).toEqual([
      0, 1, 0, 1, 0,
    ]);
    expect(result.history.map((round) => round.column.action)).toEqual([
      1, 1, 1, 1, 1,
    ]);
  });

  it("pins the Grim-versus-Joss C-run, trigger, and mutual-D tail", () => {
    const result = simulateIpdMatch(
      fixedMatch("grim", "joss", { masterSeed: 77, roundCap: 8 }),
    );
    expect(actionPairs(result)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
      [1, 1],
    ]);
  });

  it("keeps the environment deterministic and independent of substituted policy", () => {
    const config = fixedMatch("allc", "gtft", {
      masterSeed: 126_484,
      matchId: "counterfactual",
      continuationProbability: 0.88,
      roundCap: 30,
    });
    const original = simulateIpdMatch(config);
    const counterfactual = simulateIpdMatch({ ...config, rowStrategy: "tft" });

    expect(simulateIpdMatch(config)).toEqual(original);
    expect(counterfactual.rounds).toBe(original.rounds);
    expect(
      counterfactual.history.map((round) => ({
        rowPolicyDraw: round.row.policyDraw,
        columnPolicyDraw: round.column.policyDraw,
        rowNoiseDraw: round.row.noiseDraw,
        columnNoiseDraw: round.column.noiseDraw,
      })),
    ).toEqual(
      original.history.map((round) => ({
        rowPolicyDraw: round.row.policyDraw,
        columnPolicyDraw: round.column.policyDraw,
        rowNoiseDraw: round.row.noiseDraw,
        columnNoiseDraw: round.column.noiseDraw,
      })),
    );
  });

  it("uses independent noise draws after both strategy choices and discloses the cap", () => {
    const noisy = simulateIpdMatch(
      fixedMatch("allc", "allc", { noise: 1, roundCap: 2 }),
    );

    expect(actionPairs(noisy)).toEqual([
      [1, 1],
      [1, 1],
    ]);
    expect(noisy.history.every((round) => round.row.noiseFlipped)).toBe(true);
    expect(noisy.truncatedAtCap).toBe(true);
    expect(noisy.rounds).toBe(2);
  });

  it("resolves a human action against a strategy with the same round schedule", () => {
    const config = fixedMatch("tft", "tft", { roundCap: 3 });
    const first = resolveHumanIpdRound(config, [], 1);
    const second = resolveHumanIpdRound(config, [first], 0);

    expect(first).toMatchObject({
      row: { intendedAction: 1, action: 1 },
      column: { intendedAction: 0, action: 0 },
    });
    expect(second).toMatchObject({
      row: { intendedAction: 0, action: 0 },
      column: { intendedAction: 1, action: 1 },
    });
  });

  it("validates bounded configurations and samples a one-round noncontinuation", () => {
    const oneRound = sampleIpdMatchLength(
      fixedMatch("allc", "alld", { continuationProbability: 0 }),
    );
    expect(oneRound).toMatchObject({ rounds: 1, truncatedAtCap: false });
    expect(oneRound.continuationDraws).toHaveLength(1);

    expect(() =>
      sampleIpdMatchLength(
        fixedMatch("allc", "alld", { roundCap: DEFAULT_IPD_ROUND_CAP + 1 }),
      ),
    ).toThrow(/roundCap/);
    expect(() =>
      sampleIpdMatchLength(
        fixedMatch("allc", "alld", { continuationProbability: -0.1 }),
      ),
    ).toThrow(/continuationProbability/);
    expect(() =>
      sampleIpdMatchLength(fixedMatch("allc", "alld", { masterSeed: 0.5 })),
    ).toThrow(/masterSeed/);
    expect(() =>
      sampleIpdMatchLength(fixedMatch("allc", "alld", { matchId: "" })),
    ).toThrow(/matchId/);
  });
});
