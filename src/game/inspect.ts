import type { World } from "koota";
import type { Coords } from "../sim/grid";
import type { ResourceLevels } from "../sim/resources";
import { terrainName, type TerrainName } from "../sim/terrain";
import { ResourceBaseline, Resources, Terrain, Voxel } from "../sim/traits";
import { voxelAt } from "../sim/world";

/**
 * Read-only view models for the UI.
 *
 * The UI never queries koota directly; it asks here. That keeps trait layout an
 * implementation detail of `sim/` and gives every panel one shape to render.
 */
export interface VoxelInfo {
  index: number;
  coords: Coords;
  terrain: TerrainName;
  resources: ResourceLevels;
  /** What the voxel drifts back toward — the reference for reading depletion. */
  baseline: ResourceLevels;
}

export function inspectVoxel(world: World, index: number): VoxelInfo | null {
  const entity = voxelAt(world, index);
  if (!entity) return null;

  const voxel = entity.get(Voxel);
  const terrain = entity.get(Terrain);
  const resources = entity.get(Resources);
  const baseline = entity.get(ResourceBaseline);
  if (!voxel || !terrain || !resources || !baseline) return null;

  return {
    index,
    coords: { x: voxel.x, y: voxel.y, z: voxel.z },
    terrain: terrainName(terrain.kind),
    resources: { ...resources },
    baseline: { ...baseline },
  };
}
