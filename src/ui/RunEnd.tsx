import { useGameSnapshot, useGameStore } from "./useGame";

/** The end-of-run screen. Rendered only once the run is decided. */
export function RunEnd() {
  const store = useGameStore();
  const { phase, outcome, turn, cardsPlayed, extinctSpecies } = useGameSnapshot();

  if (phase !== "won" && phase !== "lost") return null;

  return (
    <div className="runend">
      <div className="runend__card">
        <h1 className={phase === "won" ? "runend__won" : "runend__lost"}>
          {phase === "won" ? "Ecosystem complete" : "Run over"}
        </h1>
        <p className="runend__reason">{outcome}</p>
        <dl className="runend__stats">
          <dt>Turns</dt>
          <dd>{turn}</dd>
          <dt>Mutations played</dt>
          <dd>{cardsPlayed}</dd>
          <dt>Extinctions</dt>
          <dd>{extinctSpecies}</dd>
        </dl>
        <button type="button" onClick={() => store.reset()}>
          New run
        </button>
      </div>
    </div>
  );
}
