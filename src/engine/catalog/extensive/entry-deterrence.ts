import { createExtensiveGame } from "@/engine/extensive";
import { rational } from "@/engine/rational";
import type { ExtensiveCatalogGame } from "@/engine/catalog/extensive/types";

/**
 * Entry deterrence — the classic sequential-move business game.
 *
 * Entrant (E) moves first: In or Out.
 * If Out, E gets 0 and the Incumbent (I) keeps the monopoly profit 2.
 * If In, the Incumbent chooses Fight or Accommodate.
 *   Fight: brutal price war, both lose 1.
 *   Accommodate: shared market, both get 1.
 *
 * Backward induction: at the Incumbent decision node, Accommodate (1) > Fight (-1)
 * for the Incumbent. Anticipating this, the Entrant prefers In (1) over Out (0).
 * SPNE = (In, Accommodate) with payoffs (1, 1).
 *
 * A famous non-subgame-perfect Nash: (Out, "Fight if entered"). The Incumbent's
 * threat is not credible — if the Entrant actually entered, fighting would strictly
 * hurt the Incumbent — but if the Entrant believes the threat, Out is a best reply
 * to it, and the threat is untested. Subgame perfection is exactly the refinement
 * that rules this out.
 */
const entryDeterrenceGame = createExtensiveGame({
  id: "entry-deterrence",
  title: "Entry Deterrence",
  players: ["Entrant", "Incumbent"],
  root: {
    kind: "decision",
    id: "entrant-move",
    player: "Entrant",
    actions: ["In", "Out"],
    informationSet: "entrant-move",
    children: [
      {
        kind: "decision",
        id: "incumbent-move",
        player: "Incumbent",
        actions: ["Fight", "Accommodate"],
        informationSet: "incumbent-move",
        children: [
          {
            kind: "terminal",
            id: "fight",
            payoffs: [rational(-1n), rational(-1n)],
          },
          {
            kind: "terminal",
            id: "accommodate",
            payoffs: [rational(1n), rational(1n)],
          },
        ],
      },
      {
        kind: "terminal",
        id: "stay-out",
        payoffs: [rational(0n), rational(2n)],
      },
    ],
  },
});

export const entryDeterrence: ExtensiveCatalogGame = {
  slug: "entry-deterrence",
  concept: "subgame-perfect equilibrium via backward induction",
  game: entryDeterrenceGame,
  oracle: {
    spne: {
      label: "Enter; accommodate on entry",
      strategy: new Map([
        ["entrant-move", 0],
        ["incumbent-move", 1],
      ]),
      payoffs: [1, 1],
    },
    nonSubgamePerfectNash: [
      {
        label: "Stay out; threaten to fight",
        strategy: new Map([
          ["entrant-move", 1],
          ["incumbent-move", 0],
        ]),
        payoffs: [0, 2],
      },
    ],
  },
};
