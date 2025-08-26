import { describe, expect, it } from "vitest";
import { createIpdSession, reduceIpdSession } from "@/state/ipd-session";

function commitChoice(
  state: ReturnType<typeof createIpdSession>,
  action: 0 | 1,
) {
  return reduceIpdSession(
    reduceIpdSession(state, { type: "submit-choice", action }),
    { type: "commit-outcome" },
  );
}

describe("P6 interactive IPD session reducer", () => {
  it("stages a TFT response from realized history and rejects double submission", () => {
    const ready = createIpdSession("tft", 10);
    const resolving = reduceIpdSession(ready, {
      type: "submit-choice",
      action: 1,
    });

    expect(
      reduceIpdSession(resolving, { type: "submit-choice", action: 0 }),
    ).toBe(resolving);
    expect(resolving.pendingRound).toMatchObject({
      row: { intendedAction: 1, action: 1 },
      column: { intendedAction: 0, action: 0 },
    });

    const first = reduceIpdSession(resolving, { type: "commit-outcome" });
    const second = commitChoice(first, 0);
    expect(second.rounds.at(-1)).toMatchObject({
      row: { intendedAction: 0, action: 0 },
      column: { intendedAction: 1, action: 1 },
    });
  });

  it("selects a mystery rival deterministically and resets after the seeded match", () => {
    const initial = createIpdSession("tft", 33);
    const mystery = reduceIpdSession(initial, {
      type: "select-opponent",
      opponent: "mystery",
    });

    expect(mystery.mystery).toBe(true);
    expect(mystery.config.masterSeed).toBe(33);
    expect(mystery.opponentStrategy).toBe("alld");

    let completed = mystery;
    for (let round = 0; round < completed.length.rounds; round += 1) {
      completed = commitChoice(completed, 0);
    }

    expect(completed.status).toBe("complete");
    expect(completed.focusTarget).toBe("play-again");
    const replay = reduceIpdSession(completed, { type: "play-again" });
    expect(replay).toMatchObject({
      status: "playing",
      rounds: [],
      focusTarget: "choice-0",
      selectedOpponent: "mystery",
    });
    expect(replay.config.masterSeed).not.toBe(completed.config.masterSeed);
  });
});
