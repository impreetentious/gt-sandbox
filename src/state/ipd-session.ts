import {
  ipdStrategies,
  type IpdStrategyId,
} from "@/engine/repeated/strategies";
import {
  resolveHumanIpdRound,
  sampleIpdMatchLength,
  type IpdMatchConfig,
  type IpdMatchLength,
  type IpdMatchRound,
} from "@/engine/repeated/match";
import type { BinaryAction } from "@/engine/repeated/policies";
import { add, type Rational, ZERO } from "@/engine/rational";

export type IpdOpponentChoice = IpdStrategyId | "mystery";
export type IpdSessionStatus = "playing" | "resolving" | "complete";
export type IpdFocusTarget = "choice-0" | "choice-1" | "play-again";

const DEFAULT_IPD_SESSION_SEED = 0x4950_4401;
const IPD_MATCH_ID = "ipd-play";

export interface IpdSessionState {
  readonly selectedOpponent: IpdOpponentChoice;
  readonly opponentStrategy: IpdStrategyId;
  readonly mystery: boolean;
  readonly config: Readonly<IpdMatchConfig>;
  readonly length: IpdMatchLength;
  readonly status: IpdSessionStatus;
  readonly rounds: readonly IpdMatchRound[];
  readonly pendingRound: IpdMatchRound | null;
  readonly playerScore: Rational;
  readonly opponentScore: Rational;
  readonly focusTarget: IpdFocusTarget;
}

export type IpdSessionAction =
  | { readonly type: "select-opponent"; readonly opponent: IpdOpponentChoice }
  | { readonly type: "submit-choice"; readonly action: BinaryAction }
  | { readonly type: "commit-outcome" }
  | { readonly type: "play-again" };

function mysteryStrategyForSeed(seed: number): IpdStrategyId {
  return ipdStrategies[(seed >>> 0) % ipdStrategies.length].id;
}

function createConfig(
  opponent: IpdOpponentChoice,
  seed: number,
): Readonly<IpdMatchConfig> {
  const opponentStrategy =
    opponent === "mystery" ? mysteryStrategyForSeed(seed) : opponent;

  return {
    rowStrategy: "tft",
    columnStrategy: opponentStrategy,
    masterSeed: seed,
    matchId: IPD_MATCH_ID,
    continuationProbability: 0.95,
    noise: 0,
  };
}

export function createIpdSession(
  opponent: IpdOpponentChoice = "tft",
  seed = DEFAULT_IPD_SESSION_SEED,
): IpdSessionState {
  const config = createConfig(opponent, seed);
  const length = sampleIpdMatchLength(config);

  return {
    selectedOpponent: opponent,
    opponentStrategy: config.columnStrategy,
    mystery: opponent === "mystery",
    config,
    length,
    status: "playing",
    rounds: [],
    pendingRound: null,
    playerScore: ZERO,
    opponentScore: ZERO,
    focusTarget: "choice-0",
  };
}

export function nextIpdSessionSeed(seed: number): number {
  return (seed + 0x9e37_79b9) >>> 0;
}

function stageRound(
  state: IpdSessionState,
  playerAction: BinaryAction,
): IpdMatchRound {
  return resolveHumanIpdRound(state.config, state.rounds, playerAction);
}

/** A semantic interactive IPD match loop with a precommitted seeded length. */
export function reduceIpdSession(
  state: IpdSessionState,
  action: IpdSessionAction,
): IpdSessionState {
  switch (action.type) {
    case "select-opponent":
      if (state.status !== "playing" || state.rounds.length !== 0) {
        return state;
      }

      return createIpdSession(action.opponent, state.config.masterSeed);

    case "submit-choice":
      if (state.status !== "playing") {
        return state;
      }

      return {
        ...state,
        status: "resolving",
        pendingRound: stageRound(state, action.action),
        focusTarget: action.action === 0 ? "choice-0" : "choice-1",
      };

    case "commit-outcome": {
      const round = state.pendingRound;

      if (state.status !== "resolving" || !round) {
        return state;
      }

      const rounds = [...state.rounds, round];
      const isComplete = rounds.length === state.length.rounds;

      return {
        ...state,
        status: isComplete ? "complete" : "playing",
        rounds,
        pendingRound: null,
        playerScore: add(state.playerScore, round.rowPayoff),
        opponentScore: add(state.opponentScore, round.columnPayoff),
        focusTarget: isComplete
          ? "play-again"
          : round.row.intendedAction === 0
            ? "choice-0"
            : "choice-1",
      };
    }

    case "play-again":
      return state.status === "complete"
        ? createIpdSession(
            state.selectedOpponent,
            nextIpdSessionSeed(state.config.masterSeed),
          )
        : state;
  }
}
