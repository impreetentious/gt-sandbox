# Accessibility audit

This is the v1 audit ledger. Automated checks are part of `pnpm verify:full`; assistive-technology checks remain explicit human release work and must not be inferred from axe. The current component/unit suite passes, but the managed local environment cannot bind the exported-site server port, so the authored browser scenarios still need an unrestricted release run.

## Automated acceptance

| Check          | Coverage                                                                                                                                                  | Status                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| axe            | Every exported route; Play, Evolve, Build, and additional-feature interaction states                                                                      | Automated in Playwright (22/22 on S28 tree); owner AT pass still pending |
| Keyboard       | Primary navigation, full Play sessions, Analysis disclosure/stepper, Evolve tabs/scrubber/table, Build controls, hot-seat / repeat / auctions / classroom | Automated scenarios authored; owner spot-check pending                   |
| Reduced motion | Outcome highlighting and Evolution scrubber path                                                                                                          | Scenario authored; unrestricted browser run pending                      |
| Reflow         | Evolution and bounded 4×4 Build at 320px; wide data remains inside labelled scroll regions                                                                | Scenario authored; unrestricted browser run pending                      |
| Forced colors  | Selected game outcome and core control outlines                                                                                                           | Scenario authored; unrestricted browser run pending                      |
| Semantics      | Real tables and headers for payoff matrices/data; live regions for outcomes, validation, and settled generation changes                                   | Component suite passes; browser scan pending                             |

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
4. **Hot-seat / Repeat / Auctions / Classroom:** Spot-check `/hot-seat/pd/` (commit → handover → reveal), `/repeat/` (region + table), one auction format, and `/classroom/` JSON ingest → CSV. Keyboard-only and VoiceOver optional but recommended before v1.0.0.

Record browser/OS/screen-reader versions and any findings below before tagging v1.0.0.
