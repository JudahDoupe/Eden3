import { WebGLRenderer } from "three";
import { createScene } from "./scene";

const canvas = document.getElementById("app") as HTMLCanvasElement;

const renderer = new WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const { scene, camera, sphere } = createScene(window.innerWidth / window.innerHeight);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

renderer.setAnimationLoop((t) => {
  sphere.rotation.y = t / 2000;
  renderer.render(scene, camera);
});
