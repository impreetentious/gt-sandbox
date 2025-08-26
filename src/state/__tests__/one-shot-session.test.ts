import { describe, expect, it } from "vitest";
import { equals } from "@/engine/rational";
import {
  createOneShotSession,
  reduceOneShotSession,
} from "@/state/one-shot-session";

function commitChoice(
  state: ReturnType<typeof createOneShotSession>,
  action: 0 | 1,
) {
  return reduceOneShotSession(
    reduceOneShotSession(state, { type: "submit-choice", action }),
    { type: "commit-outcome" },
  );
}

describe("P5 shared one-shot session reducer", () => {
  it("uses the selected catalog game and rejects actions during a staged outcome", () => {
    const ready = createOneShotSession("chicken", "always:1", 9);
    const resolving = reduceOneShotSession(ready, {
      type: "submit-choice",
      action: 1,
    });

    expect(
      reduceOneShotSession(resolving, { type: "submit-choice", action: 0 }),
    ).toBe(resolving);
    expect(resolving.pendingRound).toMatchObject({
      playerAction: 1,
      opponentAction: 1,
      playerPayoff: { numerator: -10n, denominator: 1n },
    });
  });

  it("keeps persona selection in its game and resets after a completed session", () => {
    const initial = createOneShotSession("stag", "fsm:trusting", 9);
    expect(
      reduceOneShotSession(initial, {
        type: "select-persona",
        persona: "markov2",
      }),
    ).toBe(initial);

    let state = createOneShotSession("bos", "fictitious", 9);
    for (let round = 0; round < 10; round += 1) {
      state = commitChoice(state, 0);
    }

    expect(state.status).toBe("complete");
    expect(state.focusTarget).toBe("play-again");
    expect(equals(state.playerScore, { numerator: 18n, denominator: 1n })).toBe(
      true,
    );

    const reset = reduceOneShotSession(state, { type: "play-again" });
    expect(reset).toMatchObject({
      status: "playing",
      rounds: [],
      focusTarget: "choice-0",
    });
    expect(reset.seed).not.toBe(state.seed);
  });

  it("lets a committed BoS player train the Learner to concede to A", () => {
    let state = createOneShotSession("bos", "fictitious", 12);
    const learnerActions: number[] = [];

    for (let round = 0; round < 6; round += 1) {
      state = commitChoice(state, 0);
      learnerActions.push(state.rounds.at(-1)?.opponentAction ?? -1);
    }

    expect(learnerActions).toEqual([1, 0, 0, 0, 0, 0]);
    expect(learnerActions.slice(1)).toEqual([0, 0, 0, 0, 0]);
  });
});
