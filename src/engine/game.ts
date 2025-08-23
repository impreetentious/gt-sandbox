import {
  add,
  isRational,
  parseRational,
  rational,
  type Rational,
} from "@/engine/rational";

export type Player = "row" | "column";

export interface Profile {
  readonly row: number;
  readonly column: number;
}

export type Payoff = readonly [Rational, Rational];
export type PayoffInput = readonly [RationalInput, RationalInput];
export type RationalInput = Rational | bigint | number | string;

export interface NormalFormGame {
  readonly id: string;
  readonly title: string;
  readonly rowActions: readonly string[];
  readonly columnActions: readonly string[];
  readonly payoffs: readonly (readonly Payoff[])[];
}

export interface NormalFormGameInput {
  readonly id: string;
  readonly title: string;
  readonly rowActions: readonly string[];
  readonly columnActions: readonly string[];
  readonly payoffs: readonly (readonly PayoffInput[])[];
}

function toRational(value: RationalInput): Rational {
  if (isRational(value)) {
    return rational(value.numerator, value.denominator);
  }

  if (typeof value === "bigint") {
    return rational(value);
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        "Numeric payoffs must be safe integers; use a string for fractions.",
      );
    }

    return rational(BigInt(value));
  }

  return parseRational(value);
}

function assertActionLabels(actions: readonly string[], player: Player): void {
  if (actions.length === 0) {
    throw new RangeError(`${player} must have at least one action.`);
  }

  if (actions.some((action) => action.trim() === "")) {
    throw new TypeError(`${player} action labels cannot be empty.`);
  }

  if (new Set(actions).size !== actions.length) {
    throw new TypeError(`${player} action labels must be unique.`);
  }
}

/** Creates an immutable-by-convention, rectangular normal-form game. */
export function createNormalFormGame(
  input: NormalFormGameInput,
): NormalFormGame {
  if (input.id.trim() === "" || input.title.trim() === "") {
    throw new TypeError("Games require a non-empty id and title.");
  }

  assertActionLabels(input.rowActions, "row");
  assertActionLabels(input.columnActions, "column");

  if (input.payoffs.length !== input.rowActions.length) {
    throw new RangeError("The payoff matrix must have one row per row action.");
  }

  const payoffs = input.payoffs.map((row) => {
    if (row.length !== input.columnActions.length) {
      throw new RangeError(
        "Every payoff row must have one cell per column action.",
      );
    }

    return row.map(
      ([rowPayoff, columnPayoff]) =>
        [toRational(rowPayoff), toRational(columnPayoff)] as const,
    );
  });

  return {
    id: input.id,
    title: input.title,
    rowActions: [...input.rowActions],
    columnActions: [...input.columnActions],
    payoffs,
  };
}

export function allProfiles(game: NormalFormGame): Profile[] {
  const profiles: Profile[] = [];

  for (let row = 0; row < game.rowActions.length; row += 1) {
    for (let column = 0; column < game.columnActions.length; column += 1) {
      profiles.push({ row, column });
    }
  }

  return profiles;
}

export function payoffAt(game: NormalFormGame, profile: Profile): Payoff {
  const payoffRow = game.payoffs[profile.row];
  const payoff = payoffRow?.[profile.column];

  if (!payoff) {
    throw new RangeError(
      `Profile (${profile.row}, ${profile.column}) is outside ${game.id}.`,
    );
  }

  return payoff;
}

export function payoffFor(
  game: NormalFormGame,
  profile: Profile,
  player: Player,
): Rational {
  return payoffAt(game, profile)[player === "row" ? 0 : 1];
}

export function profileKey(profile: Profile): string {
  return `${profile.row},${profile.column}`;
}

export function sameProfile(left: Profile, right: Profile): boolean {
  return left.row === right.row && left.column === right.column;
}

export function isZeroSum(game: NormalFormGame): boolean {
  return allProfiles(game).every((profile) => {
    const [rowPayoff, columnPayoff] = payoffAt(game, profile);
    return add(rowPayoff, columnPayoff).numerator === 0n;
  });
}
