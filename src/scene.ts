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
export function createScene(aspect = 1): GameScene {
  const scene = new Scene();
  scene.background = new Color(0x101018);

  const camera = new PerspectiveCamera(60, aspect, 0.1, 100);
  camera.position.set(0, 0, 4);
  camera.lookAt(0, 0, 0);

  // Encapsulated vitality system bound directly to the mesh creation lifecycle
  class VitalityBinder {
    private readonly sphere: Mesh;
    private state: number = 10;
    private acc: number = 0;

    constructor(target: Mesh) { this.sphere = target; }

    public update(dtMs: number): void {
      if (this.state <= 0) return;
      this.acc += dtMs;
      while (this.acc >= 1 && this.state > 0) {
        this.state--;
        this.acc -= 1;
      }
      this.syncColor();
    }

    public syncColor(): void {
      const green = new Color().setRGB(0, 1, 0);
      const brown = new Color().setRGB(1, 0.3, 0);
      const target = this.sphere.material.color;

      if (this.state <= 0) {
        target.setRGB(0, 0, 0);
      } else if (this.state >= 10) {
        target.copy(green);
      } else {
        const t = (this.state - 1) / 9;
        target.lerpColors(green, brown, t);
      }
    }

    public getVitality(): number { return this.state; }
  }

  const sphere = new Mesh(
    new SphereGeometry(1, 48, 48),
    new MeshStandardMaterial({ color: SPHERE_COLOR, roughness: 0.4, metalness: 0.1 }),
  );
  sphere.position.set(0, 0, 0);

  // Bind vitality lifecycle to mesh creation
  const system = new VitalityBinder(sphere);
  
  scene.add(sphere);

  const key = new DirectionalLight(0xffffff, 2);
  key.position.set(3, 4, 5);
  scene.add(key);
  scene.add(new AmbientLight(0xffffff, 0.4));

  // Initialize to full health green as per original lifecycle setup
  system.syncColor();

  return { scene, camera, sphere };
}
