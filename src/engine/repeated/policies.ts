/** The binary action indexes used by P2's Prisoner's Dilemma policies. */
export type BinaryAction = 0 | 1;

export type PdOpponentPolicy = "always:C" | "always:D" | "tft";

/**
 * Chooses the column player's next PD action from the player's completed
 * history. This is deliberately free of UI state, I/O, and randomness.
 */
export function decidePdOpponentAction(
  policy: PdOpponentPolicy,
  playerActions: readonly BinaryAction[],
): BinaryAction {
  switch (policy) {
    case "always:C":
      return 0;
    case "always:D":
      return 1;
    case "tft":
      return playerActions.at(-1) ?? 0;
  }
}
