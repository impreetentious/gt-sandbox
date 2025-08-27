import { DEFAULT_IPD_ROUND_CAP } from "@/engine/repeated/match";
import {
  DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY,
  DEFAULT_TOURNAMENT_NOISE,
  DEFAULT_TOURNAMENT_REPETITIONS,
  runIpdTournament,
} from "@/engine/repeated/tournament";
import {
  ipdStrategyById,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";
import type { Rational } from "@/engine/rational";

export const DEFAULT_EVOLUTION_GENERATIONS = 100;

export interface ReplicatorGeneration {
  readonly generation: number;
  readonly shares: readonly number[];
  readonly fitness: readonly number[];
  readonly meanFitness: number;
}

export interface ReplicatorComplete {
  readonly status: "complete";
  readonly generations: readonly ReplicatorGeneration[];
}

export interface ReplicatorZeroMeanFitness {
  readonly status: "zero-mean-fitness";
  readonly generation: number;
  readonly generations: readonly ReplicatorGeneration[];
}

export type ReplicatorResult = ReplicatorComplete | ReplicatorZeroMeanFitness;

export interface IpdEvolutionConfig {
  readonly strategies: readonly IpdStrategyId[];
  /** Nonnegative population weights, aligned with strategies. */
  readonly initialShares: readonly number[];
  readonly masterSeed: number;
  readonly repetitions?: number;
  readonly continuationProbability?: number;
  readonly noise?: number;
  readonly roundCap?: number;
  readonly generations?: number;
}

export interface IpdEvolutionResult {
  readonly config: Required<IpdEvolutionConfig>;
  /** Per-round tournament estimates converted to floats for simulation only. */
  readonly payoffMatrix: readonly (readonly number[])[];
  readonly result: ReplicatorResult;
}

function assertFiniteNonnegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite nonnegative number.`);
  }
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number from 0 to 1.`);
  }
}

function normalizeShares(shares: readonly number[]): readonly number[] {
  const total = shares.reduce((sum, share, index) => {
    assertFiniteNonnegative(share, `initialShares[${index}]`);
    return sum + share;
  }, 0);

  if (!Number.isFinite(total) || total <= 0) {
    throw new RangeError(
      "initialShares must contain at least one positive share.",
    );
  }

  return shares.map((share) => share / total);
}

function validateMatrix(
  payoffMatrix: readonly (readonly number[])[],
  strategyCount: number,
): void {
  if (payoffMatrix.length !== strategyCount) {
    throw new RangeError("payoffMatrix must have one row per strategy.");
  }

  payoffMatrix.forEach((row, rowIndex) => {
    if (row.length !== strategyCount) {
      throw new RangeError("payoffMatrix must be square.");
    }

    row.forEach((payoff, columnIndex) =>
      assertFiniteNonnegative(
        payoff,
        `payoffMatrix[${rowIndex}][${columnIndex}]`,
      ),
    );
  });
}

/**
 * Iterates the discrete replicator update on a supplied payoff matrix.
 *
 * Shares and fitness deliberately use floating point: they are simulation
 * state, never a normal-form solver claim. The payoff matrix is validated as
 * finite and nonnegative before iteration because IPD stage-game payoffs may
 * be zero, making a zero mean-fitness denominator possible.
 */
export function runReplicatorDynamics(
  payoffMatrix: readonly (readonly number[])[],
  initialShares: readonly number[],
  generationCount = DEFAULT_EVOLUTION_GENERATIONS,
): ReplicatorResult {
  if (
    !Number.isSafeInteger(generationCount) ||
    generationCount < 0 ||
    generationCount > 500
  ) {
    throw new RangeError(
      "generationCount must be a safe integer from 0 to 500.",
    );
  }

  if (initialShares.length < 1) {
    throw new RangeError("Replicator dynamics needs at least one strategy.");
  }

  validateMatrix(payoffMatrix, initialShares.length);
  let shares = normalizeShares(initialShares);
  const generations: ReplicatorGeneration[] = [];

  for (let generation = 0; generation <= generationCount; generation += 1) {
    const fitness = payoffMatrix.map((row) =>
      row.reduce(
        (total, payoff, index) => total + payoff * (shares[index] ?? 0),
        0,
      ),
    );
    const meanFitness = fitness.reduce(
      (total, value, index) => total + value * (shares[index] ?? 0),
      0,
    );
    const snapshot = { generation, shares, fitness, meanFitness };
    generations.push(snapshot);

    if (generation === generationCount) {
      return { status: "complete", generations };
    }

    if (!Number.isFinite(meanFitness) || meanFitness <= 0) {
      return { status: "zero-mean-fitness", generation, generations };
    }

    shares = shares.map(
      (share, index) => (share * (fitness[index] ?? 0)) / meanFitness,
    );
  }

  return { status: "complete", generations };
}

function rationalToNumber(value: Rational): number {
  return Number(value.numerator) / Number(value.denominator);
}

function normalizeConfig(
  input: IpdEvolutionConfig,
): Required<IpdEvolutionConfig> {
  const repetitions = input.repetitions ?? DEFAULT_TOURNAMENT_REPETITIONS;
  const continuationProbability =
    input.continuationProbability ??
    DEFAULT_TOURNAMENT_CONTINUATION_PROBABILITY;
  const noise = input.noise ?? DEFAULT_TOURNAMENT_NOISE;
  const roundCap = input.roundCap ?? DEFAULT_IPD_ROUND_CAP;
  const generations = input.generations ?? DEFAULT_EVOLUTION_GENERATIONS;

  if (input.strategies.length < 2 || input.strategies.length > 8) {
    throw new RangeError("Evolution needs from two to eight strategies.");
  }

  if (new Set(input.strategies).size !== input.strategies.length) {
    throw new RangeError("Evolution strategies must be unique.");
  }

  input.strategies.forEach((strategy) => {
    if (!(strategy in ipdStrategyById)) {
      throw new RangeError(`Unknown IPD strategy: ${strategy}`);
    }
  });

  if (input.initialShares.length !== input.strategies.length) {
    throw new RangeError("initialShares must align with strategies.");
  }

  if (!Number.isSafeInteger(input.masterSeed)) {
    throw new TypeError("masterSeed must be a safe integer.");
  }

  if (
    !Number.isSafeInteger(repetitions) ||
    repetitions < 1 ||
    repetitions > 100
  ) {
    throw new RangeError("repetitions must be a safe integer from 1 to 100.");
  }

  assertProbability(continuationProbability, "continuationProbability");
  assertProbability(noise, "noise");

  if (
    !Number.isSafeInteger(roundCap) ||
    roundCap < 1 ||
    roundCap > DEFAULT_IPD_ROUND_CAP
  ) {
    throw new RangeError(
      `roundCap must be a safe integer from 1 to ${DEFAULT_IPD_ROUND_CAP}.`,
    );
  }

  if (
    !Number.isSafeInteger(generations) ||
    generations < 0 ||
    generations > 500
  ) {
    throw new RangeError("generations must be a safe integer from 0 to 500.");
  }

  return {
    strategies: [...input.strategies],
    initialShares: normalizeShares(input.initialShares),
    masterSeed: input.masterSeed,
    repetitions,
    continuationProbability,
    noise,
    roundCap,
    generations,
  };
}

/**
 * Estimates IPD payoffs with the event-addressed tournament environment, then
 * evolves population shares from that fixed per-round matrix.
 */
export function runIpdEvolution(input: IpdEvolutionConfig): IpdEvolutionResult {
  const config = normalizeConfig(input);
  const tournament = runIpdTournament({
    strategies: config.strategies,
    masterSeed: config.masterSeed,
    repetitions: config.repetitions,
    continuationProbability: config.continuationProbability,
    noise: config.noise,
    roundCap: config.roundCap,
  });
  const payoffMatrix = tournament.matrix.map((row) =>
    row.payoffs.map((entry) => rationalToNumber(entry.payoff)),
  );

  return {
    config,
    payoffMatrix,
    result: runReplicatorDynamics(
      payoffMatrix,
      config.initialShares,
      config.generations,
    ),
  };
}
