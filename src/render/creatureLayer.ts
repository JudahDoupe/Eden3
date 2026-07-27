import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { World } from "koota";
import { Creature, InVoxel, Life, OfSpecies, Species, Voxel } from "../sim/traits";

/**
 * Draws creatures as coloured spheres, one per (species, voxel) entity.
 *
 * Population is unbounded in principle, so the instance buffer is grown to the
 * next power of two and reused rather than reallocated every phase.
 */

/** Sphere radius at full energy; a starving creature shrinks toward the floor. */
const MAX_RADIUS = 0.3;
const MIN_RADIUS = 0.09;

export interface CreatureLayer {
  readonly object: Object3D;
  sync(world: World): void;
  dispose(): void;
}

export function createCreatureLayer(): CreatureLayer {
  const group = new Group();
  const geometry = new SphereGeometry(1, 12, 10);
  const material = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 });

  let mesh: InstancedMesh | null = null;
  let capacity = 0;

  const matrix = new Matrix4();
  const offset = new Vector3();
  const scale = new Vector3();
  const color = new Color();

  function ensureCapacity(needed: number): InstancedMesh {
    if (mesh && capacity >= needed) return mesh;

    mesh?.dispose();
    if (mesh) group.remove(mesh);

    capacity = Math.max(64, nextPowerOfTwo(needed));
    mesh = new InstancedMesh(geometry, material, capacity);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  }

  return {
    object: group,

    sync(world) {
      const creatures = [...world.query(Creature)];
      const target = ensureCapacity(creatures.length);

      let slot = 0;
      for (const creature of creatures) {
        const state = creature.get(Creature);
        const voxel = creature.targetFor(InVoxel)?.get(Voxel);
        const speciesEntity = creature.targetFor(OfSpecies);
        const species = speciesEntity?.get(Species);
        if (!state || !voxel || !species) continue;

        const maxEnergy = speciesEntity?.get(Life)?.maxEnergy ?? 1;
        const fill = maxEnergy > 0 ? Math.max(0, Math.min(1, state.energy / maxEnergy)) : 0;
        const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * fill;

        // Several species share a voxel, so each is nudged off-centre by a hash
        // of its own id: stable between frames, and distinct from its neighbours.
        jitterFor(species.id, offset);
        offset.x += voxel.x;
        offset.y += voxel.y;
        offset.z += voxel.z;

        scale.setScalar(radius);
        matrix.compose(offset, NO_ROTATION, scale);
        target.setMatrixAt(slot, matrix);
        target.setColorAt(slot, color.setHex(species.colorHex));
        slot++;
      }

      // Park unused instances at zero scale rather than shrinking the buffer.
      scale.setScalar(0);
      matrix.compose(ORIGIN, NO_ROTATION, scale);
      for (let i = slot; i < capacity; i++) target.setMatrixAt(i, matrix);

      target.count = capacity;
      target.instanceMatrix.needsUpdate = true;
      if (target.instanceColor) target.instanceColor.needsUpdate = true;
    },

    dispose() {
      mesh?.dispose();
      geometry.dispose();
      material.dispose();
      group.clear();
      mesh = null;
      capacity = 0;
    },
  };
}

const ORIGIN = new Vector3(0, 0, 0);
const NO_ROTATION = new Quaternion();

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/** Deterministic per-species offset inside a voxel, in roughly [-0.28, 0.28]. */
function jitterFor(speciesId: string, out: Vector3): Vector3 {
  let hash = 2166136261;
  for (let i = 0; i < speciesId.length; i++) {
    hash ^= speciesId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const a = ((hash >>> 0) % 1000) / 1000 - 0.5;
  const b = ((hash >>> 10) % 1000) / 1000 - 0.5;
  const c = ((hash >>> 20) % 1000) / 1000 - 0.5;
  return out.set(a * 0.55, b * 0.55, c * 0.55);
}
