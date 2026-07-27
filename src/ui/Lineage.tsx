import { inspectSpecies } from "../game/inspect";
import { useGameSnapshot, useGameStore } from "./useGame";

/**
 * The evolutionary tree the run has built so far.
 *
 * Every mutation branches rather than transforms, so this is the actual record
 * of what the player made. Extinct branches stay visible — a lineage you lost
 * is part of the story of the run, and often the reason a later card is stuck.
 */
export function Lineage() {
  const store = useGameStore();
  // Re-read whenever the run advances.
  useGameSnapshot();

  const species = inspectSpecies(store.world);
  if (species.length <= 1) return null;

  return (
    <div className="panel panel--lineage">
      <h2>Lineage</h2>
      <ul className="tree">
        {species.map((entry) => (
          <li
            key={entry.id}
            className={`tree__row ${entry.extinctTurn !== null ? "tree__row--extinct" : ""}`}
            style={{ paddingLeft: `${entry.depth * 0.75}rem` }}
          >
            <span
              className="tree__dot"
              style={{ background: `#${entry.colorHex.toString(16).padStart(6, "0")}` }}
            />
            <span className="tree__name">{entry.name}</span>
            <span className="tree__count">
              {entry.extinctTurn !== null ? `extinct t${entry.extinctTurn}` : entry.population}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
