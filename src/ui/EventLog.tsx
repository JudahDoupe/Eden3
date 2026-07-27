import type { SimEvent } from "../sim/events";

/**
 * The running narrative of the run.
 *
 * Populations alone do not say why anything happened; these lines do.
 */
export function EventLog({ events }: { events: readonly SimEvent[] }) {
  if (events.length === 0) return null;

  return (
    <div className="panel panel--log">
      <h2>Log</h2>
      <ol className="log">
        {events.map((event, index) => (
          <li key={`${event.turn}-${index}`} className={`log__line log__line--${event.kind}`}>
            <span className="log__turn">{event.turn}</span>
            {event.message}
          </li>
        ))}
      </ol>
    </div>
  );
}
