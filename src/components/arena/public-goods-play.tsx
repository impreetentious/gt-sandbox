"use client";

import { useMemo, useState } from "react";
import { PublicGoodsPanel } from "@/components/analysis/public-goods-panel";
import { publicGoodsContent } from "@/content/public-goods";
import {
  createPublicGoodsConfig,
  evaluateProfile,
  type PublicGoodsConfig,
} from "@/engine/nplayer";
import { compare, formatRational, rational } from "@/engine/rational";

const ENDOWMENT = 10;
const MPCR_DENOMINATOR = 20n;
/** MPCR runs 1/20 … 20/20 so the whole slider stays exactly representable. */
const MPCR_MIN = 1;
const MPCR_MAX = 20;

function rivalContribution(
  share: readonly [number, number],
  endowment: number,
): number {
  return Math.round((endowment * share[0]) / share[1]);
}

export function PublicGoodsExperience() {
  const [playerCount, setPlayerCount] = useState(4);
  const [mpcrStep, setMpcrStep] = useState(8); // 8/20 = 0.4
  const [rivalId, setRivalId] = useState(publicGoodsContent.rivals[1].id);
  const [ownContribution, setOwnContribution] = useState<number | null>(null);

  const rival =
    publicGoodsContent.rivals.find((option) => option.id === rivalId) ??
    publicGoodsContent.rivals[0];
  const othersEach = rivalContribution(rival.shareOfEndowment, ENDOWMENT);

  const config: PublicGoodsConfig = useMemo(
    () =>
      createPublicGoodsConfig({
        playerCount,
        endowment: ENDOWMENT,
        mpcr: rational(BigInt(mpcrStep), MPCR_DENOMINATOR),
      }),
    [playerCount, mpcrStep],
  );

  const outcome = useMemo(() => {
    if (ownContribution === null) return null;
    const profile = [
      ownContribution,
      ...Array.from({ length: playerCount - 1 }, () => othersEach),
    ];
    return evaluateProfile(config, profile);
  }, [config, ownContribution, othersEach, playerCount]);

  const counterfactual = useMemo(() => {
    if (ownContribution === null) return null;
    const alternative = ownContribution === 0 ? ENDOWMENT : 0;
    const profile = [
      alternative,
      ...Array.from({ length: playerCount - 1 }, () => othersEach),
    ];
    return {
      contribution: alternative,
      outcome: evaluateProfile(config, profile),
    };
  }, [config, ownContribution, othersEach, playerCount]);

  const mpcrLabel = formatRational(
    rational(BigInt(mpcrStep), MPCR_DENOMINATOR),
  );

  function reset() {
    setOwnContribution(null);
  }

  return (
    <section
      aria-labelledby="public-goods-title"
      className="public-goods"
      data-phase={outcome ? "complete" : "choosing"}
      data-players={playerCount}
    >
      <header className="public-goods__header">
        <p className="eyebrow">n-player / the public-goods dilemma</p>
        <h1 className="display" id="public-goods-title">
          Everyone gains if everyone gives. Nobody gains by giving.
        </h1>
        <p className="lede">{publicGoodsContent.framing}</p>
      </header>

      <div className="public-goods__layout">
        <section
          aria-labelledby="public-goods-setup-title"
          className="public-goods__setup"
        >
          <h2 id="public-goods-setup-title">The group</h2>

          <div className="public-goods__control">
            <label htmlFor="pg-players">
              Players in the group
              <output htmlFor="pg-players">{playerCount}</output>
            </label>
            <input
              id="pg-players"
              max={10}
              min={2}
              onChange={(event) => {
                setPlayerCount(Number(event.target.value));
                reset();
              }}
              step={1}
              type="range"
              value={playerCount}
            />
          </div>

          <div className="public-goods__control">
            <label htmlFor="pg-mpcr">
              Marginal per capita return
              <output htmlFor="pg-mpcr">{mpcrLabel}</output>
            </label>
            <input
              id="pg-mpcr"
              max={MPCR_MAX}
              min={MPCR_MIN}
              onChange={(event) => {
                setMpcrStep(Number(event.target.value));
                reset();
              }}
              step={1}
              type="range"
              value={mpcrStep}
            />
            <p className="public-goods__control-note">
              Each token in the pot returns {mpcrLabel} to every player,
              including whoever put it in.
            </p>
          </div>

          <fieldset className="public-goods__rivals">
            <legend>What the others do</legend>
            {publicGoodsContent.rivals.map((option) => (
              <label key={option.id}>
                <input
                  checked={rivalId === option.id}
                  name="pg-rival"
                  onChange={() => {
                    setRivalId(option.id);
                    reset();
                  }}
                  type="radio"
                  value={option.id}
                />
                <span>
                  <strong>{option.label}.</strong> {option.description}
                </span>
              </label>
            ))}
          </fieldset>
        </section>

        <section
          aria-labelledby="public-goods-act-title"
          className="public-goods__act"
        >
          <h2 id="public-goods-act-title">Your move</h2>
          <p className="public-goods__prompt">{publicGoodsContent.actPrompt}</p>

          <div className="public-goods__choices">
            {Array.from({ length: ENDOWMENT + 1 }, (_, tokens) => (
              <button
                aria-pressed={ownContribution === tokens}
                className="public-goods__choice"
                key={tokens}
                onClick={() => setOwnContribution(tokens)}
                type="button"
              >
                {tokens}
              </button>
            ))}
          </div>

          <p
            aria-live="polite"
            className="public-goods__narration"
            data-testid="pg-narration"
          >
            {outcome && ownContribution !== null ? (
              <>
                You contributed {ownContribution}; the pot held{" "}
                {outcome.groupTotal}. You earned{" "}
                <strong>{formatRational(outcome.payoffs[0])}</strong>. Each
                other player earned{" "}
                {playerCount > 1
                  ? formatRational(outcome.payoffs[1])
                  : formatRational(outcome.payoffs[0])}
                .
              </>
            ) : (
              "Pick a number of tokens to contribute."
            )}
          </p>

          {outcome && counterfactual && ownContribution !== null ? (
            <p
              className="public-goods__counterfactual"
              data-testid="pg-counterfactual"
            >
              Had you contributed {counterfactual.contribution} instead, you
              would have earned{" "}
              {formatRational(counterfactual.outcome.payoffs[0])} —{" "}
              {compare(
                counterfactual.outcome.payoffs[0],
                outcome.payoffs[0],
              ) === 1
                ? "more than you did."
                : compare(
                      counterfactual.outcome.payoffs[0],
                      outcome.payoffs[0],
                    ) === -1
                  ? "less than you did."
                  : "exactly what you did."}{" "}
              Group welfare would have been{" "}
              {formatRational(counterfactual.outcome.welfare)} against your{" "}
              {formatRational(outcome.welfare)}.
            </p>
          ) : null}

          {outcome ? (
            <button
              className="public-goods__reset"
              onClick={reset}
              type="button"
            >
              Play again
            </button>
          ) : null}

          <details className="analysis-drawer public-goods__analysis">
            <summary>Analysis / Public goods</summary>
            <PublicGoodsPanel config={config} othersEach={othersEach} />
          </details>
        </section>
      </div>
    </section>
  );
}
