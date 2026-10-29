// @ts-nocheck
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, BufferGeometry, BoxGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, Object3D, SphereGeometry, MeshStandardMaterial } from "three";
import { cityDrive } from "./cityDrive";
import {
  CITY_BRIDGE_PIERS,
  CITY_BRIDGE_RAILS,
  CITY_BUILDINGS,
  CITY_BUILDING_CROWNS,
  CITY_BUILDING_PODIUMS,
  CITY_FIRE_ESCAPES,
  CITY_HILLS,
  CITY_NEON_CYAN,
  CITY_NEON_WARM,
  CITY_PARKS,
  CITY_ROOF_TANKS,
  CITY_ROOF_UNITS,
  CITY_SIDEWALKS,
  CITY_SKYLINE,
  CITY_JUNCTIONS,
  CITY_LAMPS,
  CITY_MARKINGS,
  CITY_PALM_CROWNS,
  CITY_PALM_TRUNKS,
  CITY_ROADS,
  CITY_TREE_CANOPIES,
  CITY_TREE_TRUNKS,
  CITY_WINDOWS,
  CITY_WINDOWS_WARM,
  CITY_END_Z,
  CITY_START_Z,
} from "./cityLayout";

const transform = new Object3D();
const CITY_LENGTH = CITY_END_Z - CITY_START_Z;
const CITY_CENTER_Z = (CITY_END_Z + CITY_START_Z) / 2;
const CITY_GROUND_START_Z = 10;
const CITY_GROUND_LENGTH = CITY_END_Z + 10 - CITY_GROUND_START_Z;
const CITY_GROUND_CENTER_Z = (CITY_END_Z + 10 + CITY_GROUND_START_Z) / 2;

function createRoadGeometry(paths) {
  const positions = [];
  const indices = [];
  let vertex = 0;
  for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
    const path = paths[pathIndex];
    const halfWidth = path.width / 2;
    const edges = [];
    for (let index = 0; index < path.points.length; index++) {
      const current = path.points[index];
      const previous = path.points[Math.max(0, index - 1)];
      const next = path.points[Math.min(path.points.length - 1, index + 1)];
      let inX = current.x - previous.x;
      let inZ = current.z - previous.z;
      let outX = next.x - current.x;
      let outZ = next.z - current.z;
      const inLength = Math.hypot(inX, inZ) || 1;
      const outLength = Math.hypot(outX, outZ) || 1;
      inX /= inLength; inZ /= inLength;
      outX /= outLength; outZ /= outLength;
      if (index === 0) { inX = outX; inZ = outZ; }
      if (index === path.points.length - 1) { outX = inX; outZ = inZ; }
      const inNX = -inZ;
      const inNZ = inX;
      const outNX = -outZ;
      const outNZ = outX;
      let miterX = inNX + outNX;
      let miterZ = inNZ + outNZ;
      const miterLength = Math.hypot(miterX, miterZ) || 1;
      miterX /= miterLength;
      miterZ /= miterLength;
      const denominator = Math.max(0.48, Math.abs(miterX * outNX + miterZ * outNZ));
      const offset = Math.min(halfWidth / denominator, halfWidth * 2.1);
      edges.push({
        leftX: current.x + miterX * offset,
        leftZ: current.z + miterZ * offset,
        rightX: current.x - miterX * offset,
        rightZ: current.z - miterZ * offset,
        y: current.y + 0.03 + pathIndex * 0.00025,
      });
    }
    const start = vertex;
    for (const edge of edges) {
      positions.push(edge.leftX, edge.y, edge.leftZ, edge.rightX, edge.y, edge.rightZ);
      vertex += 2;
    }
    for (let index = 0; index < edges.length - 1; index++) {
      const a = start + index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Static, R3F-managed instance batches keep the city draw-call count bounded. */
function InstanceField({ items, geometryType = "box", materialColor = "#ffffff", roughness = 0.8, metalness = 0.05, emissive = "#000000", emissiveIntensity = 0, castShadow = false, fog = false }) {
  const mesh = useRef(null);
  const geometry = useMemo(() => {
    if (geometryType === "cylinder") return new CylinderGeometry(0.5, 0.5, 1, 8);
    if (geometryType === "sphere") return new SphereGeometry(1, 14, 10);
    if (geometryType === "cone") return new ConeGeometry(1, 1, 7, 2);
    return new BoxGeometry(1, 1, 1);
  }, [geometryType]);
  const material = useMemo(() => new MeshStandardMaterial({ color: materialColor, roughness, metalness, emissive, emissiveIntensity, fog }), [materialColor, roughness, metalness, emissive, emissiveIntensity, fog]);

  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      transform.position.set(item.x, item.y, item.z);
      transform.rotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
      transform.scale.set(item.sx ?? 1, item.sy ?? 1, item.sz ?? 1);
      transform.updateMatrix();
      target.setMatrixAt(index, transform.matrix);
      if (item.color) target.setColorAt(index, new Color(item.color));
    }
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor) target.instanceColor.needsUpdate = true;
    target.computeBoundingSphere();
  }, [items]);

  useLayoutEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  if (!items.length) return null;
  return <instancedMesh ref={mesh} args={[geometry, material, items.length]} castShadow={castShadow} frustumCulled={false} />;
}

const zebra = Array.from({ length: 13 }, (_, index) => ({
  x: -5.8 + index * 0.96,
  y: 0.065,
  z: 41,
  sx: 0.62,
  sy: 0.018,
  sz: 3.7,
  color: "#d6d5ce",
}));

export function OpenCityWorld({ visible = true, driving = false, onReady = null }) {
  const root = useRef(null);
  const warmed = useRef(false);
  const ambient = useRef(null);
  const hemisphere = useRef(null);
  const sun = useRef(null);
  const { gl, scene, camera, invalidate } = useThree();
  const roadGeometry = useMemo(() => createRoadGeometry(CITY_ROADS), []);

  useEffect(() => () => roadGeometry.dispose(), [roadGeometry]);

  // Outdoor lights stay at zero while the camera is in the garage. They rise
  // only after the car and chase camera have cleared the doorway.
  useFrame(() => {
    const outside = driving && cityDrive.z > 19;
    if (ambient.current) ambient.current.intensity = outside ? 0.72 : 0;
    if (hemisphere.current) hemisphere.current.intensity = outside ? 1.25 : 0;
    if (sun.current) sun.current.intensity = outside ? 3.0 : 0;
  }, -18);

  // The city is visible from the ordinary garage camera before Drive is on;
  // extend its clipping range for that view too, then restore it when shuttered.
  useEffect(() => {
    if (!visible) return;
    const originalFar = camera.far;
    camera.far = Math.max(originalFar, 800);
    camera.updateProjectionMatrix();
    invalidate();
    return () => {
      camera.far = originalFar;
      camera.updateProjectionMatrix();
      invalidate();
    };
  }, [visible, camera, invalidate]);

  // Compile outdoor shaders during the gate lift, not on the first drive frame.
  useEffect(() => {
    if (!visible || !onReady) return;
    let cancelled = false;
    let settled = false;
    const finish = () => {
      if (cancelled || settled) return;
      settled = true;
      window.clearTimeout(watchdog);
      onReady();
      invalidate();
    };
    const watchdog = window.setTimeout(finish, 2400);
    const prepare = async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      if (warmed.current) {
        finish();
        return;
      }
      try {
        if (typeof gl.compileAsync === "function") await gl.compileAsync(scene, camera);
        warmed.current = true;
      } catch {
        // Rendering remains valid if a device declines asynchronous compilation.
      }
      finish();
    };
    void prepare();
    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
    };
  }, [visible, onReady, gl, scene, camera, invalidate]);

  return (
    <group ref={root} name="Open_City_Exterior" visible={visible}>
      {/* The sky is local to the exterior; the garage keeps its own background. */}
      <mesh name="City_Sky_Backdrop" scale={[620, 620, 620]} raycast={() => null} frustumCulled={false} renderOrder={-1000}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color="#9fc5d9" side={BackSide} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      {/* Keep garage lighting unchanged while the shutter is open; outdoor fill
          comes up only after the car and chase camera have cleared the doorway. */}
      <ambientLight ref={ambient} intensity={0} color="#e3f1ff" />
      <hemisphereLight ref={hemisphere} args={["#a9d5f2", "#394536", 0]} />
      <directionalLight ref={sun} position={[-42, 72, -48]} intensity={0} color="#fff1d6" />

      <mesh name="City_Ground" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, CITY_GROUND_CENTER_Z]} raycast={() => null}>
        <planeGeometry args={[470, CITY_GROUND_LENGTH]} />
        <meshStandardMaterial color="#3d5144" roughness={1} fog={false} />
      </mesh>
      <mesh name="City_Ocean" position={[180, -0.54, 285]} raycast={() => null}>
        <boxGeometry args={[160, 1.0, 340]} />
        <meshStandardMaterial color="#368b9d" roughness={0.28} metalness={0.08} fog={false} />
      </mesh>
      <mesh name="Beach_Sand" position={[130, -0.045, 165]} raycast={() => null}>
        <boxGeometry args={[44, 0.12, 100]} />
        <meshStandardMaterial color="#d7c59a" roughness={0.95} fog={false} />
      </mesh>
      <mesh name="City_Road_Network" geometry={roadGeometry} raycast={() => null}>
        <meshStandardMaterial color="#292e32" roughness={0.93} metalness={0.02} side={DoubleSide} fog={false} />
      </mesh>

      {/* Broad asphalt junctions make turns comfortable at every city crossing. */}
      <InstanceField items={CITY_JUNCTIONS} geometryType="cylinder" materialColor="#303538" roughness={0.92} />
      <InstanceField items={CITY_SIDEWALKS} materialColor="#ffffff" roughness={0.93} />
      <InstanceField items={CITY_PARKS} materialColor="#ffffff" roughness={1} />
      <InstanceField items={CITY_SKYLINE} materialColor="#ffffff" roughness={0.78} metalness={0.12} />
      <InstanceField items={CITY_BUILDING_PODIUMS} materialColor="#ffffff" roughness={0.84} metalness={0.08} />
      <InstanceField items={CITY_BUILDINGS} materialColor="#ffffff" roughness={0.74} metalness={0.16} />
      <InstanceField items={CITY_BUILDING_CROWNS} materialColor="#ffffff" roughness={0.68} metalness={0.2} />
      <InstanceField items={CITY_WINDOWS} materialColor="#ffffff" roughness={0.3} metalness={0.28} emissive="#79b8df" emissiveIntensity={0.2} />
      <InstanceField items={CITY_WINDOWS_WARM} materialColor="#fff0d0" roughness={0.32} emissive="#f5b96d" emissiveIntensity={0.25} />
      <InstanceField items={CITY_FIRE_ESCAPES} materialColor="#ffffff" roughness={0.62} metalness={0.72} />
      <InstanceField items={CITY_ROOF_UNITS} materialColor="#ffffff" roughness={0.72} metalness={0.42} />
      <InstanceField items={CITY_ROOF_TANKS} geometryType="cylinder" materialColor="#ffffff" roughness={0.86} />
      <InstanceField items={CITY_NEON_CYAN} materialColor="#ffffff" roughness={0.3} metalness={0.2} emissive="#39e6e5" emissiveIntensity={0.9} />
      <InstanceField items={CITY_NEON_WARM} materialColor="#ffffff" roughness={0.3} metalness={0.16} emissive="#ff4268" emissiveIntensity={0.85} />
      <InstanceField items={CITY_MARKINGS} materialColor="#ffffff" roughness={0.8} />
      <InstanceField items={zebra} materialColor="#ffffff" roughness={0.8} />
      <InstanceField items={CITY_LAMPS} materialColor="#ffffff" roughness={0.45} metalness={0.72} />
      <InstanceField items={CITY_TREE_TRUNKS} geometryType="cylinder" materialColor="#ffffff" roughness={1} />
      <InstanceField items={CITY_TREE_CANOPIES} geometryType="sphere" materialColor="#ffffff" roughness={1} />
      <InstanceField items={CITY_HILLS} geometryType="sphere" materialColor="#ffffff" roughness={1} />
      <InstanceField items={CITY_BRIDGE_PIERS} materialColor="#ffffff" roughness={0.86} />
      <InstanceField items={CITY_BRIDGE_RAILS} materialColor="#ffffff" roughness={0.52} metalness={0.56} />
      <InstanceField items={CITY_PALM_TRUNKS} geometryType="cylinder" materialColor="#ffffff" roughness={1} />
      <InstanceField items={CITY_PALM_CROWNS} geometryType="sphere" materialColor="#ffffff" roughness={1} />

      {/* Boulevard curbs, crosswalk and bridge approach markers. */}
      {[-1, 1].map((side) => (
        <mesh key={`boulevard-curb-${side}`} position={[side * 9.1, 0.065, CITY_CENTER_Z]} raycast={() => null}>
          <boxGeometry args={[0.22, 0.22, CITY_LENGTH]} />
          <meshStandardMaterial color="#d2d0c8" roughness={0.86} fog={false} />
        </mesh>
      ))}
      <mesh position={[0, 0.065, 41]} raycast={() => null}>
        <boxGeometry args={[17.6, 0.018, 0.18]} />
        <meshBasicMaterial color="#eee7d8" fog={false} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={`city-entry-marker-${side}`} position={[side * 15.9, 0, 42]}>
          <mesh position={[0, 1.05, 0]} raycast={() => null}>
            <boxGeometry args={[0.42, 2.1, 0.42]} />
            <meshStandardMaterial color="#424c52" metalness={0.62} roughness={0.42} fog={false} />
          </mesh>
          <mesh position={[0, 2.15, 0]} raycast={() => null}>
            <boxGeometry args={[0.72, 0.22, 0.72]} />
            <meshStandardMaterial color="#d8a84e" emissive="#8f611d" emissiveIntensity={0.45} fog={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
