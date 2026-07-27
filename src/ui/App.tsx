import { useGameSnapshot, useGameStore } from "./useGame";

/**
 * The DOM overlay above the three.js canvas.
 *
 * Everything here is pointer-transparent by default (see `index.html`) so the
 * camera stays draggable; individual panels opt back in.
 */
export function App() {
  const store = useGameStore();
  const { turn, phase } = useGameSnapshot();

  return (
    <div className="hud">
      <div className="panel">
        <h1>Eden</h1>
        <dl>
          <dt>Turn</dt>
          <dd>{turn}</dd>
          <dt>Phase</dt>
          <dd>{phase}</dd>
        </dl>
        <button type="button" onClick={() => store.step()}>
          Pass
        </button>
      </div>
    </div>
  );
}
