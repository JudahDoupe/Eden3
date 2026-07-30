import { cardById } from "../game/cards";
import { useGameSnapshot, useGameStore } from "./useGame";
import { useEffect, useRef } from "react";

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
  const handRef = useRef<HTMLDivElement>(null);

  if (phase === "won" || phase === "lost") return null;

  // Position cards in an arc
  useEffect(() => {
    if (!handRef.current) return;
      
      const handElement = handRef.current;
      const cardElements = Array.from(handElement.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.classList.contains('card')
      );
      
      if (cardElements.length === 0) return;

      // Calculate arc parameters
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight - 48; // 3rem = 48px bottom offset
      const radius = 150; // Distance from center to cards
      
      // Position cards in an arc using trigonometry
      const totalCards = cardElements.length;
      const angleOffset = Math.PI / 2; // Start from top center
      const angleStep = (Math.PI) / Math.max(1, totalCards - 1); // Total angle is π for an arc

      cardElements.forEach((card, index) => {
        const angle = angleOffset + index * angleStep;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        // Apply 3D-like positioning
        const distanceFromCenter = Math.abs(index - (totalCards - 1) / 2);
        const depth = Math.max(0, 50 - distanceFromCenter * 10); // Depth effect
        const scale = Math.max(0.7, 1 - distanceFromCenter * 0.15); // Scale down for outer cards
        
        card.style.transform = `translate(${x}px, ${y}px) translateZ(${depth}px) scale(${scale})`;
        card.style.position = 'absolute';
        card.style.zIndex = `${100 + index}`;
      });
    }, [hand]);

  return (
    <div className="hand" ref={handRef}>
      {hand.map((cardId, index) => {
        const card = cardById(cardId);
        const { playable, reason } = store.playability(cardId);
        const selected = selectedCard === cardId;
        
        // Calculate z-index and scale for visual feedback
        let zIndex = 0;
        if (selected) {
          zIndex = 1000;
        } else if (selectedCard !== null && index < hand.indexOf(selectedCard)) {
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
              transformOrigin: 'bottom',
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
    </div>
  );
}
