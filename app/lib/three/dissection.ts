import * as THREE from "three";

/**
 * Layered dissection of the heart: peels the specimen open from the outside in
 * by revealing programmatic internal structures, since the source model is a
 * single surface shell (no inner geometry).
 *
 *   layer 1 — chambers      (4 translucent ellipsoids: RA/LA/RV/LV)
 *   layer 2 — + valves      (4 valve discs at the atrioventricular/semilunar sites)
 *   layer 3 — + conduction  (SA→AV→His→bundles→Purkinje pathway line)
 *
 * Chamber colours follow blood-oxygen semantics (blue = deoxygenated right
 * heart, red = oxygenated left heart) so the circulation reads at a glance.
 */

type ChamberSpec = {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
  color: number;
};

const CHAMBERS: ChamberSpec[] = [
  { id: "ra", position: [-0.82, 0.42, 0.55], scale: [0.5, 0.55, 0.5], color: 0x4a9dd6 },
  { id: "la", position: [0.78, 0.62, 0.5], scale: [0.5, 0.55, 0.5], color: 0xd64545 },
  { id: "rv", position: [-0.58, -0.58, 0.62], scale: [0.55, 0.68, 0.55], color: 0x4a9dd6 },
  { id: "lv", position: [0.62, -0.66, 0.6], scale: [0.58, 0.72, 0.58], color: 0xd64545 },
];

type ValveSpec = {
  position: [number, number, number];
  up: [number, number, number];
  color: number;
  radius: number;
};

const VALVES: ValveSpec[] = [
  { position: [0.05, -0.2, 0.6], up: [0, -1, 0], color: 0xffd9e8, radius: 0.34 },
  { position: [0.28, -0.5, 0.52], up: [0, -1, 0], color: 0xffd9e8, radius: 0.34 },
  { position: [0.05, 1.12, 0.55], up: [0, 1, 0], color: 0xffe3d0, radius: 0.3 },
  { position: [-0.32, 0.28, -0.62], up: [0, 1, 0], color: 0xffe3d0, radius: 0.28 },
];

// Mirrors conduction.ts control points (SA→AV→His→bundles→apex).
const CONDUCTION_PATH: [number, number, number][] = [
  [-0.12, 0.65, -0.55], // SA
  [1.02, -0.73, -0.36], // AV
  [0.86, 0.52, -0.11], // His
  [-1.11, 0.04, 0], // right bundle
  [0.52, -1.63, 0.51], // apex (Purkinje)
];

export class DissectionLayer {
  readonly group = new THREE.Group();
  private chambers = new THREE.Group();
  private valves = new THREE.Group();
  private conduction = new THREE.Group();

  constructor() {
    // --- chambers: translucent ellipsoids ---
    for (const c of CHAMBERS) {
      const geometry = new THREE.SphereGeometry(1, 28, 20);
      geometry.scale(...c.scale);
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: c.color,
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
        }),
      );
      mesh.position.set(...c.position);
      this.chambers.add(mesh);
    }

    // --- valves: translucent discs ---
    for (const v of VALVES) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(v.radius, 24),
        new THREE.MeshBasicMaterial({
          color: v.color,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      disc.position.set(...v.position);
      disc.lookAt(new THREE.Vector3(v.position[0] + v.up[0], v.position[1] + v.up[1], v.position[2] + v.up[2]));
      this.valves.add(disc);
    }

    // --- conduction pathway ---
    const curve = new THREE.CatmullRomCurve3(
      CONDUCTION_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "catmullrom",
      0.5,
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(64)),
      new THREE.LineBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.55, depthTest: false }),
    );
    this.conduction.add(line);

    this.group.add(this.chambers, this.valves, this.conduction);
    this.setLayer(1);
  }

  /** Show the indicated dissection depth (1–3). */
  setLayer(level: number) {
    this.chambers.visible = level >= 1;
    this.valves.visible = level >= 2;
    this.conduction.visible = level >= 3;
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
