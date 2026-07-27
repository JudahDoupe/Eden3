import { Color, InstancedMesh, Matrix4, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createCreatureLayer } from "./creatureLayer";
import { spawnCreature, spawnSpecies, type SpeciesDefinition } from "../sim/species";
import { Terrains } from "../sim/terrain";
import { Creature, Terrain, Voxel } from "../sim/traits";
import { getGrid, voxelAt } from "../sim/world";
import { createTestWorld } from "../testing/world";

const ALGAE: SpeciesDefinition = {
  id: "algae",
  name: "Algae",
  colorHex: 0x33cc66,
  tags: ["AQUATIC", "SESSILE", "PHOTOSYNTHETIC"],
  actions: ["PHOTOSYNTHESIZE"],
  habitat: ["WATER"],
};

const FISH: SpeciesDefinition = { ...ALGAE, id: "fish", name: "Fish", colorHex: 0xcc4433 };

function waterVoxels(world: ReturnType<typeof createTestWorld>, count: number) {
  const grid = getGrid(world);
  const found = [];
  for (let index = 0; index < grid.count && found.length < count; index++) {
    const entity = voxelAt(world, index);
    if (entity?.get(Terrain)?.kind === Terrains.bit.WATER) found.push(entity);
  }
  return found;
}

function instancePosition(mesh: InstancedMesh, slot: number): Vector3 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
}

function instanceScale(mesh: InstancedMesh, slot: number): number {
  const matrix = new Matrix4();
  mesh.getMatrixAt(slot, matrix);
  return new Vector3().setFromMatrixScale(matrix).x;
}

describe("createCreatureLayer", () => {
  it("draws nothing for an empty world", () => {
    const world = createTestWorld({ seed: 1 });
    const layer = createCreatureLayer();
    layer.sync(world);

    const mesh = layer.object.children[0] as InstancedMesh;
    for (let slot = 0; slot < mesh.count; slot++) {
      expect(instanceScale(mesh, slot)).toBe(0);
    }
    layer.dispose();
  });

  it("places a creature at its voxel, offset but within the cell", () => {
    const world = createTestWorld({ seed: 1 });
    const [voxel] = waterVoxels(world, 1);
    spawnCreature(world, spawnSpecies(world, ALGAE), voxel!);

    const layer = createCreatureLayer();
    layer.sync(world);

    const mesh = layer.object.children[0] as InstancedMesh;
    const position = instancePosition(mesh, 0);
    const coords = voxel!.get(Voxel)!;

    expect(Math.abs(position.x - coords.x)).toBeLessThan(0.5);
    expect(Math.abs(position.y - coords.y)).toBeLessThan(0.5);
    expect(Math.abs(position.z - coords.z)).toBeLessThan(0.5);
    layer.dispose();
  });

  it("separates co-located species so both stay visible", () => {
    // Many species share a voxel; drawing them concentric would hide all but one.
    const world = createTestWorld({ seed: 1 });
    const [voxel] = waterVoxels(world, 1);
    spawnCreature(world, spawnSpecies(world, ALGAE), voxel!);
    spawnCreature(world, spawnSpecies(world, FISH), voxel!);

    const layer = createCreatureLayer();
    layer.sync(world);

    const mesh = layer.object.children[0] as InstancedMesh;
    expect(instancePosition(mesh, 0).distanceTo(instancePosition(mesh, 1))).toBeGreaterThan(0.05);
    layer.dispose();
  });

  it("keeps a species' offset stable between syncs", () => {
    const world = createTestWorld({ seed: 1 });
    const [voxel] = waterVoxels(world, 1);
    spawnCreature(world, spawnSpecies(world, ALGAE), voxel!);

    const layer = createCreatureLayer();
    layer.sync(world);
    const mesh = layer.object.children[0] as InstancedMesh;
    const first = instancePosition(mesh, 0);

    layer.sync(world);
    expect(instancePosition(mesh, 0).distanceTo(first)).toBe(0);
    layer.dispose();
  });

  it("scales a creature by its energy, so starvation is visible", () => {
    const world = createTestWorld({ seed: 1 });
    const voxels = waterVoxels(world, 2);
    const species = spawnSpecies(world, ALGAE);
    spawnCreature(world, species, voxels[0]!, 1);
    spawnCreature(world, species, voxels[1]!, 0.05);

    const layer = createCreatureLayer();
    layer.sync(world);

    const mesh = layer.object.children[0] as InstancedMesh;
    expect(instanceScale(mesh, 0)).toBeGreaterThan(instanceScale(mesh, 1));
    layer.dispose();
  });

  it("colours each creature by its species", () => {
    const world = createTestWorld({ seed: 1 });
    const [voxel] = waterVoxels(world, 1);
    spawnCreature(world, spawnSpecies(world, ALGAE), voxel!);

    const layer = createCreatureLayer();
    layer.sync(world);

    const mesh = layer.object.children[0] as InstancedMesh;
    const color = new Color();
    mesh.getColorAt(0, color);
    expect(color.getHex()).toBe(ALGAE.colorHex);
    layer.dispose();
  });

  it("grows its buffer as the population outruns it, without losing anyone", () => {
    const world = createTestWorld({ seed: 1 });
    const species = spawnSpecies(world, ALGAE);
    const layer = createCreatureLayer();
    layer.sync(world);

    // Well past the initial 64-instance capacity.
    const grid = getGrid(world);
    let placed = 0;
    for (let index = 0; index < grid.count && placed < 80; index++) {
      const entity = voxelAt(world, index);
      if (!entity) continue;
      spawnCreature(world, species, entity);
      placed++;
    }

    layer.sync(world);
    const mesh = layer.object.children[0] as InstancedMesh;
    expect(mesh.count).toBeGreaterThanOrEqual(placed);
    expect(world.query(Creature).length).toBe(placed);

    let drawn = 0;
    for (let slot = 0; slot < mesh.count; slot++) if (instanceScale(mesh, slot) > 0) drawn++;
    expect(drawn).toBe(placed);
    layer.dispose();
  });
});
