import { Scene, PerspectiveCamera, Mesh, SphereGeometry, MeshStandardMaterial, DirectionalLight, AmbientLight, Color } from "three";

/** The sphere's colour, kept as a named constant so tests and code agree. */
export const SPHERE_COLOR = 0x00ff00;

export interface GameScene {
  scene: Scene;
  camera: PerspectiveCamera;
  sphere: Mesh;
}

/** 
 * Build the scene graph: a single green sphere at the origin, a camera looking at
 * it, and lighting so the standard material is actually lit. Kept free of any
 * `WebGLRenderer` / DOM so it can be constructed and asserted in a headless test —
 * `main.ts` owns the renderer and the animation loop.
 */
export function createScene(aspect = 1): GameScene & {
  vitality: number;
  updateVitality(dtMs: number): void;
  syncColor(): void;
} {
  const scene = new Scene();
  scene.background = new Color(0x101018);

  const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);

  const sphere = new Mesh(
    new SphereGeometry(1, 48, 48),
    new MeshStandardMaterial({ color: SPHERE_COLOR, roughness: 0.4, metalness: 0.1 }),
  );
  sphere.position.set(0, 0, 0);
  scene.add(sphere);

  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(3, 4, 5);
  scene.add(key);
  scene.add(new AmbientLight(0xffffff, 0.4));

  // Color thresholds for vitality interpolation (precomputed to avoid repeated division)
  const GREEN_R = 0;       // Pure Green (matches 0x00FF00)
  const GREEN_G = 1;
  const GREEN_B = 0;

  const BROWN_R   = 1;    // Brown approximation
  const BROWN_G   = 0.3;
  const BROWN_B   = 0;

  function applyColor(vitalityValue: number): void {
    if (vitalityValue <= 0) {
      sphere.material.color.setRGB(0, 0, 0);
    } else if (vitalityValue >= 10) {
      sphere.material.color.setRGB(GREEN_R, GREEN_G, GREEN_B);
    } else {
      const t = (vitalityValue - 1) / 9; // Proportional interpolation factor [0..1] mapped from vitality range [1..10]
      sphere.material.color.setRGB(
        BROWN_R + (GREEN_R - BROWN_R) * t,
        BROWN_G + (GREEN_G - BROWN_G) * t,
        BROWN_B + (GREEN_B - BROWN_B) * t,
      );
    }
  }

  applyColor(10); // Initialize to full health green

  let acc: number = 0;

  return {
    scene,
    camera,
    sphere,
    vitality: 10,
    updateVitality(dtMs: number): void {
      if (this.vitality <= 0) return;
      acc += dtMs;
      while (acc >= 1 && this.vitality > 0) {
        this.vitality--;
        acc -= 1;
      }
      applyColor(this.vitality);
    },
    syncColor(): void {
      applyColor(this.vitality);
    },
  };
}
