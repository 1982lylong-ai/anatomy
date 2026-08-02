import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import gsap from "gsap";
import type { Hotspot } from "../anatomy-data";
import { AnatomyAssetManager } from "./loaders";

export type ProjectedHotspot = Hotspot & { x: number; y: number; visible: boolean };

type ViewerCallbacks = {
  onHotspots: (items: ProjectedHotspot[]) => void;
  onLoading: (loading: boolean, progress: number) => void;
};

export class AnatomyViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private assets: AnatomyAssetManager;
  private callbacks: ViewerCallbacks;
  private container: HTMLElement;
  private activeModel: THREE.Group | null = null;
  private activeHotspots: Hotspot[] = [];
  private frame = 0;
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private crossSection = false;
  private isolated = false;
  private pointerResumeTimer = 0;
  private isVisible = true;
  private isPageVisible = true;
  private intersectionObserver: IntersectionObserver;
  private lastHotspotUpdate = 0;
  private loadRequest = 0;
  private lowPower: boolean;

  constructor(container: HTMLElement, callbacks: ViewerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.lowPower = window.matchMedia("(max-width: 780px)").matches || (navigator.hardwareConcurrency ?? 8) < 6;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.lowPower ? 1.15 : 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.shadowMap.enabled = !this.lowPower;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute("aria-label", "Interactive 3D anatomy model. Drag to rotate and scroll to zoom.");
    this.renderer.domElement.tabIndex = 0;
    container.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0.2, 8.2);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 4.8;
    this.controls.maxDistance = 12;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.65;
    this.controls.target.set(0, 0.05, 0);

    if (!this.lowPower) {
      const renderPass = new RenderPass(this.scene, this.camera);
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.035, 0.35, 0.97);
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(renderPass);
      this.composer.addPass(bloom);
      this.composer.addPass(new OutputPass());
    }

    this.assets = new AnatomyAssetManager(this.renderer);
    this.addEnvironment();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.isVisible = entry.isIntersecting;
    }, { rootMargin: "120px" });
    this.intersectionObserver.observe(container);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
    this.controls.addEventListener("start", this.pauseAutoRotate);
    this.renderer.domElement.addEventListener("keydown", this.onKeyDown);
    this.resize();
    this.animate();
  }

  private addEnvironment() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.42);
    this.scene.add(ambient);
    const hemi = new THREE.HemisphereLight(0xfff8ee, 0x33252d, 0.72);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff3e7, 3.8);
    key.position.set(4.8, 6.5, 6.8);
    key.castShadow = !this.lowPower;
    key.shadow.mapSize.set(this.lowPower ? 512 : 1536, this.lowPower ? 512 : 1536);
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.025;
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 4;
    key.shadow.camera.bottom = -4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe6ecff, 1.12);
    fill.position.set(-4.5, 1.2, 5.2);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffb7a5, 1.6);
    rim.position.set(-4, 3.5, -5.5);
    this.scene.add(rim);
    const warm = new THREE.PointLight(0xff8d70, 0.72, 11, 2);
    warm.position.set(-3, -1.4, 3.5);
    this.scene.add(warm);
    const organGlow = new THREE.PointLight(0xee7c6a, 0.5, 8, 2);
    organGlow.name = "organ-glow";
    organGlow.position.set(2.8, 0.4, 2.8);
    this.scene.add(organGlow);

    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(2.45, 2.65, 0.34, 72),
      new THREE.MeshStandardMaterial({ color: 0xead7c1, roughness: 0.78, metalness: 0 }),
    );
    plinth.position.y = -2.45;
    plinth.receiveShadow = true;
    this.scene.add(plinth);

    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array((this.lowPower ? 28 : 70) * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 9;
      positions[i + 1] = (Math.random() - 0.5) * 6;
      positions[i + 2] = (Math.random() - 0.5) * 5 - 2;
    }
    particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({ color: 0xe7a18e, size: 0.013, transparent: true, opacity: 0.16 }),
    );
    particles.name = "ambient-particles";
    this.scene.add(particles);
  }

  async setOrgan(modelUrl: string, hotspots: Hotspot[], accent: string) {
    const request = ++this.loadRequest;
    this.callbacks.onLoading(true, 0);
    const outgoing = this.activeModel;
    if (outgoing) {
      this.setModelOpacity(outgoing, 1);
      await gsap.to(outgoing.scale, { x: outgoing.scale.x * 0.72, y: outgoing.scale.y * 0.72, z: outgoing.scale.z * 0.72, duration: 0.42, ease: "power2.in" });
      await gsap.to(outgoing.rotation, { y: outgoing.rotation.y + 0.45, duration: 0.32, ease: "power1.inOut" });
      this.assets.release(outgoing);
    }
    gsap.to(this.camera.position, { z: 9.2, duration: 0.42, ease: "power2.inOut" });
    const model = await this.assets.load(modelUrl, (progress) => this.callbacks.onLoading(true, progress));
    if (request !== this.loadRequest) {
      this.assets.release(model);
      return;
    }
    this.activeModel = model;
    this.activeHotspots = hotspots;
    this.scene.add(model);
    const finalScale = model.scale.x;
    model.scale.setScalar(finalScale * 0.58);
    model.position.z = -1.3;
    this.setModelOpacity(model, 0);
    const glow = this.scene.getObjectByName("organ-glow") as THREE.PointLight | undefined;
    glow?.color.set(accent);
    gsap.timeline({ onComplete: () => {
      this.finalizeModelMaterials(model);
      this.callbacks.onLoading(false, 1);
    } })
      .to(model.scale, { x: finalScale, y: finalScale, z: finalScale, duration: 0.9, ease: "back.out(1.25)" }, 0)
      .to(model.position, { z: 0, duration: 0.85, ease: "power3.out" }, 0)
      .to(this.camera.position, { z: 8.2, duration: 0.9, ease: "power2.out" }, 0.08);
    this.fadeModel(model, 1, 0.72);
  }

  private setModelOpacity(root: THREE.Object3D, opacity: number) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.transparent = true;
        material.opacity = opacity;
        material.depthWrite = opacity >= 1;
        material.needsUpdate = true;
      });
    });
  }

  private fadeModel(root: THREE.Object3D, opacity: number, duration: number) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => gsap.to(material, { opacity, duration, ease: "power2.out" }));
    });
  }

  private finalizeModelMaterials(root: THREE.Object3D) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.opacity = 1;
        material.transparent = false;
        material.depthWrite = true;
        material.needsUpdate = true;
      });
    });
  }

  private updateHotspots() {
    if (!this.activeModel || !this.activeHotspots.length) return;
    const rect = this.container.getBoundingClientRect();
    const output = this.activeHotspots.map((hotspot) => {
      const world = new THREE.Vector3(...hotspot.position);
      this.activeModel!.localToWorld(world);
      const projected = world.clone().project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * rect.width;
      const y = (-projected.y * 0.5 + 0.5) * rect.height;
      const direction = world.clone().sub(this.camera.position);
      const distance = direction.length();
      this.raycaster.set(this.camera.position, direction.normalize());
      const hit = this.raycaster.intersectObject(this.activeModel!, true)[0];
      const visible = projected.z < 1 && (!hit || hit.distance >= distance - 0.18);
      return { ...hotspot, x, y, visible };
    });
    this.callbacks.onHotspots(output);
  }

  private animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    if (!this.isVisible || !this.isPageVisible) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.assets.update(delta);
    this.controls.update(delta);
    const now = performance.now();
    if (now - this.lastHotspotUpdate > 72) {
      this.updateHotspots();
      this.lastHotspotUpdate = now;
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  private onVisibilityChange = () => {
    this.isPageVisible = !document.hidden;
    if (this.isPageVisible) this.clock.start();
  };

  private resize() {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
  }

  private pauseAutoRotate = () => {
    const shouldResume = this.controls.autoRotate;
    this.controls.autoRotate = false;
    window.clearTimeout(this.pointerResumeTimer);
    if (shouldResume) this.pointerResumeTimer = window.setTimeout(() => (this.controls.autoRotate = true), 3000);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft" && this.activeModel) this.activeModel.rotation.y -= 0.08;
    if (event.key === "ArrowRight" && this.activeModel) this.activeModel.rotation.y += 0.08;
    if (event.key === "+") this.camera.position.z = Math.max(4.8, this.camera.position.z - 0.35);
    if (event.key === "-") this.camera.position.z = Math.min(12, this.camera.position.z + 0.35);
  };

  setAutoRotate(enabled: boolean) {
    this.controls.autoRotate = enabled;
  }

  reset() {
    gsap.to(this.camera.position, { x: 0, y: 0.2, z: 8.2, duration: 0.8, ease: "power3.out" });
    gsap.to(this.controls.target, { x: 0, y: 0.05, z: 0, duration: 0.8, ease: "power3.out" });
    if (this.activeModel) gsap.to(this.activeModel.rotation, { x: 0.05, y: -0.28, z: 0, duration: 0.8, ease: "power3.out" });
  }

  zoom(direction: 1 | -1) {
    gsap.to(this.camera.position, { z: THREE.MathUtils.clamp(this.camera.position.z + direction * 1.2, 4.8, 12), duration: 0.5, ease: "power2.out" });
  }

  toggleIsolate() {
    this.isolated = !this.isolated;
    const plinth = this.scene.children.find((item) => item instanceof THREE.Mesh && item.geometry instanceof THREE.CylinderGeometry);
    if (plinth) gsap.to((plinth as THREE.Mesh).material, { opacity: this.isolated ? 0.15 : 1, duration: 0.45 });
    return this.isolated;
  }

  toggleCrossSection() {
    this.crossSection = !this.crossSection;
    this.activeModel?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material.clippingPlanes = this.crossSection ? [this.clipPlane] : [];
        material.clipShadows = this.crossSection;
        material.needsUpdate = true;
      });
    });
    gsap.fromTo(this.clipPlane, { constant: -1.8 }, { constant: this.crossSection ? 0 : -1.8, duration: 0.85, ease: "power2.inOut" });
    return this.crossSection;
  }

  toggleLayers() {
    let enabled = false;
    this.activeModel?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.wireframe = !material.wireframe;
          enabled = material.wireframe;
        }
      });
    });
    return enabled;
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.pointerResumeTimer);
    this.controls.removeEventListener("start", this.pauseAutoRotate);
    this.controls.dispose();
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.assets.dispose();
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.removeEventListener("keydown", this.onKeyDown);
    this.renderer.domElement.remove();
  }
}
