// @ts-nocheck
/**
 * Race-only Porsche and Bugatti opponents. The bundled GLBs provide their real
 * body, lens and emitter geometry; we only tune the light materials at runtime.
 * Static model transforms, raycasting and shadow-map passes are disabled to
 * keep the added cars inexpensive during the 60 fps race loop.
 */
import { useFrame } from "@react-three/fiber";
import { memo, useEffect, useRef, useState } from "react";
import { BufferAttribute, BufferGeometry, Group, Mesh, Object3D, SpotLight } from "three";
import { RACE_OPPONENT_CARS } from "@/data/raceOpponentCars";
import { loadVehicleAsset } from "@/lib/gltf";
import { AI_COUNT, raceAi, raceDrive } from "./raceEngine";
import { raceSession } from "./raceSession";

// Each opponent gets its own cloned nodes and lamp materials, but the heavy GLB
// source geometry/textures remain shared by loadVehicleAsset across race replays.
const opponentSceneCache = new Map();
const opponentCars = RACE_OPPONENT_CARS.slice(0, AI_COUNT);
const HEADLIGHT_LOW_BEAM = 340;

function splitIndexedLampGeometry(source) {
  const position = source.getAttribute("position");
  const sourceIndices = source.index?.array;
  const total = sourceIndices ? sourceIndices.length : position.count;
  const front = [];
  const rear = [];
  for (let offset = 0; offset + 2 < total; offset += 3) {
    const a = sourceIndices ? sourceIndices[offset] : offset;
    const b = sourceIndices ? sourceIndices[offset + 1] : offset + 1;
    const c = sourceIndices ? sourceIndices[offset + 2] : offset + 2;
    const z = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    (z >= 0 ? front : rear).push(a, b, c);
  }

  const makeGeometry = (indices) => {
    const geometry = new BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) {
      const sourceArray = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
      const stride = attribute.isInterleavedBufferAttribute ? attribute.data.stride : attribute.itemSize;
      const attributeOffset = attribute.isInterleavedBufferAttribute ? attribute.offset : 0;
      const ArrayType = sourceArray.constructor;
      const values = new ArrayType(indices.length * attribute.itemSize);
      for (let vertex = 0; vertex < indices.length; vertex++) {
        const sourceVertex = indices[vertex];
        for (let component = 0; component < attribute.itemSize; component++) {
          values[vertex * attribute.itemSize + component] =
            sourceArray[sourceVertex * stride + attributeOffset + component];
        }
      }
      const copy = new BufferAttribute(values, attribute.itemSize, attribute.normalized);
      copy.name = attribute.name;
      geometry.setAttribute(name, copy);
    }
    geometry.computeBoundingSphere();
    return geometry;
  };

  return [makeGeometry(front), makeGeometry(rear)];
}

function makeLampMaterial(source, color) {
  const material = source.clone();
  material.emissive?.set(color);
  material.emissiveIntensity = 0;
  material.toneMapped = false;
  return material;
}

function makeOpponentHeadlightRig() {
  const rig = new Group();
  const beams = [];
  // One broad, shadowless beam per opponent keeps real road illumination while
  // limiting the race scene to four spotlights total (two player, two AI).
  const target = new Object3D();
  target.position.set(0, -0.32, -10.5);
  const spot = new SpotLight("#EAF4FF", 0, 17, 0.58, 0.78, 1.7);
  spot.position.set(0, 0.58, -1.92);
  spot.target = target;
  spot.castShadow = false;
  rig.add(target, spot);
  beams.push(spot);
  return { rig, beams };
}

function prepareOpponentScene(scene) {
  const headlights = [];
  const taillights = [];
  const splitMeshes = [];
  scene.updateMatrixWorld(true);

  scene.traverse((node) => {
    node.matrixAutoUpdate = false;
    if (!node.isMesh) return;
    node.castShadow = false;
    node.receiveShadow = false;
    node.raycast = () => null;

    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const porscheLampIndex = sourceMaterials.findIndex((material) => /930_lights$/i.test(material?.name || ""));
    if (porscheLampIndex >= 0 && node.geometry?.getAttribute("position")) {
      // The Porsche source combines both ends into one lamp mesh. Separate its
      // front/rear triangles along the authored longitudinal axis so braking
      // only brightens the actual rear lenses, not the headlights.
      const [frontGeometry, rearGeometry] = splitIndexedLampGeometry(node.geometry);
      const source = sourceMaterials[porscheLampIndex];
      const headMaterial = makeLampMaterial(source, "#EAF4FF");
      const tailMaterial = makeLampMaterial(source, "#FF171B");
      const frontMaterials = sourceMaterials.slice();
      frontMaterials[porscheLampIndex] = headMaterial;
      node.geometry = frontGeometry;
      node.material = Array.isArray(node.material) ? frontMaterials : headMaterial;
      const rearMesh = new Mesh(rearGeometry, tailMaterial);
      rearMesh.name = `${node.name || "Porsche"}_Rear_Brake_Lamps`;
      rearMesh.position.copy(node.position);
      rearMesh.quaternion.copy(node.quaternion);
      rearMesh.scale.copy(node.scale);
      rearMesh.matrix.copy(node.matrix);
      rearMesh.matrixAutoUpdate = false;
      rearMesh.castShadow = false;
      rearMesh.receiveShadow = false;
      rearMesh.raycast = () => null;
      splitMeshes.push({ parent: node.parent, mesh: rearMesh });
      headlights.push(headMaterial);
      taillights.push(tailMaterial);
      return;
    }

    const configured = sourceMaterials.map((source) => {
      const name = (source?.name || "").toLowerCase();
      if (/headlight_emit|headlamp_emit|front_lamp_emit/.test(name)) {
        const material = makeLampMaterial(source, "#EAF4FF");
        headlights.push(material);
        return material;
      }
      if (/taillight_emit|tail_lamp_emit|rear_lamp_emit|brake_light_emit/.test(name)) {
        const material = makeLampMaterial(source, "#FF171B");
        taillights.push(material);
        return material;
      }
      return source;
    });
    if (configured.some((material, index) => material !== sourceMaterials[index])) {
      node.material = Array.isArray(node.material) ? configured : configured[0];
    }
  });

  for (const item of splitMeshes) item.parent?.add(item.mesh);
  const { rig: headlightRig, beams } = makeOpponentHeadlightRig();
  return { scene, headlights, taillights, headlightRig, beams };
}

function getOpponentModel(car, slot) {
  const key = `${car.id}:${slot}`;
  if (!opponentSceneCache.has(key)) {
    const pending = loadVehicleAsset(null, null, car, { accelerateRaycast: false })
      .then((asset) => prepareOpponentScene(asset.gltf.scene))
      .catch((error) => {
        opponentSceneCache.delete(key);
        throw error;
      });
    opponentSceneCache.set(key, pending);
  }
  return opponentSceneCache.get(key);
}

export const RaceOpponents = memo(function RaceOpponents() {
  const groups = useRef<any[]>([]);
  const lightState = useRef<any[]>([]);
  const [models, setModels] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    let index = 0;
    setModels([]);

    const loadNext = async () => {
      const slot = index++;
      const car = opponentCars[slot];
      if (!car) return;
      try {
        const model = await getOpponentModel(car, slot);
        if (cancelled) return;
        setModels((previous) => {
          const next = previous.slice();
          next[slot] = model;
          return next;
        });
      } catch {
        // Keep the race playable if one optional opponent model fails to load.
      }
      if (!cancelled) void loadNext();
    };

    void loadNext();
    return () => {
      cancelled = true;
    };
  }, []);

  useFrame(() => {
    const active = raceDrive.active;
    const headlightsOn = active && raceSession.carLightsOn;
    for (let slot = 0; slot < AI_COUNT; slot++) {
      const node = groups.current[slot];
      const model = models[slot];
      const visible = active && !!model;
      if (node) {
        node.visible = visible;
        if (visible) {
          node.position.set(raceAi.x[slot], raceAi.y[slot], raceAi.z[slot]);
          // Same convention as the player's rig: local -Z is forward.
          const impact = raceAi.impact[slot];
          node.rotation.y = raceAi.heading[slot] + raceAi.impactSide[slot] * impact * 0.035;
          node.rotation.z = raceAi.impactSide[slot] * impact * 0.075;
        }
      }
      if (!model) continue;

      const braking = active && raceAi.braking[slot] === 1;
      const tailIntensity = braking ? 5.8 : headlightsOn ? 1.2 : 0;
      const previous = lightState.current[slot] || (lightState.current[slot] = {});
      if (previous.headlightsOn !== headlightsOn) {
        for (const material of model.headlights) material.emissiveIntensity = headlightsOn ? 3.2 : 0;
        for (const beam of model.beams) beam.intensity = headlightsOn ? HEADLIGHT_LOW_BEAM : 0;
        previous.headlightsOn = headlightsOn;
      }
      if (previous.tailIntensity !== tailIntensity) {
        for (const material of model.taillights) material.emissiveIntensity = tailIntensity;
        previous.tailIntensity = tailIntensity;
      }
    }
  }, -2);

  return (
    <>
      {opponentCars.map((car, slot) => (
        <group
          key={`${car.id}-${slot}`}
          visible={false}
          ref={(node: any) => {
            if (node) groups.current[slot] = node;
          }}
        >
          {models[slot] && (
            <>
              <primitive object={models[slot].scene} dispose={null} />
              <primitive object={models[slot].headlightRig} dispose={null} />
            </>
          )}
        </group>
      ))}
    </>
  );
});
