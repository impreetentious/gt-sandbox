import { describe, expect, it } from "vitest";
import { equals } from "@/engine/rational";
import {
  createPdSession,
  PD_SESSION_ROUNDS,
  reducePdSession,
} from "@/state/pd-session";

function commitChoice(
  state: ReturnType<typeof createPdSession>,
  action: 0 | 1,
) {
  return reducePdSession(
    reducePdSession(state, { type: "submit-choice", action }),
    { type: "commit-outcome" },
  );
}

describe("P2 PD session reducer", () => {
  it("stages the next payoff from the catalog and rejects a double-submit", () => {
    const ready = createPdSession("always:D");
    const resolving = reducePdSession(ready, {
      type: "submit-choice",
      action: 0,
    });
    const duplicateSubmit = reducePdSession(resolving, {
      type: "submit-choice",
      action: 1,
    });

    expect(duplicateSubmit).toBe(resolving);
    expect(resolving.pendingRound).toMatchObject({
      number: 1,
      playerAction: 0,
      opponentAction: 1,
    });

    const committed = reducePdSession(resolving, { type: "commit-outcome" });
    expect(committed.status).toBe("playing");
    expect(committed.rounds).toHaveLength(1);
    expect(
      equals(committed.playerScore, { numerator: 0n, denominator: 1n }),
    ).toBe(true);
    expect(
      equals(committed.opponentScore, { numerator: 5n, denominator: 1n }),
    ).toBe(true);
    expect(committed.focusTarget).toBe("choice-0");
  });

  it("keeps a staged outcome coherent when a transition is interrupted", () => {
    const resolving = reducePdSession(createPdSession("tft"), {
      type: "submit-choice",
      action: 1,
    });
    const committed = reducePdSession(resolving, { type: "commit-outcome" });
    const repeatedCommit = reducePdSession(committed, {
      type: "commit-outcome",
    });

    expect(repeatedCommit).toBe(committed);
    expect(committed.rounds).toEqual([
      expect.objectContaining({ playerAction: 1, opponentAction: 0 }),
    ]);
    expect(committed.focusTarget).toBe("choice-1");
  });

  it("has Copycat cooperate first and then mirror the previous move", () => {
    const firstRound = commitChoice(createPdSession("tft"), 1);
    const secondRound = commitChoice(firstRound, 0);

    expect(firstRound.rounds[0]).toMatchObject({
      playerAction: 1,
      opponentAction: 0,
    });
    expect(secondRound.rounds[1]).toMatchObject({
      playerAction: 0,
      opponentAction: 1,
    });
  });

  it("moves focus to replay at session end and resets to the first choice", () => {
    let state = createPdSession("always:C", 7);

    for (let round = 0; round < PD_SESSION_ROUNDS; round += 1) {
      state = commitChoice(state, 0);
    }

    expect(state.status).toBe("complete");
    expect(state.focusTarget).toBe("play-again");

    const reset = reducePdSession(state, { type: "play-again" });
    expect(reset.status).toBe("playing");
    expect(reset.rounds).toEqual([]);
    expect(reset.seed).not.toBe(state.seed);
    expect(reset.focusTarget).toBe("choice-0");
  });
});
