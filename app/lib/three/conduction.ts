import * as THREE from "three";

/**
 * Cardiac conduction animation: a glowing pulse travels from the SA node to
 * the AV node, then through the bundle of His where it splits into right and
 * left bundle branches before reaching the Purkinje network at the apex.
 *
 * The two paths share the same SA→AV→His control points, so both pulses are
 * visually identical until the branch point, then diverge naturally.
 * Positions are the authoring-sampled heart hotspots in FIT_SIZE space.
 */
const SA: [number, number, number] = [-0.12, 0.65, -0.55];
const AV: [number, number, number] = [1.02, -0.73, -0.36];
const HIS: [number, number, number] = [0.86, 0.52, -0.11];
const RIGHT_BUNDLE: [number, number, number] = [-1.11, 0.04, 0];
const LEFT_BUNDLE: [number, number, number] = [0.43, 0.14, 0.86];
const APEX: [number, number, number] = [0.52, -1.63, 0.51];

const RIGHT_PATH: [number, number, number][] = [SA, AV, HIS, RIGHT_BUNDLE, APEX];
const LEFT_PATH: [number, number, number][] = [SA, AV, HIS, LEFT_BUNDLE, APEX];

const TRAIL_COUNT = 8;
const TRAIL_SPACING = 0.045; // fraction of path per trail element

class Pulse {
  readonly group = new THREE.Group();
  private curve: THREE.CatmullRomCurve3;
  private leader: THREE.Mesh;
  private trail: THREE.Mesh[] = [];
  private progress = 0;

  constructor(path: [number, number, number][], color: number) {
    this.curve = new THREE.CatmullRomCurve3(
      path.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      "catmullrom",
      0.5,
    );
    this.leader = this.makeOrb(color, 0.115, 1);
    this.group.add(this.leader);
    for (let i = 1; i <= TRAIL_COUNT; i++) {
      const orb = this.makeOrb(color, 0.085 * (1 - i / (TRAIL_COUNT + 2)), 0.8 * (1 - i / (TRAIL_COUNT + 1)));
      this.trail.push(orb);
      this.group.add(orb);
    }
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

  reset() {
    this.progress = 0;
  }

  /** t in [0, 1); advances position and trail. */
  update(t: number) {
    this.progress = t;
    this.leader.position.copy(this.curve.getPoint(t));
    for (let i = 0; i < this.trail.length; i++) {
      const tt = (t - (i + 1) * TRAIL_SPACING + 1) % 1;
      this.trail[i].position.copy(this.curve.getPoint(tt));
    }
  }

  dispose() {
    this.leader.geometry.dispose();
    (this.leader.material as THREE.Material).dispose();
    this.trail.forEach((orb) => {
      orb.geometry.dispose();
      (orb.material as THREE.Material).dispose();
    });
  }
}

export class ConductionAnimation {
  readonly group = new THREE.Group();
  private rightPulse: Pulse;
  private leftPulse: Pulse;
  private pathLine: THREE.Line;
  private progress = 0;
  private cycleSeconds = 4.2;

  constructor() {
    // Translucent pathways for both branches so the route is legible.
    this.pathLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.CatmullRomCurve3(RIGHT_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "catmullrom", 0.5).getPoints(64),
      ),
      new THREE.LineBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.3, depthTest: false }),
    );
    this.group.add(this.pathLine);
    // The left branch curves through the anterior wall; draw it slightly
    // brighter so the fork reads as two routes.
    const leftLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.CatmullRomCurve3(LEFT_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "catmullrom", 0.5).getPoints(64),
      ),
      new THREE.LineBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.3, depthTest: false }),
    );
    this.group.add(leftLine);

    // Right bundle: warm gold. Left bundle: cool cyan — mirrors the hotspot
    // palette (right #7fb069 green / left #4a9db8 blue) for consistency.
    this.rightPulse = new Pulse(RIGHT_PATH, 0xffd76a);
    this.leftPulse = new Pulse(LEFT_PATH, 0x9fe0ff);
    this.group.add(this.rightPulse.group, this.leftPulse.group);

    this.group.visible = false;
  }

  play() {
    this.progress = 0;
    this.rightPulse.reset();
    this.leftPulse.reset();
    this.group.visible = true;
  }

  stop() {
    this.group.visible = false;
  }

  /** Advance both pulses; call every frame while visible. */
  update(delta: number) {
    if (!this.group.visible) return;
    this.progress = (this.progress + delta / this.cycleSeconds) % 1;
    this.rightPulse.update(this.progress);
    this.leftPulse.update(this.progress);
  }

  dispose() {
    this.rightPulse.dispose();
    this.leftPulse.dispose();
    this.pathLine.geometry.dispose();
    (this.pathLine.material as THREE.Material).dispose();
  }
}
