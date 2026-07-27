import {
  AmbientLight,
  Color,
  DirectionalLight,
  GridHelper,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "koota";
import type { SimConfig } from "../sim/world";

/**
 * The three.js layer.
 *
 * Deliberately narrow: the rest of the app can only ask it to redraw from world
 * state, highlight voxels, or resolve a screen position to a voxel. Nothing
 * outside this directory touches the scene graph, which is what makes the whole
 * visualization replaceable later without disturbing the simulation.
 *
 * This module reads the world and never mutates it.
 */
export interface Renderer {
  /** Redraw from current world state. Called after each phase, not per frame. */
  sync(world: World): void;
  /** Tint a set of voxel indices — used for legal card targets. */
  highlight(voxelIndices: readonly number[]): void;
  /** Resolve a screen position to a voxel index, or null. */
  pick(clientX: number, clientY: number): number | null;
  dispose(): void;
}

export function createRenderer(canvas: HTMLCanvasElement, config: SimConfig): Renderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  scene.background = new Color(0x0b1016);

  const camera = new PerspectiveCamera(55, 1, 0.1, 500);
  const { x, y, z } = config.size;
  camera.position.set(x * 1.4, y * 1.8, z * 1.4);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(x / 2, y / 4, z / 2);

  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(x, y * 3, z);
  scene.add(key);
  scene.add(new AmbientLight(0xffffff, 0.5));

  // Placeholder ground reference until M2 renders real voxels.
  const grid = new GridHelper(Math.max(x, z), Math.max(x, z), 0x2a3a4a, 0x18242e);
  grid.position.set(x / 2, 0, z / 2);
  scene.add(grid);

  function resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    sync(_world: World) {
      // TODO(M2): rebuild the voxel InstancedMesh from Voxel/Terrain/Resources.
      // TODO(M3): rebuild the creature InstancedMesh from Creature entities.
    },

    highlight(_voxelIndices: readonly number[]) {
      // TODO(M4): tint legal targets when a card is selected.
    },

    pick(_clientX: number, _clientY: number) {
      // TODO(M2): raycast the voxel InstancedMesh and map instance id -> voxel.
      return null;
    },

    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      controls.dispose();
      grid.geometry.dispose();
      renderer.dispose();
    },
  };
}
