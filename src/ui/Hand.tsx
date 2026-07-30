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
      {hand.map((cardId, index) => {
        const card = cardById(cardId);
        const { playable, reason } = store.playability(cardId);
        const selected = selectedCard === cardId;
        
        // Calculate z-index and scale for visual feedback
        let zIndex = 0;
        let scale = 1;
        if (selected) {
          zIndex = 1000;
          scale = 2;
        } else if (index < hand.indexOf(selectedCard)) {
          zIndex = 1000 - (hand.indexOf(selectedCard) - index);
        }

        return (
          <button
            key={cardId}
            type="button"
            className={`card ${playable ? "" : "card--dead"} ${selected ? "card--selected" : ""}`}
            style={{ 
              borderTopColor: `#${card.colorHex.toString(16).padStart(6, "0")}`,
              height: '17rem',
              width: '9.5rem',
              fontSize: '1.2rem', // Increased text size for better mobile readability
              zIndex,
              transform: `scale(${scale})`,
              transition: 'transform 0.2s ease, z-index 0.2s ease'
            }}
            onClick={() => store.selectCard(selected ? null : cardId)}
          >
            <span className="card__name" style={{ fontSize: '1.1rem' }}>{card.name}</span>
            <span className="card__blurb" style={{ fontSize: '0.9rem' }}>{card.blurb}</span>

            <span className="card__rules" style={{ fontSize: '0.85rem' }}>
              <b>on</b> {card.requiresTags.join(" + ").toLowerCase() || "anything"}
              {card.removesTags?.length ? (
                <>
                  <br />
                  <b>loses</b> {card.removesTags.join(", ").toLowerCase()}
                </>
              ) : null}
            </span>

            {!playable && reason ? <span className="card__reason" style={{ fontSize: '0.85rem' }}>{reason}</span> : null}

            {playable && selected ? (
              <span className="card__hint" style={{ fontSize: '0.85rem' }}>click a highlighted voxel</span>
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
        <b style={{ fontSize: '1.3rem' }}>{deckRemaining}</b>
        <span style={{ fontSize: '0.9rem' }}>left</span>
      </div>

      <div className="hand__buttons">
        <button 
          type="button" 
          className="hand__pass"
          onClick={() => store.pass()}
        >
          Pass
        </button>
        <button 
          type="button" 
          className="hand__play"
          disabled={!selectedCard}
          onClick={() => store.playSelectedCard()}
        >
          Play
        </button>
      </div>
    </div>
  );
}
