import {
  DEFAULT_IPD_ROUND_CAP,
  simulateIpdMatch,
} from "@/engine/repeated/match";
import {
  add,
  compare,
  divide,
  rational,
  type Rational,
  ZERO,
} from "@/engine/rational";
import {
  ipdStrategyById,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";

export const DEFAULT_TOURNAMENT_REPETITIONS = 20;
export const DEFAULT_TOURNAMENT_SEED = 259_187;
export const DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY = 0.95;
export const DEFAULT_TOURNAMENT_NOISE = 0;

export const defaultTournamentRoster = [
  "allc",
  "alld",
  "tft",
  "grim",
  "pavlov",
  "gtft",
  "joss",
  "random",
] as const satisfies readonly IpdStrategyId[];

export interface IpdTournamentConfig {
  readonly strategies: readonly IpdStrategyId[];
  readonly masterSeed: number;
  readonly repetitions?: number;
  readonly continuationProbability?: number;
  readonly noise?: number;
  readonly roundCap?: number;
}

export interface TournamentPayoff {
  readonly opponent: IpdStrategyId;
  /** Mean payoff per round across the pair's seeded repetitions. */
  readonly payoff: Rational;
}

export interface TournamentMatrixRow {
  readonly strategy: IpdStrategyId;
  readonly payoffs: readonly TournamentPayoff[];
}

export interface TournamentRanking {
  readonly position: number;
  readonly strategy: IpdStrategyId;
  /** Mean of this strategy's pairwise per-round payoffs. */
  readonly payoff: Rational;
}

export interface IpdTournamentResult {
  readonly config: Required<IpdTournamentConfig>;
  readonly matrix: readonly TournamentMatrixRow[];
  readonly ranking: readonly TournamentRanking[];
}

function average(values: readonly Rational[]): Rational {
  return divide(
    values.reduce((total, value) => add(total, value), ZERO),
    rational(BigInt(values.length)),
  );
}

function normalizeConfig(
  config: IpdTournamentConfig,
): Required<IpdTournamentConfig> {
  const repetitions = config.repetitions ?? DEFAULT_TOURNAMENT_REPETITIONS;
  const continuationProbability =
    config.continuationProbability ??
    DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY;
  const noise = config.noise ?? DEFAULT_TOURNAMENT_NOISE;
  const roundCap = config.roundCap ?? DEFAULT_IPD_ROUND_CAP;

  if (
    !Number.isSafeInteger(repetitions) ||
    repetitions < 1 ||
    repetitions > 100
  ) {
    throw new RangeError("repetitions must be a safe integer from 1 to 100.");
  }

  if (config.strategies.length < 2) {
    throw new RangeError("A tournament needs at least two strategies.");
  }

  const uniqueStrategies = new Set(config.strategies);

  if (uniqueStrategies.size !== config.strategies.length) {
    throw new RangeError("Tournament strategies must be unique.");
  }

  for (const strategy of config.strategies) {
    if (!(strategy in ipdStrategyById)) {
      throw new RangeError(`Unknown IPD strategy: ${strategy}`);
    }
  }

  return {
    strategies: [...config.strategies],
    masterSeed: config.masterSeed,
    repetitions,
    continuationProbability,
    noise,
    roundCap,
  };
}

function pairwiseMeanPayoff(
  config: Required<IpdTournamentConfig>,
  rowStrategy: IpdStrategyId,
  columnStrategy: IpdStrategyId,
): Rational {
  const payoffs: Rational[] = [];

  for (let repetition = 0; repetition < config.repetitions; repetition += 1) {
    const match = simulateIpdMatch({
      rowStrategy,
      columnStrategy,
      masterSeed: config.masterSeed,
      matchId: `tournament:${rowStrategy}:${columnStrategy}:rep:${repetition}`,
      continuationProbability: config.continuationProbability,
      noise: config.noise,
      roundCap: config.roundCap,
    });
    payoffs.push(divide(match.rowTotal, rational(BigInt(match.rounds))));
  }

  return average(payoffs);
}

/**
 * Runs a deterministic ordered round-robin of the supplied IPD strategies.
 * Pairwise values are means of per-round payoffs, so geometric match lengths
 * never give a longer match greater weight in the resulting matrix.
 */
export function runIpdTournament(
  input: IpdTournamentConfig,
): IpdTournamentResult {
  const config = normalizeConfig(input);
  const matrix = config.strategies.map((strategy) => ({
    strategy,
    payoffs: config.strategies.map((opponent) => ({
      opponent,
      payoff: pairwiseMeanPayoff(config, strategy, opponent),
    })),
  }));
  const ranking = matrix
    .map((row) => ({
      strategy: row.strategy,
      payoff: average(row.payoffs.map((entry) => entry.payoff)),
    }))
    .sort((left, right) => compare(right.payoff, left.payoff))
    .map((entry, index) => ({ ...entry, position: index + 1 }));

  return { config, matrix, ranking };
}
