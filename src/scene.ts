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
      
      const green = new Color(0, 1, 0);
      const brown = new Color(1, 0.3, 0);

      this.acc += dtMs;
      while (this.acc >= 1 && this.state > 0) {
        this.state--;
        this.acc -= 1;
      }

      // Direct material binding for real-time updates without intermediate wrappers
      if (this.state <= 0) {
        this.sphere.material.color.setRGB(0, 0, 0);
      } else if (this.state >= 10) {
        this.sphere.material.color.copy(green);
      } else {
        const t = (this.state - 1) / 9;
        this.sphere.material.color.lerpColors(green, brown, t);
      }
    }
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

      return { scene, camera, sphere };
}
