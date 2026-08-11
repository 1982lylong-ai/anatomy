import * as THREE from "three";

/**
 * Cardiac conduction animation: a glowing pulse travels along the
 * conduction pathway (SA node → AV node → bundle of His → bundle branches →
 * Purkinje fibres). Positions are the authoring-sampled heart hotspots in
 * FIT_SIZE space, so the animation rides on the same surface as the dots.
 */
export const CONDUCTION_PATH: [number, number, number][] = [
  [-0.12, 0.65, -0.55], // sa-node
  [1.02, -0.73, -0.36], // av-node
  [0.86, 0.52, -0.11],  // his-bundle
  [-1.11, 0.04, 0],     // right-bundle
  [0.52, -1.63, 0.51],  // purkinje (apex)
];

const TRAIL_COUNT = 9;
const TRAIL_SPACING = 0.035; // fraction of path per trail element

export class ConductionAnimation {
  readonly group = new THREE.Group();
  private curve: THREE.CatmullRomCurve3;
  private leader: THREE.Mesh;
  private trail: THREE.Mesh[] = [];
  private pathLine: THREE.Line;
  private progress = 0;
  private cycleSeconds = 3.4;

  constructor() {
    this.curve = new THREE.CatmullRomCurve3(
      CONDUCTION_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "catmullrom",
      0.5,
    );

    // Semi-transparent pathway so the route is legible before the pulse.
    const pathPoints = this.curve.getPoints(64);
    const pathGeo = new THREE.BufferGeometry().setFromPoints(pathPoints);
    this.pathLine = new THREE.Line(
      pathGeo,
      new THREE.LineBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.35, depthTest: false }),
    );
    this.group.add(this.pathLine);

    // Leader: a bright pulsing orb.
    this.leader = this.makeOrb(0xffe9a8, 0.11, 1);
    this.group.add(this.leader);

    // Trail: dimmer orbs that follow at fixed path-space offsets.
    for (let i = 1; i <= TRAIL_COUNT; i++) {
      const orb = this.makeOrb(0xffc96a, 0.085 * (1 - i / (TRAIL_COUNT + 2)), 0.85 * (1 - i / (TRAIL_COUNT + 1)));
      this.trail.push(orb);
      this.group.add(orb);
    }

    this.group.visible = false;
  }

  private makeOrb(color: number, size: number, opacity: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(size, 16, 12),
      // depthTest off: the pulse rides on surface projections that sit inside
      // the opaque mesh, and the whole point is that it reads through the
      // specimen like a glowing electrical signal.
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false }),
    );
  }

  play() {
    this.progress = 0;
    this.group.visible = true;
  }

  stop() {
    this.group.visible = false;
  }

  /** Advance the pulse; call every frame while visible. */
  update(delta: number) {
    if (!this.group.visible) return;
    this.progress = (this.progress + delta / this.cycleSeconds) % 1;
    const pos = this.curve.getPoint(this.progress);
    this.leader.position.copy(pos);
    for (let i = 0; i < this.trail.length; i++) {
      const t = (this.progress - (i + 1) * TRAIL_SPACING + 1) % 1;
      this.trail[i].position.copy(this.curve.getPoint(t));
    }
  }

  dispose() {
    this.leader.geometry.dispose();
    (this.leader.material as THREE.Material).dispose();
    this.trail.forEach((orb) => {
      orb.geometry.dispose();
      (orb.material as THREE.Material).dispose();
    });
    this.pathLine.geometry.dispose();
    (this.pathLine.material as THREE.Material).dispose();
  }
}
