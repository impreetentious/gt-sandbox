import {
  add,
  compare,
  divide,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Exact winner's-curse analysis for a two-bidder common-value auction. The
 * common value W is uniform on `0..maxValue`; each bidder sees a signal
 * `s = W + e` with independent noise `e ∈ {−1, 0, +1}`, uniform. Everything is
 * computed by enumerating the finite, equiprobable joint distribution, so the
 * conditional expectations are exact rationals — no sampling, no floats.
 *
 * The curse: conditioning on winning (having the higher signal) shifts the
 * expected value of W strictly below the face value of your own signal.
 */
const NOISE = [-1, 0, 1] as const;

export interface SignalRow {
  readonly signal: number;
  /** E[W | your signal = s] — the face-value (naive) estimate. */
  readonly naiveEstimate: Rational;
  /** E[W | your signal = s and you win by bidding your signal]. */
  readonly winningEstimate: Rational;
  /** Exact probability of winning when both bid their signals. */
  readonly winProbability: Rational;
}

export interface CommonValueAnalysis {
  readonly maxValue: number;
  readonly rows: readonly SignalRow[];
  /** Expected profit from naively bidding your own signal (first-price). */
  readonly expectedNaiveProfit: Rational;
  readonly curseHolds: boolean;
}

interface JointOutcome {
  readonly w: number;
  readonly signal: number;
  readonly rivalSignal: number;
}

function enumerateJoint(maxValue: number): JointOutcome[] {
  const outcomes: JointOutcome[] = [];
  for (let w = 0; w <= maxValue; w += 1) {
    for (const e of NOISE) {
      for (const eRival of NOISE) {
        outcomes.push({ w, signal: w + e, rivalSignal: w + eRival });
      }
    }
  }
  return outcomes;
}

function meanOf(values: readonly number[]): Rational {
  if (values.length === 0) {
    return ZERO;
  }
  return divide(
    rational(BigInt(values.reduce((sum, value) => sum + value, 0))),
    rational(BigInt(values.length)),
  );
}

export function analyzeCommonValue(maxValue: number): CommonValueAnalysis {
  if (!Number.isSafeInteger(maxValue) || maxValue < 2) {
    throw new RangeError("maxValue must be an integer of at least 2.");
  }

  const joint = enumerateJoint(maxValue);
  const signals = Array.from(
    new Set(joint.map((outcome) => outcome.signal)),
  ).sort((a, b) => a - b);

  const rows: SignalRow[] = signals.map((signal) => {
    const atSignal = joint.filter((outcome) => outcome.signal === signal);
    // Winning by bidding your signal means your signal strictly exceeds the
    // rival's (ties are split but do not change the strict-curse direction).
    const winning = atSignal.filter(
      (outcome) => outcome.signal > outcome.rivalSignal,
    );
    return {
      signal,
      naiveEstimate: meanOf(atSignal.map((outcome) => outcome.w)),
      winningEstimate: meanOf(winning.map((outcome) => outcome.w)),
      winProbability:
        atSignal.length === 0
          ? ZERO
          : divide(
              rational(BigInt(winning.length)),
              rational(BigInt(atSignal.length)),
            ),
    };
  });

  // Expected profit from bidding your own signal in a first-price common-value
  // auction: you win iff your signal is higher, and then pay your own signal.
  let profitTotal = ZERO;
  for (const outcome of joint) {
    if (outcome.signal > outcome.rivalSignal) {
      profitTotal = add(
        profitTotal,
        subtract(rational(BigInt(outcome.w)), rational(BigInt(outcome.signal))),
      );
    }
  }
  const expectedNaiveProfit = divide(
    profitTotal,
    rational(BigInt(joint.length)),
  );

  const curseHolds = rows.every(
    (row) =>
      row.winProbability.numerator === 0n ||
      compare(row.winningEstimate, row.naiveEstimate) <= 0,
  );

  return { maxValue, rows, expectedNaiveProfit, curseHolds };
}
