import {
  payoffAt,
  payoffFor,
  type NormalFormGame,
  type Profile,
} from "@/engine/game";
import { createEventRng } from "@/engine/rng";
import {
  add,
  compare,
  divide,
  rational,
  type Rational,
  ZERO,
} from "@/engine/rational";
import type { BinaryAction } from "@/engine/repeated/policies";
import type { IpdStrategyId } from "@/engine/repeated/strategies";

/**
 * Plays an arbitrary 2×2 game iterated, reinterpreting the shipped strategy
 * roster over a designated cooperate/defect labelling. This is deliberately a
 * separate module from the PD-specific match engine: Pavlov here uses a general
 * aspiration level (the mean of the player's own stage payoffs) rather than the
 * hardcoded PD reward/temptation, so the roster carries meaning on customs too.
 * Determinism (I3) reuses the same event-addressed stream scheme.
 */
export const DEFAULT_ITERATED_ROUND_CAP = 5_000;

export type CooperationSymbol = "C" | "D";

export interface IteratedGameConfig {
  readonly game: NormalFormGame;
  readonly cooperate: Profile;
  readonly rowStrategy: IpdStrategyId;
  readonly columnStrategy: IpdStrategyId;
  readonly masterSeed: number;
  readonly matchId: string;
  readonly continuationProbability: number;
  readonly noise: number;
  readonly roundCap?: number;
}

export interface IteratedRound {
  readonly number: number;
  readonly rowAction: BinaryAction;
  readonly columnAction: BinaryAction;
  readonly rowSymbol: CooperationSymbol;
  readonly columnSymbol: CooperationSymbol;
  readonly rowPayoff: Rational;
  readonly columnPayoff: Rational;
}

export interface IteratedMatchResult {
  readonly config: Readonly<IteratedGameConfig>;
  readonly rounds: number;
  readonly truncatedAtCap: boolean;
  readonly history: readonly IteratedRound[];
  readonly rowTotal: Rational;
  readonly columnTotal: Rational;
  /** Mutual-cooperation rate: rounds where both realized the cooperate action. */
  readonly mutualCooperationRate: Rational;
}

interface SymbolContext {
  readonly ownSymbols: readonly CooperationSymbol[];
  readonly opponentSymbols: readonly CooperationSymbol[];
  readonly ownPayoffs: readonly Rational[];
  readonly aspiration: Rational;
  readonly policyDraw: number;
}

function assertTwoByTwo(game: NormalFormGame): void {
  if (game.rowActions.length !== 2 || game.columnActions.length !== 2) {
    throw new RangeError("Iterated play requires a 2×2 game.");
  }
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number from 0 to 1.`);
  }
}

function roundCapOf(config: IteratedGameConfig): number {
  const cap = config.roundCap ?? DEFAULT_ITERATED_ROUND_CAP;
  if (
    !Number.isSafeInteger(cap) ||
    cap < 1 ||
    cap > DEFAULT_ITERATED_ROUND_CAP
  ) {
    throw new RangeError(
      `roundCap must be a safe integer from 1 to ${DEFAULT_ITERATED_ROUND_CAP}.`,
    );
  }
  return cap;
}

function validateConfig(config: IteratedGameConfig): void {
  assertTwoByTwo(config.game);
  if (!Number.isSafeInteger(config.masterSeed)) {
    throw new TypeError("masterSeed must be a safe integer.");
  }
  if (config.matchId.trim() === "") {
    throw new TypeError("matchId must be non-empty.");
  }
  assertProbability(config.continuationProbability, "continuationProbability");
  assertProbability(config.noise, "noise");
  roundCapOf(config);
}

function flip(symbol: CooperationSymbol): CooperationSymbol {
  return symbol === "C" ? "D" : "C";
}

function decideSymbol(
  strategy: IpdStrategyId,
  context: SymbolContext,
): CooperationSymbol {
  const lastOpponent = context.opponentSymbols.at(-1);
  const titForTat = (): CooperationSymbol => lastOpponent ?? "C";

  switch (strategy) {
    case "allc":
      return "C";
    case "alld":
      return "D";
    case "tft":
      return titForTat();
    case "grim":
      return context.opponentSymbols.includes("D") ? "D" : "C";
    case "pavlov": {
      const lastOwn = context.ownSymbols.at(-1);
      const lastPayoff = context.ownPayoffs.at(-1);
      if (lastOwn === undefined || lastPayoff === undefined) {
        return "C";
      }
      return compare(lastPayoff, context.aspiration) >= 0
        ? lastOwn
        : flip(lastOwn);
    }
    case "gtft":
      return lastOpponent === "D" && context.policyDraw < 1 / 3
        ? "C"
        : titForTat();
    case "joss":
      return context.policyDraw < 1 / 10 ? "D" : titForTat();
    case "random":
      return context.policyDraw < 1 / 2 ? "C" : "D";
  }
}

function symbolToAction(
  symbol: CooperationSymbol,
  cooperateAction: BinaryAction,
): BinaryAction {
  return symbol === "C" ? cooperateAction : cooperateAction === 0 ? 1 : 0;
}

function actionToSymbol(
  action: BinaryAction,
  cooperateAction: BinaryAction,
): CooperationSymbol {
  return action === cooperateAction ? "C" : "D";
}

/** The mean of a player's four stage payoffs — Pavlov's aspiration level. */
function aspirationLevel(
  game: NormalFormGame,
  player: "row" | "column",
): Rational {
  let sum = ZERO;
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      sum = add(sum, payoffFor(game, { row, column }, player));
    }
  }
  return divide(sum, rational(4n));
}

function sampleLength(config: IteratedGameConfig): {
  rounds: number;
  truncatedAtCap: boolean;
} {
  const cap = roundCapOf(config);
  for (let round = 0; round < cap - 1; round += 1) {
    const draw = createEventRng({
      masterSeed: config.masterSeed,
      matchId: config.matchId,
      purpose: "length",
      round,
    }).next();
    if (draw >= config.continuationProbability) {
      return { rounds: round + 1, truncatedAtCap: false };
    }
  }
  return { rounds: cap, truncatedAtCap: true };
}

export function simulateIteratedMatch(
  config: IteratedGameConfig,
): IteratedMatchResult {
  validateConfig(config);
  const { game, cooperate } = config;
  const rowCooperate = cooperate.row as BinaryAction;
  const columnCooperate = cooperate.column as BinaryAction;
  const rowAspiration = aspirationLevel(game, "row");
  const columnAspiration = aspirationLevel(game, "column");

  const length = sampleLength(config);
  const history: IteratedRound[] = [];
  const rowSymbols: CooperationSymbol[] = [];
  const columnSymbols: CooperationSymbol[] = [];
  const rowPayoffs: Rational[] = [];
  const columnPayoffs: Rational[] = [];
  let rowTotal = ZERO;
  let columnTotal = ZERO;
  let mutualCooperation = 0;

  for (let round = 0; round < length.rounds; round += 1) {
    const rowPolicyDraw = createEventRng({
      masterSeed: config.masterSeed,
      matchId: config.matchId,
      purpose: "policy",
      actor: "row",
      round,
    }).next();
    const columnPolicyDraw = createEventRng({
      masterSeed: config.masterSeed,
      matchId: config.matchId,
      purpose: "policy",
      actor: "column",
      round,
    }).next();

    const rowSymbol = decideSymbol(config.rowStrategy, {
      ownSymbols: rowSymbols,
      opponentSymbols: columnSymbols,
      ownPayoffs: rowPayoffs,
      aspiration: rowAspiration,
      policyDraw: rowPolicyDraw,
    });
    const columnSymbol = decideSymbol(config.columnStrategy, {
      ownSymbols: columnSymbols,
      opponentSymbols: rowSymbols,
      ownPayoffs: columnPayoffs,
      aspiration: columnAspiration,
      policyDraw: columnPolicyDraw,
    });

    let rowAction = symbolToAction(rowSymbol, rowCooperate);
    let columnAction = symbolToAction(columnSymbol, columnCooperate);

    const rowNoiseDraw = createEventRng({
      masterSeed: config.masterSeed,
      matchId: config.matchId,
      purpose: "noise",
      actor: "row",
      round,
    }).next();
    const columnNoiseDraw = createEventRng({
      masterSeed: config.masterSeed,
      matchId: config.matchId,
      purpose: "noise",
      actor: "column",
      round,
    }).next();
    if (rowNoiseDraw < config.noise) {
      rowAction = (rowAction === 0 ? 1 : 0) as BinaryAction;
    }
    if (columnNoiseDraw < config.noise) {
      columnAction = (columnAction === 0 ? 1 : 0) as BinaryAction;
    }

    const [rowPayoff, columnPayoff] = payoffAt(game, {
      row: rowAction,
      column: columnAction,
    });

    const realizedRowSymbol = actionToSymbol(rowAction, rowCooperate);
    const realizedColumnSymbol = actionToSymbol(columnAction, columnCooperate);
    rowSymbols.push(realizedRowSymbol);
    columnSymbols.push(realizedColumnSymbol);
    rowPayoffs.push(rowPayoff);
    columnPayoffs.push(columnPayoff);
    rowTotal = add(rowTotal, rowPayoff);
    columnTotal = add(columnTotal, columnPayoff);
    if (realizedRowSymbol === "C" && realizedColumnSymbol === "C") {
      mutualCooperation += 1;
    }

    history.push({
      number: round + 1,
      rowAction,
      columnAction,
      rowSymbol: realizedRowSymbol,
      columnSymbol: realizedColumnSymbol,
      rowPayoff,
      columnPayoff,
    });
  }

  return {
    config: { ...config, roundCap: roundCapOf(config) },
    rounds: length.rounds,
    truncatedAtCap: length.truncatedAtCap,
    history,
    rowTotal,
    columnTotal,
    mutualCooperationRate:
      length.rounds === 0
        ? ZERO
        : divide(
            rational(BigInt(mutualCooperation)),
            rational(BigInt(length.rounds)),
          ),
  };
}
