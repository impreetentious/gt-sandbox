import { describe, expect, it } from "vitest";
import { formatRational } from "@/engine/rational";
import {
  createHotSeatSession,
  hotSeatSessionToExport,
  reduceHotSeatSession,
  type HotSeatState,
} from "@/state/hot-seat-session";

function playRound(
  state: HotSeatState,
  rowAction: 0 | 1,
  columnAction: 0 | 1,
): HotSeatState {
  let next = reduceHotSeatSession(state, {
    type: "commit-row",
    action: rowAction,
  });
  next = reduceHotSeatSession(next, { type: "acknowledge-handover" });
  next = reduceHotSeatSession(next, {
    type: "commit-column",
    action: columnAction,
  });
  return reduceHotSeatSession(next, { type: "advance" });
}

describe("hot-seat session reducer", () => {
  it("moves through commit, handover, commit, and reveal in order", () => {
    const start = createHotSeatSession("pd");
    expect(start.phase).toBe("row-commit");

    const committed = reduceHotSeatSession(start, {
      type: "commit-row",
      action: 1,
    });
    expect(committed.phase).toBe("handover");
    expect(committed.pendingRowAction).toBe(1);
    expect(committed.focusTarget).toBe("handover");

    const handedOver = reduceHotSeatSession(committed, {
      type: "acknowledge-handover",
    });
    expect(handedOver.phase).toBe("column-commit");

    const revealed = reduceHotSeatSession(handedOver, {
      type: "commit-column",
      action: 0,
    });
    expect(revealed.phase).toBe("reveal");
    expect(revealed.rounds).toHaveLength(1);
    // PD (Defect, Cooperate) pays the row player the temptation 5.
    expect(formatRational(revealed.rowScore)).toBe("5");
    expect(formatRational(revealed.columnScore)).toBe("0");
  });

  it("ignores out-of-phase actions so a hidden choice cannot be skipped", () => {
    const start = createHotSeatSession("pd");
    // Column cannot commit before row.
    expect(
      reduceHotSeatSession(start, { type: "commit-column", action: 0 }),
    ).toBe(start);
    // Advancing before a reveal is a no-op.
    expect(reduceHotSeatSession(start, { type: "advance" })).toBe(start);

    const committed = reduceHotSeatSession(start, {
      type: "commit-row",
      action: 0,
    });
    // A second row commit during handover is rejected.
    expect(
      reduceHotSeatSession(committed, { type: "commit-row", action: 1 }),
    ).toBe(committed);
  });

  it("completes exactly at the round limit and restarts fresh", () => {
    let state = createHotSeatSession("pd");
    for (let round = 0; round < 10; round += 1) {
      state = playRound(state, 1, 1);
    }
    expect(state.phase).toBe("complete");
    expect(state.rounds).toHaveLength(10);
    expect(formatRational(state.rowScore)).toBe("10");

    const restarted = reduceHotSeatSession(state, { type: "restart" });
    expect(restarted.phase).toBe("row-commit");
    expect(restarted.rounds).toHaveLength(0);
  });

  it("does not complete before the limit on the longer pennies session", () => {
    let state = createHotSeatSession("pennies");
    for (let round = 0; round < 10; round += 1) {
      state = playRound(state, 0, 1);
    }
    expect(state.phase).toBe("row-commit");
    expect(state.rounds).toHaveLength(10);
  });

  it("builds a valid session export from completed play", () => {
    let state = createHotSeatSession("pd");
    state = playRound(state, 0, 0);
    state = playRound(state, 1, 1);
    const exported = hotSeatSessionToExport(state);

    expect(exported.kind).toBe("hot-seat");
    expect(exported.game).toBe("pd");
    expect(exported.rounds).toHaveLength(2);
    expect(exported.rounds[0].rowAction).toBe("Hold price");
    expect(exported.rowTotal).toBe("4");
    expect(exported.columnTotal).toBe("4");
  });
});
