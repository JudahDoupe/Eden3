import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  type Intersection,
} from "three";
import type { World } from "koota";
import { Resources, Terrain, Voxel } from "../sim/traits";
import { Terrains } from "../sim/terrain";
import { getGrid } from "../sim/world";

/**
 * Draws the voxel grid as instanced cubes.
 *
 * Solids and water are separate meshes because water needs transparency and
 * solids must not pay for it. Air is drawn and picked by neither: filling the
 * upper world with invisible-but-pickable cubes would put a wall between the
 * cursor and the pond below.
 *
 * TODO(M4): when a card's habitat includes AIR, spawn ghost cubes for just its
 * legal air voxels. That makes air targetable exactly when it is relevant,
 * without the occlusion problem.
 */

/** Base tint per terrain, before resource modulation. */
const TERRAIN_COLOR: Record<string, number> = {
  ROCK: 0x4a4a52,
  SOIL: 0x6b4f32,
  WATER: 0x2a6f97,
  AIR: 0x000000,
};

/** Which resource a terrain's brightness reads out. */
const TERRAIN_READOUT: Record<string, "nutrients" | "oxygen" | "moisture" | null> = {
  ROCK: null,
  SOIL: "nutrients",
  WATER: "oxygen",
  AIR: null,
};

const HIGHLIGHT_COLOR = new Color(0x7fd4a0);

interface Bucket {
  mesh: InstancedMesh;
  /** Instance slot -> linear voxel index. */
  voxelIndices: number[];
}

export interface VoxelLayer {
  readonly object: Object3D;
  /** Meshes that should participate in raycasting. */
  readonly pickTargets: Object3D[];
  /** Refresh instance colours from current resource levels. */
  sync(world: World): void;
  /** Tint a set of voxel indices; pass an empty array to clear. */
  highlight(voxelIndices: readonly number[]): void;
  /** Map a raycast hit to a linear voxel index. */
  resolve(hit: Intersection): number | null;
  dispose(): void;
}

/**
 * Terrain never changes during a run, so instance transforms are built once
 * here and only colours are touched afterwards.
 */
export function createVoxelLayer(world: World): VoxelLayer {
  const group = new Group();
  const geometry = new BoxGeometry(0.94, 0.94, 0.94);
  const grid = getGrid(world);

  const solidSlots: { index: number; kind: number }[] = [];
  const waterSlots: { index: number; kind: number }[] = [];

  world.query(Voxel, Terrain).readEach(([voxel, terrain]) => {
    const [name] = Terrains.toNames(terrain.kind);
    if (name === "AIR") return;
    (name === "WATER" ? waterSlots : solidSlots).push({ index: voxel.index, kind: terrain.kind });
  });

  const buckets: Bucket[] = [];
  const byMesh = new Map<InstancedMesh, Bucket>();
  const baseColor = new Map<number, Color>();

  function build(slots: { index: number; kind: number }[], transparent: boolean): Bucket | null {
    if (slots.length === 0) return null;

    const material = new MeshStandardMaterial({
      roughness: transparent ? 0.2 : 0.9,
      metalness: 0,
      transparent,
      opacity: transparent ? 0.45 : 1,
    });
    const mesh = new InstancedMesh(geometry, material, slots.length);
    mesh.frustumCulled = false;

    const matrix = new Matrix4();
    const voxelIndices: number[] = [];

    slots.forEach((slot, instanceId) => {
      const coords = grid.coordsOf(slot.index);
      matrix.makeTranslation(coords.x, coords.y, coords.z);
      mesh.setMatrixAt(instanceId, matrix);
      voxelIndices.push(slot.index);
      baseColor.set(slot.index, new Color(TERRAIN_COLOR[terrainNameOf(slot.kind)] ?? 0x888888));
    });

    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);

    const bucket: Bucket = { mesh, voxelIndices };
    buckets.push(bucket);
    byMesh.set(mesh, bucket);
    return bucket;
  }

  build(solidSlots, false);
  build(waterSlots, true);

  let highlighted: ReadonlySet<number> = new Set();
  const scratch = new Color();

  return {
    object: group,
    pickTargets: buckets.map((bucket) => bucket.mesh),

    sync(currentWorld) {
      const levelsByVoxel = new Map<number, number>();
      currentWorld.query(Voxel, Terrain, Resources).readEach(([voxel, terrain, levels]) => {
        const readout = TERRAIN_READOUT[terrainNameOf(terrain.kind)];
        levelsByVoxel.set(voxel.index, readout ? levels[readout] : 0.5);
      });

      for (const bucket of buckets) {
        bucket.voxelIndices.forEach((voxelIndex, instanceId) => {
          const base = baseColor.get(voxelIndex);
          if (!base) return;
          if (highlighted.has(voxelIndex)) {
            scratch.copy(HIGHLIGHT_COLOR);
          } else {
            // Depleted voxels read visibly darker, so nutrient drawdown is
            // legible without opening an inspector.
            const level = levelsByVoxel.get(voxelIndex) ?? 0.5;
            scratch.copy(base).multiplyScalar(0.55 + 0.45 * level);
          }
          bucket.mesh.setColorAt(instanceId, scratch);
        });
        if (bucket.mesh.instanceColor) bucket.mesh.instanceColor.needsUpdate = true;
      }
    },

    highlight(voxelIndices) {
      highlighted = new Set(voxelIndices);
    },

    resolve(hit) {
      const bucket = byMesh.get(hit.object as InstancedMesh);
      if (!bucket || hit.instanceId === undefined) return null;
      return bucket.voxelIndices[hit.instanceId] ?? null;
    },

    dispose() {
      for (const bucket of buckets) {
        const material = bucket.mesh.material;
        if (material instanceof MeshStandardMaterial) material.dispose();
        bucket.mesh.dispose();
      }
      geometry.dispose();
      group.clear();
    },
  };
}

function terrainNameOf(kind: number): string {
  return Terrains.toNames(kind)[0] ?? "AIR";
}
