import { describe, expect, it } from "vitest";
import { bos } from "@/engine/catalog/bos";
import { pennies } from "@/engine/catalog/pennies";
import { stag } from "@/engine/catalog/stag";
import {
  decideOneShotOpponentAction,
  decidePdOpponentAction,
  predictMarkov2PlayerAction,
} from "@/engine/repeated/policies";

describe("P2 PD opponent policies", () => {
  it("plays the fixed action for Saint and Cynic", () => {
    expect(decidePdOpponentAction("always:C", [1, 1])).toBe(0);
    expect(decidePdOpponentAction("always:D", [0, 0])).toBe(1);
  });

  it("starts cooperative and then mirrors the player's latest action", () => {
    expect(decidePdOpponentAction("tft", [])).toBe(0);
    expect(decidePdOpponentAction("tft", [0, 1, 0])).toBe(0);
    expect(decidePdOpponentAction("tft", [0, 0, 1])).toBe(1);
  });
});

describe("P5 one-shot opponent personas", () => {
  it("uses fixed actions and deterministic seeded random policies", () => {
    expect(
      decideOneShotOpponentAction({
        policy: "always:0",
        game: bos.game,
        playerActions: [1, 1],
        seed: 1,
        round: 2,
      }),
    ).toEqual({ action: 0 });
    expect(
      decideOneShotOpponentAction({
        policy: "always:1",
        game: bos.game,
        playerActions: [0, 0],
        seed: 1,
        round: 2,
      }),
    ).toEqual({ action: 1 });

    const first = decideOneShotOpponentAction({
      policy: "random:1/3",
      game: bos.game,
      playerActions: [],
      seed: 987,
      round: 3,
    });
    const repeated = decideOneShotOpponentAction({
      policy: "random:1/3",
      game: bos.game,
      playerActions: [],
      seed: 987,
      round: 3,
    });

    expect(repeated).toEqual(first);
  });

  it("follows the Trusting and Cautious Stag-Hunt FSM specifications", () => {
    expect(
      decideOneShotOpponentAction({
        policy: "fsm:trusting",
        game: stag.game,
        playerActions: [],
        seed: 4,
        round: 0,
      }),
    ).toEqual({ action: 0 });
    expect(
      decideOneShotOpponentAction({
        policy: "fsm:trusting",
        game: stag.game,
        playerActions: [0, 1],
        seed: 4,
        round: 2,
      }),
    ).toEqual({ action: 1 });
    expect(
      decideOneShotOpponentAction({
        policy: "fsm:cautious",
        game: stag.game,
        playerActions: [0],
        seed: 4,
        round: 1,
      }),
    ).toEqual({ action: 1 });
    expect(
      decideOneShotOpponentAction({
        policy: "fsm:cautious",
        game: stag.game,
        playerActions: [0, 0, 1],
        seed: 4,
        round: 3,
      }),
    ).toEqual({ action: 1 });
  });

  it("makes the fictitious learner best-respond to an add-one-smoothed history", () => {
    expect(
      decideOneShotOpponentAction({
        policy: "fictitious",
        game: bos.game,
        playerActions: [],
        seed: 11,
        round: 0,
      }),
    ).toEqual({ action: 1 });
    expect(
      decideOneShotOpponentAction({
        policy: "fictitious",
        game: bos.game,
        playerActions: [0, 0, 0],
        seed: 11,
        round: 3,
      }),
    ).toEqual({ action: 0 });
  });

  it("uses add-one Markov-2 counts and a seeded tie breaker", () => {
    expect(predictMarkov2PlayerAction([], 4, 0)).toBe(
      predictMarkov2PlayerAction([], 4, 0),
    );
    expect(predictMarkov2PlayerAction([0, 1, 0, 1, 0], 4, 5)).toBe(1);

    const decision = decideOneShotOpponentAction({
      policy: "markov2",
      game: pennies.game,
      playerActions: [0, 0, 0, 0],
      seed: 4,
      round: 4,
    });

    expect(decision).toEqual({ action: 1, predictedPlayerAction: 0 });
  });
});
