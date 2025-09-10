import {
  add,
  compare,
  divide,
  subtract,
  ONE,
  ZERO,
  type Rational,
} from "@/engine/rational";
import type { SymmetricPayoffs } from "@/engine/moran";

/**
 * Formal evolutionarily-stable-strategy checker for a two-strategy symmetric
 * contest with payoff matrix
 *
 *        A     B
 *   A    a     b
 *   B    c     d
 *
 * Maynard Smith's definition: strategy S is an ESS if, against every mutant M,
 * either E(S,S) > E(M,S), or E(S,S) = E(M,S) and E(S,M) > E(M,M). The second
 * clause is the one people drop; without it a neutrally-stable strategy gets
 * misreported as evolutionarily stable, so both are checked separately here
 * and the verdict records which clause carried it.
 *
 * Note that ESS is strictly stronger than Nash: every ESS is a symmetric Nash
 * equilibrium, but a Nash equilibrium with E(S,S) = E(M,S) and E(S,M) ≤ E(M,M)
 * is invadable by drift.
 */
export type ESSClause = "strict-advantage" | "tie-broken-on-mutant" | "none";

export interface PureESSVerdict {
  readonly strategy: "A" | "B";
  readonly isESS: boolean;
  /** Which arm of the definition established stability, if either did. */
  readonly clause: ESSClause;
  /**
   * When stability fails, the concrete reason a mutant gets in — the exact
   * payoff comparison an invader wins or ties.
   */
  readonly witness: string | null;
}

function checkPure(
  strategy: "A" | "B",
  selfSelf: Rational,
  mutantSelf: Rational,
  selfMutant: Rational,
  mutantMutant: Rational,
  selfLabel: string,
  mutantLabel: string,
): PureESSVerdict {
  const primary = compare(selfSelf, mutantSelf);
  if (primary === 1) {
    return {
      strategy,
      isESS: true,
      clause: "strict-advantage",
      witness: null,
    };
  }
  if (primary === -1) {
    return {
      strategy,
      isESS: false,
      clause: "none",
      witness: `A ${mutantLabel} mutant earns more against the resident ${selfLabel} population than ${selfLabel} earns against itself, so it invades outright.`,
    };
  }
  // Tie on the first clause: stability now rests on how each fares against the mutant.
  const secondary = compare(selfMutant, mutantMutant);
  if (secondary === 1) {
    return {
      strategy,
      isESS: true,
      clause: "tie-broken-on-mutant",
      witness: null,
    };
  }
  return {
    strategy,
    isESS: false,
    clause: "none",
    witness:
      secondary === 0
        ? `${selfLabel} and ${mutantLabel} are payoff-identical in every pairing, so a ${mutantLabel} mutant drifts in neutrally — ${selfLabel} is neutrally stable but not evolutionarily stable.`
        : `${selfLabel} ties with ${mutantLabel} against the resident population, and then does strictly worse against ${mutantLabel} itself, so the mutant grows once it appears.`,
  };
}

export interface MixedESS {
  /** Share of the population playing A at the interior rest point. */
  readonly shareOfA: Rational;
  /** True when the interior point is an attractor rather than a repellor. */
  readonly isStable: boolean;
}

export interface ESSReport {
  readonly a: PureESSVerdict;
  readonly b: PureESSVerdict;
  /** Present only when an interior rest point exists strictly between 0 and 1. */
  readonly mixed: MixedESS | null;
  /** Plain-language classification of the whole contest. */
  readonly regime:
    "A dominant" | "B dominant" | "bistable" | "mixed" | "neutral";
}

/**
 * Interior rest point of the replicator dynamics: the share x of A at which
 * both strategies earn the same, x* = (d − b) / ((a − c) + (d − b)).
 *
 * It is an attractor — a genuine mixed ESS — exactly when each strategy does
 * better rare than common, i.e. `a < c` and `d < b` (the Hawk–Dove shape).
 * When `a > c` and `d > b` the same algebra gives a repellor separating two
 * basins, which is bistability, not stability.
 */
export function interiorRestPoint(payoffs: SymmetricPayoffs): MixedESS | null {
  const { a, b, c, d } = payoffs;
  const gapA = subtract(a, c);
  const gapD = subtract(d, b);
  const denominator = add(gapA, gapD);
  if (compare(denominator, ZERO) === 0) {
    // The payoff difference is constant in x, so either no interior rest point
    // exists or every share is one. Neither is a mixed ESS.
    return null;
  }
  const shareOfA = divide(gapD, denominator);
  if (compare(shareOfA, ZERO) !== 1 || compare(shareOfA, ONE) !== -1) {
    return null;
  }
  // Attractor precisely when both strategies do better rare than common.
  const isStable = compare(gapA, ZERO) === -1 && compare(gapD, ZERO) === -1;
  return { shareOfA, isStable };
}

export function classifyESS(payoffs: SymmetricPayoffs): ESSReport {
  const { a, b, c, d } = payoffs;
  const aVerdict = checkPure("A", a, c, b, d, "A", "B");
  const bVerdict = checkPure("B", d, b, c, a, "B", "A");
  const mixed = interiorRestPoint(payoffs);

  let regime: ESSReport["regime"];
  if (aVerdict.isESS && bVerdict.isESS) {
    regime = "bistable";
  } else if (aVerdict.isESS) {
    regime = "A dominant";
  } else if (bVerdict.isESS) {
    regime = "B dominant";
  } else if (mixed?.isStable) {
    regime = "mixed";
  } else {
    regime = "neutral";
  }

  return { a: aVerdict, b: bVerdict, mixed, regime };
}
