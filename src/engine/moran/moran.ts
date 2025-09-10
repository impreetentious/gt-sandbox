import {
  add,
  compare,
  divide,
  multiply,
  rational,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Moran birth–death dynamics for two strategies in a finite, well-mixed
 * population — the finite-N counterpart to the replicator dynamics already in
 * `engine/repeated/replicator.ts`.
 *
 * The population holds exactly `populationSize` individuals; the state is `i`,
 * the number playing strategy A. Each step, one individual is chosen to
 * reproduce with probability proportional to fitness and one is chosen
 * uniformly to die, so `i` moves by ±1 or stays put. States 0 and N absorb.
 *
 * Every quantity below is an exact rational. That matters more here than
 * elsewhere in the codebase: the fixation probability is a ratio of sums of
 * products of N−1 terms, and in floating point those products underflow to
 * zero for populations well under a hundred, silently reporting ρ = 0 for
 * strategies that are merely disfavoured.
 */
export interface SymmetricPayoffs {
  /** E(A, A) — an A meeting an A. */
  readonly a: Rational;
  /** E(A, B) — an A meeting a B. */
  readonly b: Rational;
  /** E(B, A) — a B meeting an A. */
  readonly c: Rational;
  /** E(B, B) — a B meeting a B. */
  readonly d: Rational;
}

export interface MoranConfig {
  /** N ≥ 2. */
  readonly populationSize: number;
  readonly payoffs: SymmetricPayoffs;
  /**
   * Selection intensity w ∈ (0, 1]. Fitness is `1 − w + w·π`, so w → 0 is
   * near-neutral drift and w = 1 makes fitness the raw payoff.
   */
  readonly selectionIntensity: Rational;
}

export function createMoranConfig(config: MoranConfig): MoranConfig {
  if (
    !Number.isSafeInteger(config.populationSize) ||
    config.populationSize < 2
  ) {
    throw new RangeError("populationSize must be an integer ≥ 2.");
  }
  if (
    compare(config.selectionIntensity, ZERO) !== 1 ||
    compare(config.selectionIntensity, ONE) === 1
  ) {
    throw new RangeError("selectionIntensity must lie in (0, 1].");
  }
  // Every reachable interior state must carry strictly positive fitness for
  // both strategies, else the birth step is undefined. Checking here converts
  // a would-be division-by-zero deep in the recursion into one clear error.
  for (let i = 1; i < config.populationSize; i += 1) {
    const { fitnessA, fitnessB } = fitnessAt(config, i);
    if (compare(fitnessA, ZERO) !== 1 || compare(fitnessB, ZERO) !== 1) {
      throw new RangeError(
        `Fitness is non-positive at i = ${i}; lower the selection intensity or raise the payoffs.`,
      );
    }
  }
  return config;
}

function assertState(config: MoranConfig, i: number): void {
  if (!Number.isSafeInteger(i) || i < 0 || i > config.populationSize) {
    throw new RangeError(
      `State must be an integer in 0..${config.populationSize}; received ${i}.`,
    );
  }
}

export interface StatePayoffs {
  readonly payoffA: Rational;
  readonly payoffB: Rational;
}

/**
 * Expected payoff to each strategy in state `i`, averaging over the N−1
 * possible opponents. An individual never plays itself, which is exactly what
 * makes finite N differ from the infinite-population replicator equations.
 */
export function expectedPayoffs(config: MoranConfig, i: number): StatePayoffs {
  assertState(config, i);
  const n = config.populationSize;
  const { a, b, c, d } = config.payoffs;
  const divisor = rational(BigInt(n - 1));
  const payoffA = divide(
    add(
      multiply(a, rational(BigInt(i - 1))),
      multiply(b, rational(BigInt(n - i))),
    ),
    divisor,
  );
  const payoffB = divide(
    add(
      multiply(c, rational(BigInt(i))),
      multiply(d, rational(BigInt(n - i - 1))),
    ),
    divisor,
  );
  return { payoffA, payoffB };
}

export interface StateFitness {
  readonly fitnessA: Rational;
  readonly fitnessB: Rational;
}

/** Linear fitness `1 − w + w·π`, the standard weak-selection mapping. */
export function fitnessAt(config: MoranConfig, i: number): StateFitness {
  const { payoffA, payoffB } = expectedPayoffs(config, i);
  const w = config.selectionIntensity;
  const base = subtract(ONE, w);
  return {
    fitnessA: add(base, multiply(w, payoffA)),
    fitnessB: add(base, multiply(w, payoffB)),
  };
}

/**
 * The ratio `T⁻(i) / T⁺(i)` that drives the fixation formula.
 *
 * Writing D for the total fitness, T⁺(i) = (i·f_A / D)·((N−i)/N) and
 * T⁻(i) = ((N−i)·f_B / D)·(i/N). The combinatorial factors cancel exactly,
 * leaving `f_B(i) / f_A(i)` — which is why the whole computation stays rational.
 */
export function transitionRatio(config: MoranConfig, i: number): Rational {
  if (i < 1 || i >= config.populationSize) {
    throw new RangeError(
      `Transition ratio is only defined for interior states 1..${config.populationSize - 1}.`,
    );
  }
  const { fitnessA, fitnessB } = fitnessAt(config, i);
  return divide(fitnessB, fitnessA);
}

/**
 * Fixation probability that strategy A takes over the whole population,
 * starting from `initialA` copies of A:
 *
 *   ρ_i = (1 + Σ_{k=1}^{i−1} Π_{j=1}^{k} γ_j) / (1 + Σ_{k=1}^{N−1} Π_{j=1}^{k} γ_j)
 *
 * with γ_j the transition ratio above. Computed as an exact rational sum.
 */
export function fixationProbability(
  config: MoranConfig,
  initialA: number,
): Rational {
  assertState(config, initialA);
  if (initialA === 0) return ZERO;
  if (initialA === config.populationSize) return ONE;

  let runningProduct = ONE;
  let numerator = ONE;
  let denominator = ONE;
  for (let k = 1; k < config.populationSize; k += 1) {
    runningProduct = multiply(runningProduct, transitionRatio(config, k));
    denominator = add(denominator, runningProduct);
    if (k < initialA) {
      numerator = add(numerator, runningProduct);
    }
  }
  return divide(numerator, denominator);
}

/** Fixation probability of a single A mutant dropped into all-B. */
export function fixationOfSingleMutantA(config: MoranConfig): Rational {
  return fixationProbability(config, 1);
}

/**
 * Fixation probability of a single B mutant dropped into all-A. Obtained by
 * relabelling the game so B becomes the focal strategy — `a ↔ d`, `b ↔ c`.
 */
export function fixationOfSingleMutantB(config: MoranConfig): Rational {
  const mirrored: MoranConfig = {
    populationSize: config.populationSize,
    selectionIntensity: config.selectionIntensity,
    payoffs: {
      a: config.payoffs.d,
      b: config.payoffs.c,
      c: config.payoffs.b,
      d: config.payoffs.a,
    },
  };
  return fixationProbability(mirrored, 1);
}

/** The neutral benchmark 1/N — what fixation would be with no selection at all. */
export function neutralFixation(config: MoranConfig): Rational {
  return divide(ONE, rational(BigInt(config.populationSize)));
}

export interface SelectionVerdict {
  readonly fixationA: Rational;
  readonly fixationB: Rational;
  readonly neutral: Rational;
  /** ρ_A > 1/N — selection favours A replacing B. */
  readonly favoursA: boolean;
  /** ρ_B > 1/N — selection favours B replacing A. */
  readonly favoursB: boolean;
  /** ρ_A > ρ_B — A is the more likely of the two invasions to succeed. */
  readonly aInvadesMoreEasily: boolean;
}

/**
 * The "1/N rule": a strategy is favoured by selection exactly when a single
 * mutant fixes more often than a neutral one would. Both can hold at once
 * (mutual invasibility) or neither can (bistability).
 */
export function classifySelection(config: MoranConfig): SelectionVerdict {
  const fixationA = fixationOfSingleMutantA(config);
  const fixationB = fixationOfSingleMutantB(config);
  const neutral = neutralFixation(config);
  return {
    fixationA,
    fixationB,
    neutral,
    favoursA: compare(fixationA, neutral) === 1,
    favoursB: compare(fixationB, neutral) === 1,
    aInvadesMoreEasily: compare(fixationA, fixationB) === 1,
  };
}

export interface FixationRow {
  readonly state: number;
  readonly fixation: Rational;
}

/** ρ_i across every starting state — the curve the surface plots. */
export function fixationCurve(config: MoranConfig): FixationRow[] {
  const rows: FixationRow[] = [];
  for (let state = 0; state <= config.populationSize; state += 1) {
    rows.push({ state, fixation: fixationProbability(config, state) });
  }
  return rows;
}
