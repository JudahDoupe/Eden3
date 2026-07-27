import { cardById } from "../game/cards";
import { useGameSnapshot, useGameStore } from "./useGame";

/**
 * The player's hand.
 *
 * An unplayable card is shown greyed with the reason it cannot be played,
 * because "no legal play" is a loss condition — a rejection the player cannot
 * understand makes losing feel arbitrary rather than earned.
 */
export function Hand() {
  const store = useGameStore();
  const { hand, selectedCard, deckRemaining, phase } = useGameSnapshot();

  if (phase === "won" || phase === "lost") return null;

  return (
    <div className="hand">
      {hand.map((cardId) => {
        const card = cardById(cardId);
        const { playable, reason } = store.playability(cardId);
        const selected = selectedCard === cardId;

        return (
          <button
            key={cardId}
            type="button"
            className={`card ${playable ? "" : "card--dead"} ${selected ? "card--selected" : ""}`}
            style={{ borderTopColor: `#${card.colorHex.toString(16).padStart(6, "0")}` }}
            onClick={() => store.selectCard(selected ? null : cardId)}
          >
            <span className="card__name">{card.name}</span>
            <span className="card__blurb">{card.blurb}</span>

            <span className="card__rules">
              <b>on</b> {card.requiresTags.join(" + ").toLowerCase() || "anything"}
              {card.removesTags?.length ? (
                <>
                  <br />
                  <b>loses</b> {card.removesTags.join(", ").toLowerCase()}
                </>
              ) : null}
            </span>

            {!playable && reason ? <span className="card__reason">{reason}</span> : null}

            {playable && selected ? (
              <span className="card__hint">click a highlighted voxel</span>
            ) : null}

            <span
              className="card__cycle"
              role="button"
              tabIndex={0}
              title="Send to the bottom of the deck. Costs a turn."
              onClick={(event) => {
                event.stopPropagation();
                store.cycleCard(cardId);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.stopPropagation();
                store.cycleCard(cardId);
              }}
            >
              cycle
            </span>
          </button>
        );
      })}

      <div className="hand__deck">
        <b>{deckRemaining}</b>
        <span>left</span>
      </div>
    </div>
  );
}
