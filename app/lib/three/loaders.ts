import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { disposeObject } from "./dispose";

export class AnatomyAssetManager {
  private loader: GLTFLoader;
  private active: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private maxAnisotropy: number;

  constructor(renderer: THREE.WebGLRenderer) {
    this.maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }

  async load(url: string, onProgress?: (progress: number) => void) {
    const gltf = await this.loader.loadAsync(url, (event) => {
      if (event.total > 0) onProgress?.(event.loaded / event.total);
    });
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 3.8 / Math.max(size.x, size.y, size.z, 0.001);
    root.scale.setScalar(scale);
    root.position.copy(center.multiplyScalar(-scale));
    root.rotation.set(0.05, -0.28, 0);

    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.frustumCulled = true;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
        material.depthTest = true;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.46, 0.34, 0.58);
          material.metalness = 0;
          material.envMapIntensity = 1;
          material.emissive.set(0x000000);
          material.emissiveIntensity = 0;
          if ("clearcoat" in material) {
            const physical = material as THREE.MeshPhysicalMaterial;
            physical.clearcoat = Math.max(physical.clearcoat, 0.16);
            physical.clearcoatRoughness = 0.48;
          }
          if (material.map) {
            material.map.colorSpace = THREE.SRGBColorSpace;
            material.map.anisotropy = this.maxAnisotropy;
          }
          if (material.normalMap) material.normalScale.multiplyScalar(0.72);
        }
        material.needsUpdate = true;
      });
    });

    if (gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(root);
      gltf.animations.forEach((clip) => this.mixer?.clipAction(clip).play());
    }
    this.active = root;
    return root;
  }

  update(delta: number) {
    this.mixer?.update(delta);
  }

  release(root = this.active) {
    if (!root) return;
    this.mixer?.stopAllAction();
    this.mixer?.uncacheRoot(root);
    this.mixer = null;
    root.removeFromParent();
    disposeObject(root);
    if (root === this.active) this.active = null;
  }

  dispose() {
    this.release();
  }
}
