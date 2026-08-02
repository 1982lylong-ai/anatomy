import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { disposeObject } from "./dispose";

export class AnatomyAssetManager {
  private loader: GLTFLoader;
  private draco: DRACOLoader;
  private ktx2: KTX2Loader;
  private active: THREE.Group | null = null;
  private mixer: THREE.AnimationMixer | null = null;

  constructor(renderer: THREE.WebGLRenderer) {
    this.draco = new DRACOLoader().setDecoderPath("/draco/");
    this.ktx2 = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(renderer);
    this.loader = new GLTFLoader()
      .setDRACOLoader(this.draco)
      .setKTX2Loader(this.ktx2)
      .setMeshoptDecoder(MeshoptDecoder);
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
        material.transparent = true;
        material.opacity = 1;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.roughness = Math.min(material.roughness ?? 0.55, 0.62);
          material.metalness = 0;
          material.envMapIntensity = 0.72;
        }
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
    this.draco.dispose();
    this.ktx2.dispose();
  }
}
