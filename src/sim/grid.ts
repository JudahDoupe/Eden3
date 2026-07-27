/**
 * Voxel grid geometry: index <-> coordinate mapping and neighbourhood queries.
 *
 * Pure arithmetic, no entities. `y` is vertical (0 is the bedrock floor), which
 * matters because light falls down columns and terrain is layered.
 */

export interface GridSize {
  x: number;
  y: number;
  z: number;
}

export interface Coords {
  x: number;
  y: number;
  z: number;
}

export interface Grid {
  readonly size: GridSize;
  readonly count: number;
  /** Linear index for a coordinate. Throws when out of bounds. */
  indexOf(x: number, y: number, z: number): number;
  coordsOf(index: number): Coords;
  inBounds(x: number, y: number, z: number): boolean;
  /**
   * Indices within Chebyshev distance `range`, excluding the voxel itself.
   * Chebyshev (rather than Euclidean) so a range of 1 is the full 26-cell
   * shell — diagonal moves cost the same as orthogonal ones.
   */
  inRange(index: number, range: number): number[];
  /** A column's indices from the floor upward. */
  column(x: number, z: number): number[];
}

export function createGrid(size: GridSize): Grid {
  if (size.x < 1 || size.y < 1 || size.z < 1) {
    throw new Error(`createGrid: every dimension must be >= 1, got ${JSON.stringify(size)}`);
  }

  const count = size.x * size.y * size.z;
  const layer = size.x * size.z;

  const inBounds = (x: number, y: number, z: number): boolean =>
    x >= 0 && x < size.x && y >= 0 && y < size.y && z >= 0 && z < size.z;

  const indexOf = (x: number, y: number, z: number): number => {
    if (!inBounds(x, y, z)) {
      throw new Error(`indexOf: (${x}, ${y}, ${z}) is outside ${JSON.stringify(size)}`);
    }
    return y * layer + z * size.x + x;
  };

  const coordsOf = (index: number): Coords => {
    if (index < 0 || index >= count) {
      throw new Error(`coordsOf: index ${index} is outside [0, ${count})`);
    }
    const y = Math.floor(index / layer);
    const rest = index - y * layer;
    return { x: rest % size.x, y, z: Math.floor(rest / size.x) };
  };

  return {
    size,
    count,
    indexOf,
    coordsOf,
    inBounds,

    inRange(index, range) {
      const { x, y, z } = coordsOf(index);
      const out: number[] = [];
      for (let dy = -range; dy <= range; dy++) {
        for (let dz = -range; dz <= range; dz++) {
          for (let dx = -range; dx <= range; dx++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            const nz = z + dz;
            if (inBounds(nx, ny, nz)) out.push(indexOf(nx, ny, nz));
          }
        }
      }
      return out;
    },

    column(x, z) {
      const out: number[] = [];
      for (let y = 0; y < size.y; y++) out.push(indexOf(x, y, z));
      return out;
    },
  };
}
