import {
  auctionPersonas,
  resolvePrivateValueRound,
  type AuctionFormat,
  type AuctionPersonaId,
} from "@/engine/auction/auction";
import { createRng } from "@/engine/rng";
import {
  add,
  rational,
  subtract,
  ZERO,
  type Rational,
} from "@/engine/rational";
import { buildSessionExport, type SessionExport } from "@/state/session-export";

/**
 * A seeded, deterministic auction session. Each round draws private valuations
 * (or a common value plus noisy signals) from independently addressed streams,
 * so a session is exactly reproducible from its seed (I3). The player chooses a
 * bid; the rival bids via a fixed persona rule.
 */
export const AUCTION_MAX_VALUE = 10;

export type AuctionSessionStatus = "bidding" | "revealed" | "complete";
export type AuctionFocusTarget = "bid" | "continue" | "restart";

export interface AuctionDraw {
  /** Your private valuation (private-value) or noisy signal (common-value). */
  readonly yourObservation: number;
  readonly rivalObservation: number;
  /** The realized common value, present only in the common-value format. */
  readonly commonValue?: number;
  readonly tieWinner: "you" | "rival";
}

export interface AuctionRound {
  readonly number: number;
  readonly yourObservation: number;
  readonly yourBid: number;
  readonly rivalBid: number;
  readonly youWin: boolean;
  readonly price: Rational;
  readonly yourPayoff: Rational;
  readonly commonValue?: number;
}

export interface AuctionSessionState {
  readonly format: AuctionFormat;
  readonly persona: AuctionPersonaId;
  readonly maxValue: number;
  readonly roundLimit: number;
  readonly seed: number;
  readonly status: AuctionSessionStatus;
  readonly current: AuctionDraw;
  readonly rounds: readonly AuctionRound[];
  readonly pending: AuctionRound | null;
  readonly yourProfit: Rational;
  readonly focusTarget: AuctionFocusTarget;
}

export type AuctionSessionAction =
  | { readonly type: "select-persona"; readonly persona: AuctionPersonaId }
  | { readonly type: "submit-bid"; readonly bid: number }
  | { readonly type: "continue" }
  | { readonly type: "restart" };

const DEFAULT_SEED = 0xa0c_7100;

function eventSeed(seed: number, round: number, channel: number): number {
  return (
    ((seed >>> 0) ^
      Math.imul((round + 1) >>> 0, 0x9e37_79b9) ^
      Math.imul((channel + 1) >>> 0, 0x85eb_ca6b)) >>>
    0
  );
}

function drawInteger(
  seed: number,
  round: number,
  channel: number,
  minInclusive: number,
  maxInclusive: number,
): number {
  return createRng(eventSeed(seed, round, channel)).integer(
    minInclusive,
    maxInclusive + 1,
  );
}

function noise(seed: number, round: number, channel: number): number {
  return drawInteger(seed, round, channel, 0, 2) - 1; // −1, 0, or +1
}

function drawRound(
  format: AuctionFormat,
  seed: number,
  round: number,
  maxValue: number,
): AuctionDraw {
  const tieWinner = drawInteger(seed, round, 2, 0, 1) === 0 ? "you" : "rival";

  if (format === "common-value") {
    const commonValue = drawInteger(seed, round, 0, 0, maxValue);
    return {
      commonValue,
      yourObservation: commonValue + noise(seed, round, 3),
      rivalObservation: commonValue + noise(seed, round, 4),
      tieWinner,
    };
  }

  return {
    yourObservation: drawInteger(seed, round, 0, 0, maxValue),
    rivalObservation: drawInteger(seed, round, 1, 0, maxValue),
    tieWinner,
  };
}

export function auctionPersonasForFormat(
  format: AuctionFormat,
): readonly AuctionPersonaId[] {
  if (format === "second-price") {
    return ["truthful", "shader", "overbidder"];
  }
  if (format === "first-price") {
    return ["shader", "truthful", "overbidder"];
  }
  return ["truthful", "overbidder"];
}

export function createAuctionSession(
  format: AuctionFormat,
  persona: AuctionPersonaId = auctionPersonasForFormat(format)[0],
  seed = DEFAULT_SEED,
  roundLimit = 8,
  maxValue = AUCTION_MAX_VALUE,
): AuctionSessionState {
  return {
    format,
    persona,
    maxValue,
    roundLimit,
    seed,
    status: "bidding",
    current: drawRound(format, seed, 0, maxValue),
    rounds: [],
    pending: null,
    yourProfit: ZERO,
    focusTarget: "bid",
  };
}

function resolveRound(state: AuctionSessionState, bid: number): AuctionRound {
  const draw = state.current;
  const rivalBid = auctionPersonas[state.persona].bid(
    draw.rivalObservation,
    state.maxValue,
  );

  if (state.format === "common-value") {
    // First-price common value: the higher bid wins and pays its own bid; the
    // realized payoff is the true common value minus the price.
    const youBidHigher = bid > rivalBid;
    const tie = bid === rivalBid;
    const youWin = youBidHigher || (tie && draw.tieWinner === "you");
    const price = rational(BigInt(bid));
    return {
      number: state.rounds.length + 1,
      yourObservation: draw.yourObservation,
      yourBid: bid,
      rivalBid,
      youWin,
      price: youWin ? price : ZERO,
      yourPayoff: youWin
        ? subtract(rational(BigInt(draw.commonValue ?? 0)), price)
        : ZERO,
      commonValue: draw.commonValue,
    };
  }

  const resolution = resolvePrivateValueRound({
    format: state.format,
    yourBid: bid,
    rivalBid,
    yourValue: draw.yourObservation,
    rivalValue: draw.rivalObservation,
    tieWinner: draw.tieWinner,
  });

  return {
    number: state.rounds.length + 1,
    yourObservation: draw.yourObservation,
    yourBid: bid,
    rivalBid,
    youWin: resolution.youWin,
    price: resolution.price,
    yourPayoff: resolution.yourPayoff,
  };
}

export function reduceAuctionSession(
  state: AuctionSessionState,
  action: AuctionSessionAction,
): AuctionSessionState {
  switch (action.type) {
    case "select-persona":
      if (
        state.rounds.length !== 0 ||
        state.status !== "bidding" ||
        !auctionPersonasForFormat(state.format).includes(action.persona)
      ) {
        return state;
      }
      return { ...state, persona: action.persona };

    case "submit-bid": {
      if (state.status !== "bidding") {
        return state;
      }
      const bid = Math.max(
        0,
        Math.min(state.maxValue + 1, Math.floor(action.bid)),
      );
      return {
        ...state,
        status: "revealed",
        pending: resolveRound(state, bid),
        focusTarget: "continue",
      };
    }

    case "continue": {
      if (state.status !== "revealed" || state.pending === null) {
        return state;
      }
      const rounds = [...state.rounds, state.pending];
      const isComplete = rounds.length === state.roundLimit;
      return {
        ...state,
        status: isComplete ? "complete" : "bidding",
        rounds,
        pending: null,
        yourProfit: add(state.yourProfit, state.pending.yourPayoff),
        current: isComplete
          ? state.current
          : drawRound(state.format, state.seed, rounds.length, state.maxValue),
        focusTarget: isComplete ? "restart" : "bid",
      };
    }

    case "restart":
      return state.status === "complete"
        ? createAuctionSession(
            state.format,
            state.persona,
            (state.seed + 0x9e37_79b9) >>> 0,
            state.roundLimit,
            state.maxValue,
          )
        : state;
  }
}

export function auctionSessionToExport(
  state: AuctionSessionState,
  title: string,
): SessionExport {
  return buildSessionExport({
    kind: "auction",
    game: state.format,
    title,
    seed: state.seed,
    rowLabel: "You",
    columnLabel: auctionPersonas[state.persona].name,
    rounds: state.rounds.map((round) => ({
      rowAction: `bid ${round.yourBid}`,
      columnAction: `bid ${round.rivalBid}`,
      rowPayoff: round.yourPayoff,
      columnPayoff: ZERO,
    })),
    rowTotal: state.yourProfit,
    columnTotal: ZERO,
    meta: { format: state.format, persona: state.persona },
  });
}
