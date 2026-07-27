import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { World } from "koota";
import { getGrid } from "../sim/world";
import { createCreatureLayer, type CreatureLayer } from "./creatureLayer";
import { createVoxelLayer, type VoxelLayer } from "./voxelLayer";

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

export function createRenderer(canvas: HTMLCanvasElement, world: World): Renderer {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new Scene();
  scene.background = new Color(0x0b1016);

  const { size } = getGrid(world);
  const camera = new PerspectiveCamera(55, 1, 0.1, 500);
  camera.position.set(size.x * 1.5, size.y * 2, size.z * 1.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set((size.x - 1) / 2, (size.y - 1) / 3, (size.z - 1) / 2);

  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(size.x, size.y * 3, size.z);
  scene.add(key);
  scene.add(new AmbientLight(0xffffff, 0.55));

  const voxels: VoxelLayer = createVoxelLayer(world);
  scene.add(voxels.object);

  const creatures: CreatureLayer = createCreatureLayer();
  scene.add(creatures.object);

  const raycaster = new Raycaster();
  const pointer = new Vector2();

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
    sync(currentWorld) {
      voxels.sync(currentWorld);
      creatures.sync(currentWorld);
    },

    highlight(voxelIndices) {
      voxels.highlight(voxelIndices);
      voxels.sync(world);
    },

    pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // Nearest hit wins, so the surface the cursor is actually over is chosen
      // rather than something buried behind it.
      const [hit] = raycaster.intersectObjects(voxels.pickTargets, false);
      return hit ? voxels.resolve(hit) : null;
    },

    dispose() {
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      controls.dispose();
      voxels.dispose();
      creatures.dispose();
      renderer.dispose();
    },
  };
}
