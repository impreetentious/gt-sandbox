"use client";

import { useMemo, useState } from "react";
import { GlossaryTerm } from "@/components/ui/glossary-term";
import { publicGoodsContent } from "@/content/public-goods";
import {
  classifyDilemma,
  cooperationDividend,
  deviationSweep,
  evaluateProfile,
  nashEquilibrium,
  uniformProfile,
  welfareOptimum,
  type PublicGoodsConfig,
} from "@/engine/nplayer";
import { formatRational } from "@/engine/rational";

interface Props {
  readonly config: PublicGoodsConfig;
  /** What the other players are each holding, so the sweep matches the arena. */
  readonly othersEach: number;
}

export function PublicGoodsPanel({ config, othersEach }: Props) {
  const verdict = useMemo(() => classifyDilemma(config), [config]);
  const nash = useMemo(() => nashEquilibrium(config), [config]);
  const optimum = useMemo(() => welfareOptimum(config), [config]);
  const dividend = useMemo(() => cooperationDividend(config), [config]);
  const sweep = useMemo(
    () => deviationSweep(config, othersEach),
    [config, othersEach],
  );
  const allDefect = useMemo(
    () => evaluateProfile(config, uniformProfile(config, 0)),
    [config],
  );
  const [sweepOpen, setSweepOpen] = useState(false);

  const reveal = publicGoodsContent.reveal;

  return (
    <div className="public-goods-panel">
      <p className="public-goods-panel__headline">{reveal.headline}</p>

      <section aria-labelledby="pg-dominance-title">
        <h3 id="pg-dominance-title">
          Why <GlossaryTerm term="free-riding" /> is dominant
        </h3>
        <p>{reveal.dominance}</p>
        <p className="public-goods-panel__algebra">
          Private return per token ={" "}
          <strong>
            MPCR − 1 = {formatRational(verdict.privateMarginalReturn)}
          </strong>
          {verdict.freeRidingIsDominant
            ? " — strictly negative, so every token you contribute costs you exactly that much."
            : " — not negative here, so contributing is privately worthwhile."}
        </p>
      </section>

      <section aria-labelledby="pg-efficiency-title">
        <h3 id="pg-efficiency-title">Why cooperation is efficient anyway</h3>
        <p>{reveal.efficiency}</p>
        <p className="public-goods-panel__algebra">
          Social return per token ={" "}
          <strong>
            MPCR × N − 1 = {formatRational(verdict.socialMarginalReturn)}
          </strong>
          {verdict.cooperationIsEfficient
            ? " — strictly positive, so each token grows the pie by that much."
            : " — not positive here, so the pot no longer grows the pie."}
        </p>
      </section>

      <section aria-labelledby="pg-window-title">
        <h3 id="pg-window-title">
          The <GlossaryTerm term="marginal-per-capita-return" /> window
        </h3>
        <p>{reveal.window}</p>
        <p
          className="public-goods-panel__verdict"
          data-dilemma={verdict.isSocialDilemma}
        >
          {verdict.isSocialDilemma
            ? `With N = ${config.playerCount} this MPCR sits inside the dilemma window: 1/${config.playerCount} < MPCR < 1.`
            : `With N = ${config.playerCount} this MPCR sits outside the dilemma window, so the tension disappears.`}
        </p>
      </section>

      <section aria-labelledby="pg-outcomes-title">
        <h3 id="pg-outcomes-title">
          <GlossaryTerm term="nash-equilibrium" /> against the{" "}
          <GlossaryTerm term="pareto-efficient" /> outcome
        </h3>
        <table className="public-goods-panel__outcomes">
          <caption>
            Exact per-player payoffs at the two reference profiles.
          </caption>
          <thead>
            <tr>
              <th scope="col">Profile</th>
              <th scope="col">Each contributes</th>
              <th scope="col">Each earns</th>
              <th scope="col">Total welfare</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nash equilibrium</th>
              <td>
                {nash.equilibriumContribution === null
                  ? "—"
                  : nash.equilibriumContribution}
              </td>
              <td>
                {nash.outcome ? formatRational(nash.outcome.payoffs[0]) : "—"}
              </td>
              <td>
                {nash.outcome ? formatRational(nash.outcome.welfare) : "—"}
              </td>
            </tr>
            <tr>
              <th scope="row">Welfare optimum</th>
              <td>{optimum.contributions[0]}</td>
              <td>{formatRational(optimum.payoffs[0])}</td>
              <td>{formatRational(optimum.welfare)}</td>
            </tr>
          </tbody>
        </table>
        <p>{nash.reason}</p>
        {verdict.isSocialDilemma ? (
          <p className="public-goods-panel__dividend">
            Every player would be <strong>{formatRational(dividend)}</strong>{" "}
            better off under full contribution than at the equilibrium (
            {formatRational(optimum.payoffs[0])} against{" "}
            {formatRational(allDefect.payoffs[0])}) — and not one of them can
            reach it alone.
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="pg-sweep-title"
        className="public-goods-panel__sweep"
      >
        <h3 id="pg-sweep-title">The arithmetic, token by token</h3>
        <p>
          Holding the other {config.playerCount - 1} players at {othersEach}{" "}
          token{othersEach === 1 ? "" : "s"} each, here is what every choice you
          could make pays you — and pays the group.
        </p>
        <button
          aria-expanded={sweepOpen}
          className="public-goods-panel__sweep-toggle"
          onClick={() => setSweepOpen((open) => !open)}
          type="button"
        >
          {sweepOpen ? "Hide the exact sweep" : "Show the exact sweep"}
        </button>
        {sweepOpen ? (
          <table className="public-goods-panel__sweep-table">
            <caption>
              Your payoff and total welfare at every contribution you could
              choose, in exact rationals.
            </caption>
            <thead>
              <tr>
                <th scope="col">You contribute</th>
                <th scope="col">You earn</th>
                <th scope="col">Each other earns</th>
                <th scope="col">Total welfare</th>
              </tr>
            </thead>
            <tbody>
              {sweep.map((row) => (
                <tr key={row.contribution}>
                  <th scope="row">{row.contribution}</th>
                  <td>{formatRational(row.ownPayoff)}</td>
                  <td>{formatRational(row.otherPayoff)}</td>
                  <td>{formatRational(row.welfare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>

      <section aria-labelledby="pg-why-title">
        <h3 id="pg-why-title">Why the distinction matters</h3>
        <p>{reveal.whyItMatters}</p>
      </section>
    </div>
  );
}
