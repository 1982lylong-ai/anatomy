// Offline mesh simplification for Anatomy Atelier wireframe layers.
// Usage: node scripts/simplify-lite.mjs [organId ...]  (default: all 9 organs)
// Reads public/models/<id>.glb (meshopt-compressed), writes public/models/lite/<id>.glb
// with an uncompressed triangle-list geometry at ~5k triangles (position+index+material color only).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MeshoptDecoder } from "meshoptimizer/decoder";
import { MeshoptSimplifier } from "meshoptimizer/simplifier";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, "../public/models");
const LITE_DIR = path.resolve(MODELS_DIR, "lite");
const TARGET_TRIANGLES = 5000;

const ORGANS = ["heart", "brain", "lungs", "liver", "kidneys", "eyeball", "intestine", "pancreas", "skin"];

await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

function parseGLB(buf) {
  if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error("not a glb");
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen));
  const binChunkStart = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binChunkStart);
  const bin = buf.subarray(binChunkStart + 8, binChunkStart + 8 + binLen);
  return { json, bin };
}

/** Decode a meshopt-compressed bufferView into raw bytes (Uint8Array). */
function decodeMeshoptBufferView(json, bin, bufferView) {
  const ext = bufferView.extensions.EXT_meshopt_compression;
  const src = bin.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength);
  const count = ext.count;
  const byteStride = ext.byteStride;
  if (ext.mode === "TRIANGLES") {
    const target = new Uint8Array(count * byteStride);
    MeshoptDecoder.decodeIndexBuffer(target, count, byteStride, src);
    // size 4 => Uint32 index stream
    return new Uint32Array(target.buffer, target.byteOffset, count);
  }
  // ATTRIBUTES
  const target = new Uint8Array(count * byteStride);
  MeshoptDecoder.decodeVertexBuffer(target, count, byteStride, src);
  if (ext.filter === "OCTAHEDRAL") {
    MeshoptDecoder.decodeFilterOct(target, count, byteStride);
  }
  return target;
}

/** Dequantize a KHR_mesh_quantization normalized int attribute into Float32Array. */
function dequantize(raw, componentType, comps, count) {
  const out = new Float32Array(count * comps);
  switch (componentType) {
    case 5120: { // BYTE normalized
      const v = new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      for (let i = 0; i < out.length; i++) out[i] = v[i] / 127;
      break;
    }
    case 5122: { // SHORT normalized
      const v = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
      for (let i = 0; i < out.length; i++) out[i] = v[i] / 32767;
      break;
    }
    case 5123: { // UNSIGNED_SHORT normalized
      const v = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
      for (let i = 0; i < out.length; i++) out[i] = v[i] / 65535;
      break;
    }
    case 5126: { // FLOAT
      return new Float32Array(raw.buffer, raw.byteOffset, out.length);
    }
    default:
      throw new Error(`unsupported componentType ${componentType}`);
  }
  return out;
}

async function simplifyOrgan(id) {
  const glbPath = path.join(MODELS_DIR, `${id}.glb`);
  const buf = fs.readFileSync(glbPath);
  const { json, bin } = parseGLB(buf);

  const prim = json.meshes[0].primitives[0];
  const idxAcc = json.accessors[prim.indices];
  const posAcc = json.accessors[prim.attributes.POSITION];
  const idxBv = json.bufferViews[idxAcc.bufferView];
  const posBv = json.bufferViews[posAcc.bufferView];

  // --- decode ---
  const indices = decodeMeshoptBufferView(json, bin, idxBv); // Uint32Array
  const posRaw = decodeMeshoptBufferView(json, bin, posBv);  // Uint8Array
  const positions = dequantize(posRaw, posAcc.componentType, 3, posAcc.count); // Float32Array

  // --- simplify: fan topology stalls edge collapse, so use sloppy mode.
  // sloppy collapses the fan shell to a sparse polyhedron (~238 verts,
  // ~10.6k unique edges for heart) — exactly the wireframe density we want.
  const origTriangles = indices.length / 3;
  const [sloppy, simplifyError] = MeshoptSimplifier.simplifySloppy(
    indices, positions, 3, null, TARGET_TRIANGLES * 3, 0.1,
  );

  // --- extract unique edges (each edge once) ---
  const edgeSet = new Set();
  for (let i = 0; i < sloppy.length; i += 3) {
    const a = sloppy[i], b = sloppy[i + 1], c = sloppy[i + 2];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      edgeSet.add(p < q ? p * 4294967296 + q : q * 4294967296 + p);
    }
  }

  // --- vertex list used by the edges ---
  const vertIndex = new Map();
  const verts = [];
  const lineIdx = [];
  for (const key of edgeSet) {
    const a = key % 4294967296;
    const b = Math.floor(key / 4294967296);
    for (const v of [a, b]) {
      let i = vertIndex.get(v);
      if (i === undefined) { i = verts.length; vertIndex.set(v, i); verts.push(v); }
      lineIdx.push(i);
    }
  }
  const newVertexCount = verts.length;
  const posCompact = new Float32Array(newVertexCount * 3);
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    posCompact[i * 3] = positions[v * 3];
    posCompact[i * 3 + 1] = positions[v * 3 + 1];
    posCompact[i * 3 + 2] = positions[v * 3 + 2];
  }
  const liteTriangles = sloppy.length / 3;

  // --- material color from source ---
  let color = 0xee7c6a;
  const srcMat = json.materials?.[prim.material];
  if (srcMat?.pbrMetallicRoughness?.baseColorFactor) {
    const [r, g, b] = srcMat.pbrMetallicRoughness.baseColorFactor;
    color = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
  }

  // --- write lite glb by hand (LINES primitive: position + edge indices + flat color) ---
  const use16 = newVertexCount < 65536;
  const idxBuf = use16 ? new Uint16Array(lineIdx) : new Uint32Array(lineIdx);
  const posBytes = posCompact.byteLength;
  const idxBytes = idxBuf.byteLength;
  const binLen = posBytes + idxBytes;

  const posBvLite = { buffer: 0, byteOffset: 0, byteLength: posBytes, target: 34962 };
  const idxBvLite = { buffer: 0, byteOffset: posBytes, byteLength: idxBytes, target: 34963 };
  const posAccLite = {
    bufferView: 0, componentType: 5126, count: newVertexCount, type: "VEC3",
    min: [posCompact[0], posCompact[1], posCompact[2]],
    max: [posCompact[0], posCompact[1], posCompact[2]],
  };
  for (let i = 3; i < posCompact.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = posCompact[i + k];
      if (v < posAccLite.min[k]) posAccLite.min[k] = v;
      if (v > posAccLite.max[k]) posAccLite.max[k] = v;
    }
  }
  const idxAccLite = { bufferView: 1, componentType: use16 ? 5123 : 5125, count: lineIdx.length, type: "SCALAR" };
  const [r, g, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
  const jsonOut = {
    asset: { version: "2.0", generator: "hermes-simplify-lite" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "lite" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0, mode: 1 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [r / 255, g / 255, b / 255, 1] } }],
    buffers: [{ byteLength: binLen }],
    bufferViews: [posBvLite, idxBvLite],
    accessors: [posAccLite, idxAccLite],
  };

  const jsonStr = JSON.stringify(jsonOut);
  const jsonBuf = Buffer.from(jsonStr, "utf8");
  const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
  const binBuf = Buffer.allocUnsafe(binLen);
  Buffer.from(posCompact.buffer, posCompact.byteOffset, posBytes).copy(binBuf, 0);
  Buffer.from(idxBuf.buffer, idxBuf.byteOffset, idxBytes).copy(binBuf, posBytes);

  const total = 12 + 8 + jsonBuf.length + jsonPad + 8 + binLen;
  const out = Buffer.allocUnsafe(total);
  out.write("glTF", 0, "ascii");
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(total, 8);
  out.writeUInt32LE(jsonBuf.length + jsonPad, 12);
  out.writeUInt32LE(0x4e4f534a, 16); // JSON
  jsonBuf.copy(out, 20);
  // GLB spec: chunk padding must be 0x20 (space)
  out.fill(0x20, 20 + jsonBuf.length, 20 + jsonBuf.length + jsonPad);
  out.writeUInt32LE(binLen, 20 + jsonBuf.length + jsonPad);
  out.writeUInt32LE(0x004e4942, 24 + jsonBuf.length + jsonPad); // BIN
  binBuf.copy(out, 28 + jsonBuf.length + jsonPad);

  fs.mkdirSync(LITE_DIR, { recursive: true });
  const outPath = path.join(LITE_DIR, `${id}.glb`);
  fs.writeFileSync(outPath, out);
  console.log(`${id}: ${origTriangles.toLocaleString()} tris -> ${liteTriangles.toLocaleString()} tris (${newVertexCount.toLocaleString()} verts), err=${simplifyError.toFixed(4)}, ${(out.byteLength / 1024).toFixed(0)} KB`);
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ORGANS;
for (const id of targets) {
  try {
    simplifyOrgan(id);
  } catch (e) {
    console.error(`${id}: FAILED — ${e.message}`);
  }
}
