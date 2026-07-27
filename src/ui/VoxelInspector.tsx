import type { CreatureInfo, VoxelInfo } from "../game/inspect";
import { RESOURCE_KEYS } from "../sim/resources";

/**
 * Reads out one voxel: its terrain, its resource levels, and every creature
 * living in it along with why each will act as it does.
 *
 * Each resource bar shows the current level against a tick marking its
 * baseline, because "0.4 nutrients" only means something relative to what this
 * voxel would hold at rest — that difference is how the player sees creatures
 * drawing it down.
 */
export function VoxelInspector({ info }: { info: VoxelInfo }) {
  const { x, y, z } = info.coords;

  return (
    <div className="panel panel--right">
      <h2>
        Voxel{" "}
        <span className="dim">
          ({x}, {y}, {z})
        </span>
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

      {info.creatures.length === 0 ? (
        <p className="empty">No life here</p>
      ) : (
        info.creatures.map((creature) => <CreatureCard key={creature.id} info={creature} />)
      )}
    </div>
  );
}

/**
 * The action table is the important half.
 *
 * Selection is by utility and gating is implicit, so a species can quietly stop
 * reproducing with nothing in its definition to explain it. Showing every
 * action — including the ones it cannot use and why — is what makes that
 * diagnosable.
 */
function CreatureCard({ info }: { info: CreatureInfo }) {
  const swatch = `#${info.colorHex.toString(16).padStart(6, "0")}`;

  return (
    <section className="creature">
      <h3>
        <span className="creature__dot" style={{ background: swatch }} />
        {info.speciesName}
      </h3>

      <p className="creature__vitals">
        <span>
          energy <b>{info.energy.toFixed(2)}</b> / {info.maxEnergy}
        </span>
        <span>
          age <b>{info.age}</b> / {info.maxAge}
        </span>
      </p>

      <table className="actions">
        <tbody>
          {info.actions.map((candidate) => {
            const state = !candidate.owned
              ? "unowned"
              : candidate.gated
                ? "gated"
                : candidate.eligible
                  ? "eligible"
                  : "inert";

            return (
              <tr
                key={candidate.id}
                className={`actions__row actions__row--${state} ${
                  candidate.id === info.chosen ? "actions__row--chosen" : ""
                }`}
              >
                <td className="actions__name">{candidate.id.toLowerCase()}</td>
                <td className="actions__why">
                  {candidate.gated ? (
                    <span title={`needs ${candidate.missingTags.join(", ")}`}>
                      needs {candidate.missingTags.join(", ").toLowerCase()}
                    </span>
                  ) : !candidate.owned ? (
                    "—"
                  ) : (
                    <span className="actions__bar" style={{ width: `${Math.min(1, candidate.weightedScore) * 100}%` }} />
                  )}
                </td>
                <td className="actions__score">
                  {candidate.owned && !candidate.gated ? candidate.weightedScore.toFixed(2) : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
