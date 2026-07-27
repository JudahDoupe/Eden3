/**
 * A running log of what the simulation did.
 *
 * Utility-based action choice plus implicit tag gating means a player watching
 * only populations cannot tell why anything happened. These events are how a
 * collapsing ecosystem stays readable.
 */
export type SimEventKind = "born" | "died" | "ate" | "moved" | "extinct" | "mutated";

export interface SimEvent {
  turn: number;
  kind: SimEventKind;
  message: string;
  speciesId?: string;
  voxelIndex?: number;
}

export interface EventLog {
  push(event: SimEvent): void;
  /** Most recent first. */
  recent(limit?: number): readonly SimEvent[];
  clear(): void;
}

/** Ring buffer: a long run must not grow the log without bound. */
export function createEventLog(capacity = 500): EventLog {
  let events: SimEvent[] = [];

  return {
    push(event) {
      events.push(event);
      if (events.length > capacity) events = events.slice(-capacity);
    },
    recent(limit = 50) {
      return events.slice(-limit).reverse();
    },
    clear() {
      events = [];
    },
  };
}
