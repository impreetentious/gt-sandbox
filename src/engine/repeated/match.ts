import { ipd } from "@/engine/catalog/ipd";
import { payoffAt } from "@/engine/game";
import { createEventRng, type RngStreamAddress } from "@/engine/rng";
import { add, type Rational, ZERO } from "@/engine/rational";
import type { BinaryAction } from "@/engine/repeated/policies";
import {
  decideIpdStrategy,
  type IpdStrategyId,
  type StrategyContext,
} from "@/engine/repeated/strategies";

export const DEFAULT_IPD_ROUND_CAP = 5_000;

export interface IpdMatchConfig {
  readonly rowStrategy: IpdStrategyId;
  readonly columnStrategy: IpdStrategyId;
  readonly masterSeed: number;
  readonly matchId: string;
  readonly continuationProbability: number;
  readonly noise: number;
  readonly roundCap?: number;
}

export interface IpdActionRecord {
  readonly intendedAction: BinaryAction;
  readonly action: BinaryAction;
  readonly policyDraw: number;
  readonly noiseDraw: number;
  readonly noiseFlipped: boolean;
}

export interface IpdMatchRound {
  readonly number: number;
  readonly row: IpdActionRecord;
  readonly column: IpdActionRecord;
  readonly rowPayoff: Rational;
  readonly columnPayoff: Rational;
}

export interface IpdMatchLength {
  readonly rounds: number;
  readonly truncatedAtCap: boolean;
  readonly continuationDraws: readonly number[];
}

export interface IpdMatchResult extends IpdMatchLength {
  readonly config: Readonly<IpdMatchConfig>;
  readonly history: readonly IpdMatchRound[];
  readonly rowTotal: Rational;
  readonly columnTotal: Rational;
}

interface RoundEnvironment {
  readonly rowPolicyDraw: number;
  readonly columnPolicyDraw: number;
  readonly rowNoiseDraw: number;
  readonly columnNoiseDraw: number;
}

function assertProbability(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be a finite number from 0 to 1.`);
  }
}

function roundCap(config: IpdMatchConfig): number {
  const cap = config.roundCap ?? DEFAULT_IPD_ROUND_CAP;

  if (!Number.isSafeInteger(cap) || cap < 1 || cap > DEFAULT_IPD_ROUND_CAP) {
    throw new RangeError(
      `roundCap must be a safe integer from 1 to ${DEFAULT_IPD_ROUND_CAP}.`,
    );
  }

  return cap;
}

function validateConfig(config: IpdMatchConfig): void {
  if (!Number.isSafeInteger(config.masterSeed)) {
    throw new TypeError("masterSeed must be a safe integer.");
  }

  if (config.matchId.trim() === "") {
    throw new TypeError("matchId must be non-empty.");
  }

  assertProbability(config.continuationProbability, "continuationProbability");
  assertProbability(config.noise, "noise");
  roundCap(config);
}

function eventDraw(
  config: IpdMatchConfig,
  purpose: RngStreamAddress["purpose"],
  round: number,
  actor?: "row" | "column",
): number {
  return createEventRng({
    masterSeed: config.masterSeed,
    matchId: config.matchId,
    purpose,
    actor,
    round,
  }).next();
}

function environmentForRound(
  config: IpdMatchConfig,
  round: number,
): RoundEnvironment {
  return {
    rowPolicyDraw: eventDraw(config, "policy", round, "row"),
    columnPolicyDraw: eventDraw(config, "policy", round, "column"),
    rowNoiseDraw: eventDraw(config, "noise", round, "row"),
    columnNoiseDraw: eventDraw(config, "noise", round, "column"),
  };
}

function flipIfNoisy(
  intendedAction: BinaryAction,
  draw: number,
  noise: number,
): IpdActionRecord {
  const noiseFlipped = draw < noise;

  return {
    intendedAction,
    action: noiseFlipped ? (intendedAction === 0 ? 1 : 0) : intendedAction,
    policyDraw: 0,
    noiseDraw: draw,
    noiseFlipped,
  };
}

function actionHistory(
  history: readonly IpdMatchRound[],
  actor: "row" | "column",
): BinaryAction[] {
  return history.map((round) => round[actor].action);
}

function payoffHistory(
  history: readonly IpdMatchRound[],
  actor: "row" | "column",
): Rational[] {
  return history.map((round) =>
    actor === "row" ? round.rowPayoff : round.columnPayoff,
  );
}

function strategyContext(
  history: readonly IpdMatchRound[],
  actor: "row" | "column",
  policyDraw: number,
): StrategyContext {
  const opponent = actor === "row" ? "column" : "row";

  return {
    ownActions: actionHistory(history, actor),
    opponentActions: actionHistory(history, opponent),
    ownPayoffs: payoffHistory(history, actor),
    policyDraw,
  };
}

function buildRound(
  config: IpdMatchConfig,
  history: readonly IpdMatchRound[],
  round: number,
  rowIntendedAction: BinaryAction,
  columnIntendedAction: BinaryAction,
): IpdMatchRound {
  const environment = environmentForRound(config, round);
  const row = {
    ...flipIfNoisy(rowIntendedAction, environment.rowNoiseDraw, config.noise),
    policyDraw: environment.rowPolicyDraw,
  };
  const column = {
    ...flipIfNoisy(
      columnIntendedAction,
      environment.columnNoiseDraw,
      config.noise,
    ),
    policyDraw: environment.columnPolicyDraw,
  };
  const [rowPayoff, columnPayoff] = payoffAt(ipd.game, {
    row: row.action,
    column: column.action,
  });

  return {
    number: history.length + 1,
    row,
    column,
    rowPayoff,
    columnPayoff,
  };
}

/** Samples the capped geometric match length from its own independent stream. */
export function sampleIpdMatchLength(config: IpdMatchConfig): IpdMatchLength {
  validateConfig(config);
  const cap = roundCap(config);
  const continuationDraws: number[] = [];

  for (let round = 0; round < cap - 1; round += 1) {
    const draw = eventDraw(config, "length", round);
    continuationDraws.push(draw);

    if (draw >= config.continuationProbability) {
      return {
        rounds: round + 1,
        truncatedAtCap: false,
        continuationDraws,
      };
    }
  }

  return { rounds: cap, truncatedAtCap: true, continuationDraws };
}

/**
 * Resolves one human-controlled row action. Both intended moves are selected
 * before either independently addressed noise flip is applied.
 */
export function resolveHumanIpdRound(
  config: IpdMatchConfig,
  history: readonly IpdMatchRound[],
  rowIntendedAction: BinaryAction,
): IpdMatchRound {
  validateConfig(config);
  const round = history.length;
  const environment = environmentForRound(config, round);
  const columnIntendedAction = decideIpdStrategy(
    config.columnStrategy,
    strategyContext(history, "column", environment.columnPolicyDraw),
  );

  return buildRound(
    config,
    history,
    round,
    rowIntendedAction,
    columnIntendedAction,
  );
}

/** Runs a complete strategy-versus-strategy match using the event schedule. */
export function simulateIpdMatch(config: IpdMatchConfig): IpdMatchResult {
  const length = sampleIpdMatchLength(config);
  const history: IpdMatchRound[] = [];
  let rowTotal = ZERO;
  let columnTotal = ZERO;

  for (let round = 0; round < length.rounds; round += 1) {
    const environment = environmentForRound(config, round);
    const rowIntendedAction = decideIpdStrategy(
      config.rowStrategy,
      strategyContext(history, "row", environment.rowPolicyDraw),
    );
    const columnIntendedAction = decideIpdStrategy(
      config.columnStrategy,
      strategyContext(history, "column", environment.columnPolicyDraw),
    );
    const resolved = buildRound(
      config,
      history,
      round,
      rowIntendedAction,
      columnIntendedAction,
    );
    history.push(resolved);
    rowTotal = add(rowTotal, resolved.rowPayoff);
    columnTotal = add(columnTotal, resolved.columnPayoff);
  }

  return {
    config: { ...config, roundCap: roundCap(config) },
    ...length,
    history,
    rowTotal,
    columnTotal,
  };
}
