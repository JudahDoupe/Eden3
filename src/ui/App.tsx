import { inspectVoxel } from "../game/inspect";
import { EventLog } from "./EventLog";
import { useGameSnapshot, useGameStore } from "./useGame";
import { VoxelInspector } from "./VoxelInspector";

/**
 * The DOM overlay above the three.js canvas.
 *
 * Everything here is pointer-transparent by default (see `index.html`) so the
 * camera stays draggable; individual panels opt back in.
 */
export function App() {
  const store = useGameStore();
  const { turn, phase, selectedVoxel, population, livingSpecies, extinctSpecies } =
    useGameSnapshot();

  const info = selectedVoxel === null ? null : inspectVoxel(store.world, selectedVoxel);

  return (
    <div className="hud">
      <div className="panel">
        <h1>Eden</h1>
        <dl>
          <dt>Turn</dt>
          <dd>{turn}</dd>
          <dt>Phase</dt>
          <dd>{phase}</dd>
          <dt>Creatures</dt>
          <dd>{population}</dd>
          <dt>Species</dt>
          <dd>
            {livingSpecies}
            {extinctSpecies > 0 && <span className="dim"> (+{extinctSpecies} extinct)</span>}
          </dd>
        </dl>
        <button type="button" onClick={() => store.step()}>
          Pass
        </button>
        <button type="button" className="ghost" onClick={() => store.reset()}>
          Restart
        </button>
      </div>

      {info ? <VoxelInspector info={info} /> : <p className="hint">Hover a voxel to inspect it</p>}

      <EventLog events={store.events(14)} />
    </div>
  );
}
