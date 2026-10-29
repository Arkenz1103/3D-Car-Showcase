// @ts-nocheck
import SF90_GLB_URL from "@/assets/models/sf90-stradale";
import { Box3, BufferGeometry, Mesh, Vector3 } from "three";
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from "three-mesh-bvh";
import DRACO_WASM_URL from "three/examples/jsm/libs/draco/gltf/draco_decoder.wasm?url";
import DRACO_WRAPPER_JS from "three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js?raw";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneScene } from "three/examples/jsm/utils/SkeletonUtils.js";

// Accelerated raycasting (BVH) — pointer picking over hundreds of car meshes
// becomes a handful of tree lookups instead of brute-force triangle tests.
BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
Mesh.prototype.raycast = acceleratedRaycast;

async function buildRaycastAcceleration(root) {
  const geometries = new Set();
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry || node.geometry.boundsTree) return;
    if (node.geometry.attributes.position?.count > 300) geometries.add(node.geometry);
  });
  let deadline = performance.now() + 6;
  for (const geometry of geometries) {
    try {
      geometry.computeBoundsTree({ targetLeafSize: 10 });
    } catch {
      // Unsupported custom geometry retains normal raycasting.
    }
    if (performance.now() > deadline) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      deadline = performance.now() + 6;
    }
  }
}

export function fetchArrayBuffer(Q) {
  if (Q.startsWith("data:")) {
    const A = Q.indexOf(","),
      g = Q.slice(A + 1),
      I = atob(g),
      C = new Uint8Array(I.length);
    for (let E = 0; E < I.length; E++) C[E] = I.charCodeAt(E);
    return Promise.resolve(C.buffer);
  }
  return fetch(Q).then((A) => {
    if (!A.ok) throw new Error(`HTTP ${A.status}`);
    return A.arrayBuffer();
  });
}

export class InlineDracoLoader extends DRACOLoader {
  _loadLibrary(A, g) {
    return A.includes("draco_wasm_wrapper.js") || g === "text"
      ? Promise.resolve(DRACO_WRAPPER_JS)
      : A.includes("draco_decoder.wasm") || g === "arraybuffer"
        ? fetchArrayBuffer(DRACO_WASM_URL)
        : DRACOLoader.prototype._loadLibrary.call(this, A, g);
  }
}

export let dracoLoaderSingleton = null;

export function createGltfLoader() {
  if (!dracoLoaderSingleton) {
    dracoLoaderSingleton = new InlineDracoLoader();
    dracoLoaderSingleton.setWorkerLimit(2);
    dracoLoaderSingleton.preload();
  }
  const Q = new GLTFLoader();
  Q.setDRACOLoader(dracoLoaderSingleton);
  Q.setMeshoptDecoder(MeshoptDecoder);
  return Q;
}

export function getBundledGlbUrl() {
  return SF90_GLB_URL;
}

export function classifyMesh(Q) {
  const A = [];
  let g = Q;
  for (; g;) (g.name && A.push(g.name), (g = g.parent));
  const I = Array.isArray(Q.material) ? Q.material[0] : Q.material,
    C = `${A.join(" ")} ${I?.name || ""}`.toLowerCase();
  return /brembo|caliper|pinza/.test(C)
    ? "calipers"
    : /rotor|brake_disc|brakedisc|disc_bell|carbon_ceramic|\bdisc\b/.test(C)
      ? "brakes_ccm"
      : /tire|tyre|michelin|pirelli|tread/.test(C)
        ? "tires"
        : /rim|wheel_barrel|forged_5spoke|center_cap|lug_bolt|wheel|ext_wheel/.test(C)
          ? "wheels"
          : /headlight|projector|matrix_led|led_strip|drl|front_lamp|lamp_front/.test(C)
            ? "headlights"
            : /taillight|rear_lamp|lamp_rear|rear_light|brake_ring/.test(C)
              ? "taillights"
              : /steering|steer|manettino|paddle/.test(C)
                ? "steering_wheel"
                : /int_display|screen|display|seat|interior|headliner|carpet|dash|start_button/.test(C)
                  ? "cockpit"
                  : /win_int|windshield|windscreen|glass|canopy|wiper/.test(C)
                    ? "glass_canopy"
                    : /shutoff|gurney|spoiler|wing|sduct|aero_intake|cooling_louver|extractor_grille/.test(C)
                      ? "aero_gurney"
                      : /splitter|canard|chin/.test(C)
                        ? "carbon_splitter"
                        : /side_skirt|sill|rocker/.test(C)
                          ? "carbon_skirts"
                          : /diffuser/.test(C)
                            ? "carbon_diffuser"
                            : /exhaust|inconel|muffler|tailpipe/.test(C)
                              ? "exhausts"
                              : /steering|manettino|paddle/.test(C)
                                ? "steering_wheel"
                                : /hybrid|mgu|rac_e|battery|inverter|hv/.test(C)
                                  ? "hybrid_system"
                                  : /f154|v8|engine|plenum|airbox|turbo|crank/.test(C)
                                    ? "engine_v8"
                                    : /windshield|lexan|glass|window|canopy|wiper/.test(C)
                                      ? "glass_canopy"
                                      : /cockpit|seat|leather|alcantara|stitching|binnacle|dashboard|switchgear|curved_display|start_button|carpet|interior/.test(
                                            C,
                                          )
                                        ? "cockpit"
                                        : /carbon/.test(C)
                                          ? "carbon_splitter"
                                          : "paintwork";
}

export async function parseGlb(Q, A = "./") {
  const g = createGltfLoader();
  return new Promise((I, C) => {
    g.parse(Q, A, I, C);
  });
}

export async function tryFetchGlb(Q) {
  try {
    const A = await fetch(Q, {
      method: "GET",
    });
    if (!A.ok || (A.headers.get("content-type") || "").includes("text/html")) return null;
    const I = await A.arrayBuffer();
    if (I.byteLength < 64) return null;
    const C = new DataView(I).getUint32(0, !0),
      E = new Uint8Array(I)[0];
    return C === 1179937895 || E === 123 ? I : null;
  } catch {
    return null;
  }
}

async function loadVehicleSource(Q, A, g, { accelerateRaycast = true } = {}) {
  let I = null,
    C = "bundled-reference",
    E = "sf90-stradale-showroom.glb (Composite Ferrari CAD + SF90 Powertrain/Aero Build)",
    e = !0;
  if (g && !g.isSF90Reference) {
    I = await fetchArrayBuffer(g.assetUrl);
    const n = await parseGlb(I, "./"),
      r = n.scene;
    ((r.rotation.y = g.rotationY), r.updateMatrixWorld(!0));
    const h = new Box3().setFromObject(r),
      V = new Vector3(),
      P = new Vector3();
    (h.getSize(V), h.getCenter(P));
    const y = g.targetLength / Math.max(V.z, 0.001);
    (r.scale.setScalar(y),
      r.updateMatrixWorld(!0),
      h.setFromObject(r),
      h.getCenter(P),
      (r.position.x -= P.x),
      (r.position.z -= P.z),
      (r.position.y -= h.min.y),
      r.updateMatrixWorld(!0));
    let j = 0,
      u = 0;
    if (accelerateRaycast) await buildRaycastAcceleration(r);
    return (
      r.traverse((K) => {
        if (K.isMesh) {
          j++;
          const U = K.geometry;
          u += U.index ? U.index.count / 3 : U.attributes.position.count / 3;
        }
      }),
      {
        gltf: n,
        sourceKind: "bundled-reference",
        sourceLabel: `${g.license.title} — ${g.license.author} (${g.license.license})`,
        fileSizeMB: Number((I.byteLength / (1024 * 1024)).toFixed(2)),
        meshCount: j,
        triangleCount: Math.round(u),
        isBundledReference: !1,
      }
    );
  }
  if (Q)
    ((I = Q.buffer), (C = "custom-upload"), (E = `${Q.name} (User-Loaded Replaceable GLB Asset)`), (e = !1));
  else if (A) {
    const n = await fetch(A);
    if (!n.ok) throw new Error(`Failed to fetch model URL (${n.status})`);
    ((I = await n.arrayBuffer()),
      (C = "query-url"),
      (E = `${A.split("/").pop() || "custom.glb"} (Remote GLB URL)`),
      (e = !1));
  } else {
    const r = new URLSearchParams(window.location.search).get("model");
    if (r) {
      const h = await tryFetchGlb(r);
      h &&
        ((I = h),
        (C = "query-url"),
        (E = `${r.split("/").pop() || "custom.glb"} (URL Parameter GLB)`),
        (e = !1));
    }
    if (!I && !g) {
      const h = await tryFetchGlb("./models/sf90-stradale.glb");
      h &&
        ((I = h),
        (C = "drop-in-public"),
        (E = "public/models/sf90-stradale.glb (Drop-In SF90 Asset)"),
        (e = !1));
    }
    I ||
      ((I = await fetchArrayBuffer(SF90_GLB_URL)),
      (C = "bundled-reference"),
      (E = "sf90-stradale-showroom.glb (Bundled 73-Mesh Reference GLB)"),
      (e = !0));
  }
  const resourcePath = A && /^https?:/i.test(A) ? new URL(".", A).href : "./";
  const o = await parseGlb(I, resourcePath);
  if (!o.scene?.children.length) throw new Error("This file contains no displayable 3D scene.");
  if (!e) {
    o.scene.updateMatrixWorld(!0);
    const n = new Box3().setFromObject(o.scene),
      r = new Vector3(),
      h = new Vector3();
    (n.getSize(r), n.getCenter(h));
    const V = Math.max(r.x, r.y, r.z);
    if (V > 0.001 && (V < 3.2 || V > 6.2)) {
      const P = 4.65 / V;
      (o.scene.scale.multiplyScalar(P),
        o.scene.updateMatrixWorld(!0),
        n.setFromObject(o.scene),
        n.getCenter(h));
    }
    ((o.scene.position.x -= h.x),
      (o.scene.position.z -= h.z),
      (o.scene.position.y -= n.min.y),
      o.scene.updateMatrixWorld(!0));
  }
  let l = 0,
    M = 0;
  if (accelerateRaycast) await buildRaycastAcceleration(o.scene);
  return (
    o.scene.traverse((n) => {
      if (n.isMesh) {
        l++;
        const r = n.geometry;
        M += r.index ? r.index.count / 3 : r.attributes.position.count / 3;
      }
    }),
    {
      gltf: o,
      sourceKind: C,
      sourceLabel: E,
      fileSizeMB: Number((I.byteLength / (1024 * 1024)).toFixed(2)),
      meshCount: l,
      triangleCount: Math.round(M),
      isBundledReference: e,
    }
  );
}

const bundledAssets = new Map();

// Decode each bundled car once. Cloned scene nodes keep mutable materials and
// transforms private, while the expensive geometry, textures, and BVHs are shared.
export async function loadVehicleAsset(upload, url, car, options = {}) {
  let asset;
  if (upload || url) {
    asset = await loadVehicleSource(upload, url, car, options);
  } else {
    const queryModel = new URLSearchParams(window.location.search).get("model") || "";
    const key = `${car?.id || "sf90"}:${queryModel}`;
    if (!bundledAssets.has(key)) {
      const pending = loadVehicleSource(null, null, car, options).catch((error) => {
        bundledAssets.delete(key);
        throw error;
      });
      bundledAssets.set(key, pending);
    }
    asset = await bundledAssets.get(key);
  }
  return {
    ...asset,
    carId: car?.id || "custom",
    gltf: { ...asset.gltf, scene: cloneScene(asset.gltf.scene) },
  };
}
