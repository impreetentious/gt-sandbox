# Accessibility audit

This is the v1 audit ledger. Automated checks are part of `pnpm verify:full`; assistive-technology checks remain explicit human release work and must not be inferred from axe.

## Automated acceptance

| Check          | Coverage                                                                                                                | Status                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| axe            | Every exported route; Play, Evolve, and Build interaction states                                                        | Run in the final local verification pass |
| Keyboard       | Primary navigation, full Play sessions, Analysis disclosure/stepper, Evolve tabs/scrubber/table, Build controls         | Run in the final local verification pass |
| Reduced motion | Outcome highlighting and Evolution scrubber path                                                                        | Run in the final local verification pass |
| Reflow         | Evolution and bounded 4×4 Build at 320px; wide data remains inside labelled scroll regions                              | Run in the final local verification pass |
| Forced colors  | Selected game outcome and core control outlines                                                                         | Run in the final local verification pass |
| Semantics      | Real tables and headers for payoff matrices/data; live regions for outcomes, validation, and settled generation changes | Unit and browser covered |

## Manual release matrix

These checks require the owner’s platform and physical review. They are not deployment code blockers, but v1.0.0 should not claim manual sign-off until they are completed.

| Environment                         | Script                                                                               | Status                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| VoiceOver + Safari                  | Complete a PD session; open Analysis; step dominance; replay                         | Pending owner release pass                               |
| VoiceOver + Safari                  | Open Evolution; choose Noise; operate scrubber; open table                           | Pending owner release pass                               |
| VoiceOver + Safari                  | Edit both PD temptation payoffs; hear the structure change; copy/fallback share link | Pending owner release pass                               |
| Second screen reader when available | Repeat one Play flow and the Build validation failure                                | Pending owner release pass                               |
| Keyboard only                       | Run all three surface scripts without pointer input                                  | Browser-automated; manual spot-check pending             |
| Browser zoom 200%                   | Inspect Play, Evolve, Build 4×4, Methods, and 404                                    | Browser-automated Build path; manual visual pass pending |
| Forced-colors mode                  | Confirm focus, selected tabs, matrix outcomes, and warnings remain distinguishable   | Browser-automated spot check; manual visual pass pending |

## Manual scripts

1. **Play:** From `/play/pd/`, choose Copycat. Complete ten rounds with keys `1` and `2`, confirm each outcome is announced once, open Analysis, step through dominance, toggle Pareto dimming, and activate Play again.
2. **Evolve:** From `/evolve/`, enter Evolution, select Noise, change action noise, move the generation scrubber with arrow keys and End, isolate a strategy band, and inspect the complete table.
3. **Build:** From `/play/pd/`, edit both temptation payoffs from `5` to `2`, confirm the dilemma-to-assurance announcement and two NE badges, enter an invalid seven-decimal payoff, correct it without lost focus, then exercise copy and manual-copy paths.

Record browser/OS/screen-reader versions and any findings below before tagging v1.0.0.
