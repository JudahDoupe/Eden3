import { Color, InstancedMesh } from "three";
import { describe, expect, it } from "vitest";
import { createVoxelLayer } from "./voxelLayer";
import { Terrains } from "../sim/terrain";
import { Resources, Terrain, Voxel } from "../sim/traits";
import { createSimWorld, getGrid, voxelAt } from "../sim/world";

/**
 * three.js geometry, materials and instance buffers are CPU-side until they are
 * drawn, so the whole layer is testable without a GL context. Only the actual
 * pixels are not covered here.
 */

/** The first instance slot in `mesh` backed by a voxel of the given terrain. */
function findSlot(
  layer: ReturnType<typeof createVoxelLayer>,
  mesh: InstancedMesh,
  world: ReturnType<typeof createSimWorld>,
  kind: number,
): number {
  for (let slot = 0; slot < mesh.count; slot++) {
    const voxelIndex = layer.resolve({ object: mesh, instanceId: slot } as never);
    if (voxelIndex !== null && voxelAt(world, voxelIndex)?.get(Terrain)?.kind === kind) return slot;
  }
  throw new Error(`no instance of terrain ${kind} in this mesh`);
}

function terrainCounts(world: ReturnType<typeof createSimWorld>) {
  let solid = 0;
  let water = 0;
  world.query(Voxel, Terrain).readEach(([, terrain]) => {
    if (terrain.kind === Terrains.bit.WATER) water++;
    else if (terrain.kind !== Terrains.bit.AIR) solid++;
  });
  return { solid, water };
}

describe("createVoxelLayer", () => {
  it("instances every non-air voxel exactly once", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);
    const { solid, water } = terrainCounts(world);

    const total = layer.pickTargets.reduce(
      (sum, mesh) => sum + (mesh as InstancedMesh).count,
      0,
    );
    expect(total).toBe(solid + water);
    layer.dispose();
  });

  it("does not instance air, so the cursor can reach the pond", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);

    let airCount = 0;
    world.query(Voxel, Terrain).readEach(([, terrain]) => {
      if (terrain.kind === Terrains.bit.AIR) airCount++;
    });

    const instanced = layer.pickTargets.reduce(
      (sum, mesh) => sum + (mesh as InstancedMesh).count,
      0,
    );
    expect(airCount).toBeGreaterThan(0);
    expect(instanced + airCount).toBe(getGrid(world).count);
    layer.dispose();
  });

  it("separates water into a transparent mesh", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);

    const transparent = layer.pickTargets.filter((mesh) => {
      const material = (mesh as InstancedMesh).material;
      return !Array.isArray(material) && material.transparent;
    });
    expect(transparent).toHaveLength(1);
    layer.dispose();
  });

  it("round-trips a raycast hit back to its voxel index", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);
    const mesh = layer.pickTargets[0] as InstancedMesh;

    const resolved = layer.resolve({ object: mesh, instanceId: 3 } as never);
    expect(typeof resolved).toBe("number");
    // Whatever it resolved to must be a real, non-air voxel.
    expect(voxelAt(world, resolved!)!.get(Terrain)!.kind).not.toBe(Terrains.bit.AIR);
    layer.dispose();
  });

  it("returns null for a hit with no instance", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);
    const mesh = layer.pickTargets[0] as InstancedMesh;

    expect(layer.resolve({ object: mesh, instanceId: undefined } as never)).toBeNull();
    layer.dispose();
  });

  it("leaves inert bedrock unmodulated", () => {
    // ROCK has no resource readout, so its brightness must not wander when the
    // world around it changes.
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);
    const mesh = layer.pickTargets[0] as InstancedMesh;
    const rockSlot = findSlot(layer, mesh, world, Terrains.bit.ROCK);

    layer.sync(world);
    const before = new Color();
    mesh.getColorAt(rockSlot, before);

    world.query(Resources).updateEach(([levels]) => {
      levels.nutrients = 0;
    });
    layer.sync(world);

    const after = new Color();
    mesh.getColorAt(rockSlot, after);
    expect(after.getHex()).toBe(before.getHex());
    layer.dispose();
  });

  it("darkens a depleted voxel, so drawdown is visible without a panel", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);
    const mesh = layer.pickTargets[0] as InstancedMesh;
    const soilSlot = findSlot(layer, mesh, world, Terrains.bit.SOIL);

    layer.sync(world);
    const before = new Color();
    mesh.getColorAt(soilSlot, before);

    // Drain every voxel, then re-sync.
    world.query(Resources).updateEach(([levels]) => {
      levels.nutrients = 0;
      levels.oxygen = 0;
    });
    layer.sync(world);

    const after = new Color();
    mesh.getColorAt(soilSlot, after);
    expect(after.getHex()).toBeLessThan(before.getHex());
    layer.dispose();
  });

  it("tints highlighted voxels and clears them again", () => {
    const world = createSimWorld({ seed: 1 });
    const layer = createVoxelLayer(world);
    const mesh = layer.pickTargets[0] as InstancedMesh;

    layer.sync(world);
    const plain = new Color();
    mesh.getColorAt(0, plain);

    const firstVoxel = layer.resolve({ object: mesh, instanceId: 0 } as never)!;
    layer.highlight([firstVoxel]);
    layer.sync(world);
    const lit = new Color();
    mesh.getColorAt(0, lit);
    expect(lit.getHex()).not.toBe(plain.getHex());

    layer.highlight([]);
    layer.sync(world);
    const cleared = new Color();
    mesh.getColorAt(0, cleared);
    expect(cleared.getHex()).toBe(plain.getHex());
    layer.dispose();
  });
});
