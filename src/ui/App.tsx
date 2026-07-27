import { inspectVoxel } from "../game/inspect";
import { EventLog } from "./EventLog";
import { Hand } from "./Hand";
import { Lineage } from "./Lineage";
import { RunEnd } from "./RunEnd";
import { useGameSnapshot, useGameStore } from "./useGame";
import { VoxelInspector } from "./VoxelInspector";

/**
 * The DOM overlay above the three.js canvas.
 *
 * Everything here is pointer-transparent by default (see `index.html`) so the
 * camera stays draggable; individual panels opt back in.
 *
 * Targeting deliberately happens in the 3D world rather than here: selecting a
 * card highlights its legal voxels and you click the world to play.
 */
export function App() {
  const store = useGameStore();
  const { turn, phase, selectedVoxel, population, livingSpecies, extinctSpecies, deadlockTurns } =
    useGameSnapshot();

  const info = selectedVoxel === null ? null : inspectVoxel(store.world, selectedVoxel);
  const running = phase !== "won" && phase !== "lost";

  return (
    <div className="hud">
      <div className="panel">
        <h1>Eden</h1>
        <dl>
          <dt>Turn</dt>
          <dd>{turn}</dd>
          <dt>Creatures</dt>
          <dd>{population}</dd>
          <dt>Species</dt>
          <dd>
            {livingSpecies}
            {extinctSpecies > 0 && <span className="dim"> (+{extinctSpecies} extinct)</span>}
          </dd>
        </dl>

        {deadlockTurns > 0 && running ? (
          <p className="warn">No legal play for {deadlockTurns} turns</p>
        ) : null}

        {running ? (
          <button type="button" onClick={() => store.pass()}>
            Pass
          </button>
        ) : null}
        <button type="button" className="ghost" onClick={() => store.reset()}>
          Restart
        </button>
      </div>

      {info ? <VoxelInspector info={info} /> : <p className="hint">Hover a voxel to inspect it</p>}

      <Lineage />
      {/* Over-fetch, since the log filters out movement before showing it. */}
      <EventLog events={store.events(120)} />
      <Hand />
      <RunEnd />
    </div>
  );
}
