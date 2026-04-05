# Accessibility testing

Accessibility regressions are release gates, but automated checks are not a substitute for assistive-technology testing. `pnpm verify:full` builds the static export and exercises it in Chromium.

## Automated coverage

| Area            | Coverage                                                                                                                         |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| axe             | Every exported route discovered from `out/`, key interaction states, and both light and dark palettes                            |
| Keyboard        | Primary navigation, complete game sessions, analysis controls, evolution, Build, hot-seat, Repeat, auctions, and classroom flows |
| Reduced motion  | Outcome highlighting and the Evolution scrubber                                                                                  |
| Reflow and zoom | Evolution and the bounded 4×4 editor at narrow width and 200% zoom                                                               |
| Forced colors   | Selected outcomes, core controls, focus indicators, and key launch surfaces                                                      |
| Semantics       | Payoff/data tables, headings, form labels, validation, live outcomes, and generation announcements                               |

The browser suite also rejects off-origin requests, CSP errors, inaccessible deep links, and route-specific framing drift. Component tests cover state restoration and interaction details that are faster and more precise below the browser layer.

## Recommended manual checks

Run these checks on the production candidate because browser automation cannot validate screen-reader speech, platform focus behavior, or visual clarity:

1. With VoiceOver and Safari, complete a Prisoner's Dilemma session, open Analysis, step through dominance, toggle Pareto highlighting, and replay.
2. With VoiceOver and Safari, select the Noise evolution preset, operate the generation scrubber, isolate a strategy band, and inspect the table fallback.
3. Edit both Prisoner's Dilemma temptation payoffs, confirm the announced structure change, correct an invalid payoff without losing focus, and exercise both share-link copy paths.
4. Complete the core flows using only the keyboard, including hot-seat handover, Repeat, one auction, and classroom JSON-to-CSV ingest.
5. At 200% zoom and at 320 CSS pixels, inspect Play, Evolve, the 4×4 editor, Methods, and the not-found page for clipping or lost controls.
6. In forced-colors mode, confirm that focus, selected tabs, matrix outcomes, warnings, and chart selections remain distinguishable.

Record the browser, operating system, screen reader, and any findings with the release evidence used by the project maintainers.
