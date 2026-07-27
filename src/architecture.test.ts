import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The load-bearing guardrail of the whole codebase.
 *
 * Eden's simulation has to stay independent of its visualization so the cubes
 * and spheres can be thrown away later without touching game logic. That is
 * easy to state and easy to erode one convenient import at a time, so it is
 * asserted here rather than left to discipline.
 *
 * It also keeps `sim/` and `game/` runnable in a bare node environment, which
 * is what lets the determinism and soak tests exist at all.
 */

const SRC = new URL("./", import.meta.url).pathname;

/** Layer -> import specifiers it may never reference. */
const FORBIDDEN: Record<string, readonly string[]> = {
  sim: ["three", "react", "react-dom", "koota/react", "../render", "../ui", "../game"],
  game: ["three", "react", "react-dom", "koota/react", "../render", "../ui"],
};

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(path));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Both static `from "x"` and dynamic `import("x")` specifiers. */
function importSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [/\bfrom\s*["']([^"']+)["']/g, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]!);
  }
  return specifiers;
}

describe("layer boundaries", () => {
  for (const [layer, forbidden] of Object.entries(FORBIDDEN)) {
    const files = tsFilesUnder(join(SRC, layer));

    it(`${layer}/ has source files to check`, () => {
      // Guards against the whole suite silently passing on an empty directory.
      expect(files.length).toBeGreaterThan(0);
    });

    for (const file of files) {
      const name = relative(SRC, file);
      it(`${name} imports nothing from the rendering or UI layers`, () => {
        const specifiers = importSpecifiers(readFileSync(file, "utf8"));
        const violations = specifiers.filter((specifier) =>
          forbidden.some((banned) => specifier === banned || specifier.startsWith(`${banned}/`)),
        );
        expect(violations).toEqual([]);
      });
    }
  }
});
