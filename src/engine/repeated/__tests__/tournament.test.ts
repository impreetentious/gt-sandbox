import defaultTournamentFixture from "../../../../fixtures/tournament-default.json";
import { describe, expect, it } from "vitest";
import { formatRational } from "@/engine/rational";
import {
  DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY,
  DEFAULT_TOURNAMENT_NOISE,
  DEFAULT_TOURNAMENT_REPETITIONS,
  DEFAULT_TOURNAMENT_SEED,
  defaultTournamentRoster,
  runIpdTournament,
  type IpdTournamentConfig,
} from "@/engine/repeated/tournament";

function tournament(
  overrides: Partial<IpdTournamentConfig> = {},
): IpdTournamentConfig {
  return {
    strategies: ["allc", "alld", "tft"],
    masterSeed: 713_405,
    repetitions: 2,
    continuationProbability: 0.7,
    noise: 0,
    roundCap: 15,
    ...overrides,
  };
}

function serialise(result: ReturnType<typeof runIpdTournament>) {
  return {
    config: result.config,
    matrix: result.matrix.map((row) => ({
      strategy: row.strategy,
      payoffs: row.payoffs.map((payoff) => ({
        opponent: payoff.opponent,
        payoff: formatRational(payoff.payoff),
      })),
    })),
    ranking: result.ranking.map((entry) => ({
      position: entry.position,
      strategy: entry.strategy,
      payoff: formatRational(entry.payoff),
    })),
  };
}

describe("P7 deterministic IPD tournament", () => {
  it("uses documented defaults when tournament controls omit optional values", () => {
    const result = runIpdTournament({
      strategies: ["allc", "alld"],
      masterSeed: DEFAULT_TOURNAMENT_SEED,
    });

    expect(result.config).toMatchObject({
      repetitions: DEFAULT_TOURNAMENT_REPETITIONS,
      continuationProbability: DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY,
      noise: DEFAULT_TOURNAMENT_NOISE,
    });
  });

  it("gives AllD against AllC temptation exactly and TFT self-play reward exactly", () => {
    const result = runIpdTournament(tournament());
    const payoff = (strategy: string, opponent: string) =>
      result.matrix
        .find((row) => row.strategy === strategy)
        ?.payoffs.find((entry) => entry.opponent === opponent)?.payoff;

    expect(payoff("alld", "allc")).toEqual({ numerator: 5n, denominator: 1n });
    expect(payoff("tft", "tft")).toEqual({ numerator: 3n, denominator: 1n });
  });

  it("is deterministic across runs and ranks the mean of each ordered pair", () => {
    const first = runIpdTournament(tournament());
    const second = runIpdTournament(tournament());

    expect(second).toEqual(first);
    expect(first.ranking.map((entry) => entry.position)).toEqual([1, 2, 3]);
  });

  it("rejects invalid tournament configuration before simulating", () => {
    expect(() =>
      runIpdTournament(tournament({ strategies: ["allc"] })),
    ).toThrow(/at least two/);
    expect(() =>
      runIpdTournament(tournament({ strategies: ["allc", "allc"] })),
    ).toThrow(/unique/);
    expect(() =>
      runIpdTournament(
        tournament({
          strategies: ["allc", "missing"] as IpdTournamentConfig["strategies"],
        }),
      ),
    ).toThrow(/Unknown/);
    expect(() => runIpdTournament(tournament({ repetitions: 0 }))).toThrow(
      /repetitions/,
    );
    expect(() => runIpdTournament(tournament({ repetitions: 101 }))).toThrow(
      /repetitions/,
    );
  });

  it("pins the default all-eight roster: Grim wins the documented default seed", () => {
    const result = runIpdTournament({
      strategies: defaultTournamentRoster,
      masterSeed: DEFAULT_TOURNAMENT_SEED,
    });

    expect(serialise(result)).toEqual(defaultTournamentFixture);
    expect(result.ranking[0]?.strategy).toBe("grim");
  });
});
