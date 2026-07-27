import type { SimEvent, SimEventKind } from "../sim/events";

/**
 * The running narrative of the run.
 *
 * Populations alone do not say why anything happened; these lines do.
 *
 * Movement is deliberately excluded. Creatures move constantly — at carrying
 * capacity it is most of what happens each turn — and it is the one thing
 * already legible in the 3D view, so logging it buries the events that are not.
 * Per-creature action scores are excluded for the same reason: they live in the
 * inspector, where they can be read one creature at a time.
 */
const SIGNIFICANT: ReadonlySet<SimEventKind> = new Set<SimEventKind>([
  "mutated",
  "extinct",
  "born",
  "died",
  "ate",
]);

export function EventLog({ events, limit = 12 }: { events: readonly SimEvent[]; limit?: number }) {
  const shown = events.filter((event) => SIGNIFICANT.has(event.kind)).slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div className="panel panel--log">
      <h2>Log</h2>
      <ol className="log">
        {shown.map((event, index) => (
          <li key={`${event.turn}-${index}`} className={`log__line log__line--${event.kind}`}>
            <span className="log__turn">{event.turn}</span>
            {event.message}
          </li>
        ))}
      </ol>
    </div>
  );
}
