import * as THREE from "three";

/**
 * Cardiac heartbeat animation: a full cardiac cycle with
 *  1. phased chamber contraction (atria then ventricles) via per-vertex
 *     region weights + a shader hook (see loaders.ts heart injection),
 *  2. four valve discs that open/close with the correct phase,
 *  3. red/blue blood-flow particle streams through both circulations.
 *
 * One cycle = 1.0 (progress). Phase timeline (normalised):
 *  0.00–0.12  atrial systole          (atria contract, AV valves open)
 *  0.12–0.30  isovolumetric start     (ventricles begin to tense)
 *  0.30–0.60  ventricular ejection    (AV valves closed, outflow open)
 *  0.60–1.00  diastole                (all relax, AV valves reopen)
 */

const CYCLE_DEFAULT_SECONDS = 3.0;

const ATRIAL_CONTRACT = 0.11; // shrink amount (normal direction, inward)
const VENTRICULAR_CONTRACT = 0.13;

/** Valve discs: position, up vector (flow direction), colour. */
type ValveSpec = {
  id: string;
  /** "av" = atrioventricular (closed during ejection), "outflow" = semilunar. */
  kind: "av" | "outflow";
  position: [number, number, number];
  up: [number, number, number];
  color: number;
  radius: number;
};

const VALVES: ValveSpec[] = [
  { id: "tricuspid", kind: "av", position: [0.05, -0.2, 0.6], up: [0, -1, 0], color: 0xffd9e8, radius: 0.34 },
  { id: "mitral", kind: "av", position: [0.28, -0.5, 0.52], up: [0, -1, 0], color: 0xffd9e8, radius: 0.34 },
  { id: "aortic", kind: "outflow", position: [0.05, 1.12, 0.55], up: [0, 1, 0], color: 0xffe3d0, radius: 0.3 },
  { id: "pulmonary", kind: "outflow", position: [-0.32, 0.28, -0.62], up: [0, 1, 0], color: 0xffe3d0, radius: 0.28 },
];

/** Blood-flow paths in FIT_SIZE space. Blue = right heart (deoxygenated),
 *  red = left heart (oxygenated). */
const BLUE_PATH: [number, number, number][] = [
  [0.15, 1.35, 0.1],      // caval inflow
  [-0.85, 0.4, 0.55],     // right atrium
  [0.05, -0.2, 0.6],      // tricuspid
  [-0.6, -0.6, 0.6],      // right ventricle
  [-0.35, 0.35, -0.75],   // pulmonary valve
  [-0.4, 1.05, -0.9],     // pulmonary artery
];

const RED_PATH: [number, number, number][] = [
  [0.85, 0.95, -0.5],     // pulmonary venous inflow
  [0.8, 0.6, 0.5],        // left atrium
  [0.28, -0.5, 0.52],     // mitral
  [0.65, -0.7, 0.6],      // left ventricle
  [0.05, 1.12, 0.55],     // aortic valve
  [0, 1.6, 0.6],          // aorta
];

const PARTICLES_PER_STREAM = 14;
const PARTICLE_SIZE = 0.09;

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Region weights for one vertex: how strongly it belongs to the atrial band
 *  and the ventricular band of the heart (FIT_SIZE space). */
export function computeHeartbeatWeights(position: THREE.BufferAttribute): {
  atrial: Float32Array;
  ventricular: Float32Array;
} {
  const count = position.count;
  const array = position.array as Float32Array;
  const atrial = new Float32Array(count);
  const ventricular = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const y = array[i * 3 + 1];
    // Atria sit around y ∈ [0.15, 1.0]; fade out into the great vessels above.
    atrial[i] = smoothstep(0.1, 0.5, y) * (1 - smoothstep(1.02, 1.45, y));
    // Ventricles occupy y ∈ [-1.2, -0.2]; keep the apex mostly still.
    ventricular[i] = smoothstep(-1.15, -0.65, y) * (1 - smoothstep(-0.1, 0.25, y));
  }
  return { atrial, ventricular };
}

export class HeartbeatAnimation {
  readonly group = new THREE.Group();
  private valves: { disc: THREE.Mesh; open: number }[] = [];
  private streams: { curve: THREE.CatmullRomCurve3; points: THREE.Points; color: number }[] = [];
  private phase = 0;
  private playing = false;
  private speed = 1;
  private cycleSeconds = CYCLE_DEFAULT_SECONDS;
  private onPhase?: (phase: number) => void;

  constructor(onPhase?: (phase: number) => void) {
    this.onPhase = onPhase;

    // --- valves: flat discs that scale in/out as they open/close ---
    for (const spec of VALVES) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(spec.radius, 24),
        new THREE.MeshBasicMaterial({
          color: spec.color,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      disc.position.set(...spec.position);
      disc.lookAt(
        new THREE.Vector3(spec.position[0] + spec.up[0], spec.position[1] + spec.up[1], spec.position[2] + spec.up[2]),
      );
      disc.name = spec.kind;
      disc.scale.setScalar(0.001); // closed by default
      this.group.add(disc);
      this.valves.push({ disc, open: 0 });
    }

    // --- blood streams ---
    for (const [path, color] of [
      [BLUE_PATH, 0x4a9dd6],
      [RED_PATH, 0xd64545],
    ] as const) {
      const curve = new THREE.CatmullRomCurve3(path.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, "catmullrom", 0.5);
      const positions = new Float32Array(PARTICLES_PER_STREAM * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color,
          size: PARTICLE_SIZE,
          transparent: true,
          opacity: 0.85,
          depthTest: false,
          sizeAttenuation: false,
        }),
      );
      this.group.add(points);
      this.streams.push({ curve, points, color });
    }

    this.group.visible = false;
  }

  get isPlaying() {
    return this.playing;
  }

  get currentSpeed() {
    return this.speed;
  }

  setSpeed(speed: number) {
    this.speed = Math.max(0.1, speed);
  }

  play() {
    this.phase = 0;
    this.playing = true;
    this.group.visible = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  stop() {
    this.playing = false;
    this.group.visible = false;
    // reset deformation
    this.applyPhase(0);
  }

  /** Advance the cycle; call every frame while playing. */
  update(delta: number) {
    if (!this.playing || !this.group.visible) return;
    this.phase = (this.phase + (delta / this.cycleSeconds) * this.speed) % 1;
    this.applyPhase(this.phase);
    this.updateParticles(delta);
    this.onPhase?.(this.phase);
  }

  private applyPhase(t: number) {
    // --- chamber contraction amounts (negative = shrink along normal) ---
    let atrial = 0;
    let ventricular = 0;
    if (t < 0.12) {
      atrial = -ATRIAL_CONTRACT * Math.sin((t / 0.12) * Math.PI);
    } else if (t < 0.3) {
      atrial = 0;
      ventricular = -VENTRICULAR_CONTRACT * smoothstep(0.12, 0.22, t);
    } else if (t < 0.6) {
      ventricular = -VENTRICULAR_CONTRACT;
    }
    this.setDeformation(atrial, ventricular);

    // --- valves: AV (tricuspid/mitral) closed during ventricular ejection;
    //     outflow (aortic/pulmonary) closed otherwise ---
    const ejection = t >= 0.28 && t < 0.62;
    const openAV = ejection ? 0.001 : 1;
    const openOutflow = ejection ? 1 : 0.001;
    for (const v of this.valves) {
      const target = v.disc.name === "av" ? openAV : openOutflow;
      // smooth approach
      v.disc.scale.setScalar(v.disc.scale.x + (target - v.disc.scale.x) * 0.35);
      v.open = v.disc.scale.x;
    }
    void this.valves;
  }

  private setDeformation(atrial: number, ventricular: number) {
    this.deform = { atrial, ventricular };
  }

  /** Latest chamber deformation amounts; the viewer syncs these onto the
   *  heart material uniforms every frame. */
  get deformState(): { atrial: number; ventricular: number } {
    return this.deform;
  }
  private deform = { atrial: 0, ventricular: 0 };

  private updateParticles(delta: number) {
    for (const stream of this.streams) {
      const positions = stream.points.geometry.attributes.position.array as Float32Array;
      const advance = (delta / this.cycleSeconds) * this.speed;
      for (let i = 0; i < PARTICLES_PER_STREAM; i++) {
        // stagger particles along the path; flow pauses briefly at phase
        // boundaries where blood is not moving (diastasis-ish feel).
        const flow = this.phase < 0.1 ? 0.25 : this.phase > 0.62 && this.phase < 0.75 ? 0.5 : 1;
        const p = (this.phase + (i + 1) / PARTICLES_PER_STREAM + advance * flow) % 1;
        const point = stream.curve.getPoint(p);
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      }
      stream.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  dispose() {
    this.stop();
    this.valves.forEach(({ disc }) => {
      disc.geometry.dispose();
      (disc.material as THREE.Material).dispose();
    });
    this.streams.forEach(({ points }) => {
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    });
  }
}
