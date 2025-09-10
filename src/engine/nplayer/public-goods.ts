import {
  add,
  compare,
  multiply,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";

/**
 * Exact n-player voluntary-contribution mechanism (VCM), the canonical
 * public-goods game.
 *
 * Each of `playerCount` players holds `endowment` integer tokens and privately
 * contributes `c_i ∈ {0, …, endowment}` to a common pot. The pot is multiplied
 * and split evenly, so player i earns
 *
 *   π_i = (endowment − c_i) + mpcr · Σ_j c_j
 *
 * where `mpcr` is the marginal per capita return: the share of one contributed
 * token that flows back to *each* player, including the contributor.
 *
 * Two exact facts drive the whole surface, and both are pure algebra rather
 * than search — no enumeration over the (endowment+1)^playerCount profile space
 * is needed:
 *
 *   1. Contributing one token costs the contributor 1 and returns `mpcr`. So
 *      when `mpcr < 1` every player has a strictly dominant strategy of
 *      contributing nothing, and universal free-riding is the unique Nash
 *      equilibrium. The private incentive does not depend on what anyone else
 *      does — that is what makes the dilemma sharp.
 *   2. That same token adds `mpcr · playerCount` to the group total. So when
 *      `mpcr · playerCount > 1` full contribution maximises the sum of payoffs
 *      and Pareto-dominates universal free-riding.
 *
 * Both together — `1/playerCount < mpcr < 1` — is precisely the social-dilemma
 * window: individually irrational to give, collectively irrational not to.
 */
export interface PublicGoodsConfig {
  /** Number of players, ≥ 2. */
  readonly playerCount: number;
  /** Integer tokens each player starts with, ≥ 1. */
  readonly endowment: number;
  /** Marginal per capita return — the exact share one token returns to each player. */
  readonly mpcr: Rational;
}

export function createPublicGoodsConfig(
  config: PublicGoodsConfig,
): PublicGoodsConfig {
  if (!Number.isSafeInteger(config.playerCount) || config.playerCount < 2) {
    throw new RangeError("playerCount must be an integer ≥ 2.");
  }
  if (!Number.isSafeInteger(config.endowment) || config.endowment < 1) {
    throw new RangeError("endowment must be an integer ≥ 1.");
  }
  if (compare(config.mpcr, ZERO) !== 1) {
    throw new RangeError("mpcr must be strictly positive.");
  }
  return config;
}

function assertContribution(value: number, endowment: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > endowment) {
    throw new RangeError(
      `Contribution must be an integer in 0..${endowment}; received ${value}.`,
    );
  }
}

/** Payoff to one player given their own contribution and the group total. */
export function payoffFor(
  config: PublicGoodsConfig,
  ownContribution: number,
  groupTotal: number,
): Rational {
  assertContribution(ownContribution, config.endowment);
  const kept = rational(BigInt(config.endowment - ownContribution));
  const share = multiply(config.mpcr, rational(BigInt(groupTotal)));
  return add(kept, share);
}

export interface ProfileOutcome {
  /** Contributions in player order, echoed back. */
  readonly contributions: readonly number[];
  /** Σ c_j. */
  readonly groupTotal: number;
  /** Payoff per player, in player order. */
  readonly payoffs: readonly Rational[];
  /** Σ π_j — the welfare number the Pareto comparison uses. */
  readonly welfare: Rational;
}

/** Evaluates a full contribution profile exactly. */
export function evaluateProfile(
  config: PublicGoodsConfig,
  contributions: readonly number[],
): ProfileOutcome {
  if (contributions.length !== config.playerCount) {
    throw new RangeError(
      `Expected ${config.playerCount} contributions; received ${contributions.length}.`,
    );
  }
  for (const contribution of contributions) {
    assertContribution(contribution, config.endowment);
  }
  const groupTotal = contributions.reduce((sum, value) => sum + value, 0);
  const payoffs = contributions.map((own) =>
    payoffFor(config, own, groupTotal),
  );
  const welfare = payoffs.reduce((sum, value) => add(sum, value), ZERO);
  return { contributions, groupTotal, payoffs, welfare };
}

/** Convenience: the profile in which every player contributes `amount`. */
export function uniformProfile(
  config: PublicGoodsConfig,
  amount: number,
): number[] {
  assertContribution(amount, config.endowment);
  return Array.from({ length: config.playerCount }, () => amount);
}

/**
 * The exact private return on one contributed token: `mpcr − 1`. Negative
 * whenever `mpcr < 1`, which is what makes zero strictly dominant.
 */
export function privateMarginalReturn(config: PublicGoodsConfig): Rational {
  return subtract(config.mpcr, rational(1n));
}

/**
 * The exact social return on one contributed token: `mpcr · playerCount − 1`.
 * Positive whenever the pot multiplies faster than it is split.
 */
export function socialMarginalReturn(config: PublicGoodsConfig): Rational {
  return subtract(
    multiply(config.mpcr, rational(BigInt(config.playerCount))),
    rational(1n),
  );
}

export interface DilemmaVerdict {
  /** True when `mpcr < 1` — zero is strictly dominant for every player. */
  readonly freeRidingIsDominant: boolean;
  /** True when `mpcr · playerCount > 1` — full contribution maximises welfare. */
  readonly cooperationIsEfficient: boolean;
  /** True when both hold: the genuine social dilemma window. */
  readonly isSocialDilemma: boolean;
  readonly privateMarginalReturn: Rational;
  readonly socialMarginalReturn: Rational;
}

export function classifyDilemma(config: PublicGoodsConfig): DilemmaVerdict {
  const privateReturn = privateMarginalReturn(config);
  const socialReturn = socialMarginalReturn(config);
  const freeRidingIsDominant = compare(privateReturn, ZERO) === -1;
  const cooperationIsEfficient = compare(socialReturn, ZERO) === 1;
  return {
    freeRidingIsDominant,
    cooperationIsEfficient,
    isSocialDilemma: freeRidingIsDominant && cooperationIsEfficient,
    privateMarginalReturn: privateReturn,
    socialMarginalReturn: socialReturn,
  };
}

export interface NashVerdict {
  /** The unique equilibrium contribution when one exists analytically. */
  readonly equilibriumContribution: number | null;
  readonly outcome: ProfileOutcome | null;
  readonly reason: string;
}

/**
 * Analytic Nash equilibrium. Because each player's payoff is linear in their
 * own contribution with slope `mpcr − 1`, the best response is a corner and
 * does not depend on the other players at all:
 *   mpcr < 1 → contribute 0 (unique NE, strictly dominant)
 *   mpcr > 1 → contribute everything (unique NE, strictly dominant)
 *   mpcr = 1 → every profile is an equilibrium; there is no unique one.
 */
export function nashEquilibrium(config: PublicGoodsConfig): NashVerdict {
  const slope = privateMarginalReturn(config);
  const sign = compare(slope, ZERO);
  if (sign === 0) {
    return {
      equilibriumContribution: null,
      outcome: null,
      reason:
        "At an MPCR of exactly 1 a contributed token returns precisely what it cost, so every player is indifferent across every contribution and every profile is a Nash equilibrium.",
    };
  }
  const contribution = sign === -1 ? 0 : config.endowment;
  return {
    equilibriumContribution: contribution,
    outcome: evaluateProfile(config, uniformProfile(config, contribution)),
    reason:
      sign === -1
        ? "Each token costs 1 and returns less than 1 to the contributor, so contributing nothing is strictly dominant regardless of what anyone else does."
        : "Each token costs 1 and returns more than 1 to the contributor, so contributing everything is strictly dominant.",
  };
}

/**
 * The welfare-maximising uniform profile. Welfare is linear in the group total
 * with slope `mpcr · playerCount − 1`, so this is also a corner.
 */
export function welfareOptimum(config: PublicGoodsConfig): ProfileOutcome {
  const sign = compare(socialMarginalReturn(config), ZERO);
  const amount = sign === 1 ? config.endowment : 0;
  return evaluateProfile(config, uniformProfile(config, amount));
}

export interface DeviationRow {
  readonly contribution: number;
  readonly ownPayoff: Rational;
  /** Payoff to each of the other players at this contribution. */
  readonly otherPayoff: Rational;
  readonly welfare: Rational;
}

/**
 * Sweeps one player's contribution across the whole grid while every other
 * player is held at `othersEach`. This is the exact arithmetic behind the
 * dominance claim: `ownPayoff` falls monotonically while `welfare` rises.
 */
export function deviationSweep(
  config: PublicGoodsConfig,
  othersEach: number,
): DeviationRow[] {
  assertContribution(othersEach, config.endowment);
  const otherCount = config.playerCount - 1;
  const rows: DeviationRow[] = [];
  for (let own = 0; own <= config.endowment; own += 1) {
    const groupTotal = own + othersEach * otherCount;
    const ownPayoff = payoffFor(config, own, groupTotal);
    const otherPayoff = payoffFor(config, othersEach, groupTotal);
    const welfare = add(
      ownPayoff,
      multiply(otherPayoff, rational(BigInt(otherCount))),
    );
    rows.push({ contribution: own, ownPayoff, otherPayoff, welfare });
  }
  return rows;
}

/**
 * The exact gain from moving the whole group from universal free-riding to
 * full contribution — the size of the prize cooperation leaves on the table.
 */
export function cooperationDividend(config: PublicGoodsConfig): Rational {
  const allDefect = evaluateProfile(config, uniformProfile(config, 0));
  const allCooperate = evaluateProfile(
    config,
    uniformProfile(config, config.endowment),
  );
  return subtract(allCooperate.payoffs[0], allDefect.payoffs[0]);
}
