import { describe, it, expect } from "vitest";
import { Mesh, MeshStandardMaterial } from "three";
import { createScene, SPHERE_COLOR } from "./scene";

describe("createScene", () => {
  it("puts a single green sphere at the origin", () => {
    const { scene, sphere } = createScene(16 / 9);

    expect(sphere).toBeInstanceOf(Mesh);

    const material = sphere.material as MeshStandardMaterial;
    expect(material.color.getHex()).toBe(SPHERE_COLOR);
    expect(SPHERE_COLOR).toBe(0x00ff00);

    expect(sphere.position.x).toBe(0);
    expect(sphere.position.y).toBe(0);
    expect(sphere.position.z).toBe(0);

    const meshes = scene.children.filter((c) => c instanceof Mesh);
    expect(meshes).toHaveLength(1);
  });

  it("aims the camera at the sphere", () => {
    const { camera } = createScene(1);
    expect(camera.position.z).toBeGreaterThan(0);
  });
});
