import type { VoxelInfo } from "../game/inspect";
import { RESOURCE_KEYS } from "../sim/resources";

/**
 * Reads out one voxel's terrain and resource levels.
 *
 * Each bar shows the current level against a tick marking its baseline, because
 * "0.4 nutrients" only means something relative to what this voxel would hold
 * at rest — that difference is how the player sees creatures drawing it down.
 */
export function VoxelInspector({ info }: { info: VoxelInfo }) {
  const { x, y, z } = info.coords;

  return (
    <div className="panel panel--right">
      <h2>
        Voxel <span className="dim">({x}, {y}, {z})</span>
      </h2>
      <p className={`terrain terrain--${info.terrain.toLowerCase()}`}>{info.terrain}</p>

      <ul className="bars">
        {RESOURCE_KEYS.map((key) => (
          <li key={key}>
            <span className="bars__label">{key}</span>
            <span className="bars__track">
              <span className="bars__fill" style={{ width: `${info.resources[key] * 100}%` }} />
              <span className="bars__baseline" style={{ left: `${info.baseline[key] * 100}%` }} />
            </span>
            <span className="bars__value">{info.resources[key].toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
