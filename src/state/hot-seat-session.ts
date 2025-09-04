import { hotSeatGameContent, type HotSeatSlug } from "@/content/hot-seat";
import { catalogBySlug } from "@/engine/catalog";
import { payoffAt } from "@/engine/game";
import type { BinaryAction } from "@/engine/repeated/policies";
import { add, type Rational, ZERO } from "@/engine/rational";
import { buildSessionExport, type SessionExport } from "@/state/session-export";

/**
 * Two humans, one device. Simultaneity is preserved by commit-and-conceal: the
 * row player locks a hidden action, a handover screen hides it, then the column
 * player chooses. Neither engine nor persona machinery is involved — this is a
 * pure reducer over two human inputs, so it stays inside I4 with zero backend.
 */
export type HotSeatPhase =
  "row-commit" | "handover" | "column-commit" | "reveal" | "complete";

export type HotSeatFocusTarget =
  "row-choice-0" | "column-choice-0" | "handover" | "advance" | "restart";

export interface HotSeatRound {
  readonly number: number;
  readonly rowAction: BinaryAction;
  readonly columnAction: BinaryAction;
  readonly rowPayoff: Rational;
  readonly columnPayoff: Rational;
}

export interface HotSeatState {
  readonly slug: HotSeatSlug;
  readonly phase: HotSeatPhase;
  readonly rounds: readonly HotSeatRound[];
  readonly pendingRowAction: BinaryAction | null;
  readonly rowScore: Rational;
  readonly columnScore: Rational;
  readonly focusTarget: HotSeatFocusTarget;
}

export type HotSeatAction =
  | { readonly type: "commit-row"; readonly action: BinaryAction }
  | { readonly type: "acknowledge-handover" }
  | { readonly type: "commit-column"; readonly action: BinaryAction }
  | { readonly type: "advance" }
  | { readonly type: "restart" };

export function createHotSeatSession(slug: HotSeatSlug): HotSeatState {
  return {
    slug,
    phase: "row-commit",
    rounds: [],
    pendingRowAction: null,
    rowScore: ZERO,
    columnScore: ZERO,
    focusTarget: "row-choice-0",
  };
}

export function reduceHotSeatSession(
  state: HotSeatState,
  action: HotSeatAction,
): HotSeatState {
  switch (action.type) {
    case "commit-row":
      if (state.phase !== "row-commit") {
        return state;
      }
      return {
        ...state,
        phase: "handover",
        pendingRowAction: action.action,
        focusTarget: "handover",
      };

    case "acknowledge-handover":
      if (state.phase !== "handover") {
        return state;
      }
      return {
        ...state,
        phase: "column-commit",
        focusTarget: "column-choice-0",
      };

    case "commit-column": {
      if (state.phase !== "column-commit" || state.pendingRowAction === null) {
        return state;
      }

      const game = catalogBySlug[state.slug].game;
      const rowAction = state.pendingRowAction;
      const columnAction = action.action;
      const [rowPayoff, columnPayoff] = payoffAt(game, {
        row: rowAction,
        column: columnAction,
      });
      const round: HotSeatRound = {
        number: state.rounds.length + 1,
        rowAction,
        columnAction,
        rowPayoff,
        columnPayoff,
      };

      return {
        ...state,
        phase: "reveal",
        rounds: [...state.rounds, round],
        pendingRowAction: null,
        rowScore: add(state.rowScore, rowPayoff),
        columnScore: add(state.columnScore, columnPayoff),
        focusTarget: "advance",
      };
    }

    case "advance": {
      if (state.phase !== "reveal") {
        return state;
      }
      const isComplete =
        state.rounds.length === hotSeatGameContent[state.slug].roundLimit;
      return {
        ...state,
        phase: isComplete ? "complete" : "row-commit",
        focusTarget: isComplete ? "restart" : "row-choice-0",
      };
    }

    case "restart":
      return state.phase === "complete"
        ? createHotSeatSession(state.slug)
        : state;
  }
}

export function hotSeatSessionToExport(state: HotSeatState): SessionExport {
  const content = hotSeatGameContent[state.slug];
  const game = catalogBySlug[state.slug].game;
  return buildSessionExport({
    kind: "hot-seat",
    game: state.slug,
    title: game.title,
    rowLabel: "Player 1",
    columnLabel: "Player 2",
    rounds: state.rounds.map((round) => ({
      rowAction: content.rowActions[round.rowAction],
      columnAction: content.columnActions[round.columnAction],
      rowPayoff: round.rowPayoff,
      columnPayoff: round.columnPayoff,
    })),
    rowTotal: state.rowScore,
    columnTotal: state.columnScore,
    meta: { mode: "hot-seat", rounds: state.rounds.length },
  });
}
