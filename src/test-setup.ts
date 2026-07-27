/**
 * Without this flag React 19's `act()` does not flush updates synchronously and
 * merely warns, which lets UI assertions pass against un-rendered output. It is
 * harmless in the node-environment sim tests, so it is set globally.
 */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Koota caps live worlds at 16 per process; release them between tests.
import { afterEach } from "vitest";
import { destroyTestWorlds } from "./testing/world";

afterEach(destroyTestWorlds);

export {};
