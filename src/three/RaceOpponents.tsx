// @ts-nocheck
/**
 * The two AI supercars.
 *
 * They are deliberately cheap: a handful of scaled unit boxes and four shared
 * cylinder wheels per car, all reusing the same two geometries and three
 * materials for the whole field. Nothing here is instanced because there are
 * only two of them and each needs its own paint colour — the draw call cost is
 * a dozen triangles-batches, and the part that actually matters (their
 * station-keeping simulation) already runs in `raceAi` inside the engine.
 *
 * Geometry and materials are module level singletons: created once, shared by
 * every mount, and never rebuilt when the player leaves and re-enters race mode.
 */
import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from "three";
import { AI_COUNT, raceAi, raceDrive } from "./raceEngine";
import { markShadowsDirty } from "./sceneMotion";

const unitBox = new BoxGeometry(1, 1, 1);
const wheelGeometry = new CylinderGeometry(0.36, 0.36, 0.3, 12);
// Lay the cylinder on its side so the axle runs along the car's X axis.
wheelGeometry.rotateZ(Math.PI / 2);

/** High contrast paints so the pack reads instantly against the tarmac. */
const PAINTS = ["#FF5A1F", "#B4FF3A"];

const shellMaterials = PAINTS.map(
  (hex) =>
    new MeshStandardMaterial({
      color: hex,
      roughness: 0.33,
      metalness: 0.45,
      envMapIntensity: 1.3,
    }),
);

/** Shared dark glass/mirror finish for both cockpits and both wheelsets. */
const cockpitMaterial = new MeshStandardMaterial({
  color: "#0d1116",
  roughness: 0.15,
  metalness: 0.62,
  envMapIntensity: 1.1,
});
const tyreMaterial = new MeshStandardMaterial({
  color: "#14161a",
  roughness: 0.86,
  metalness: 0.05,
  envMapIntensity: 0.6,
});

const WHEELS = [
  [-0.88, 0.36, -1.5],
  [0.88, 0.36, -1.5],
  [-0.9, 0.36, 1.45],
  [0.9, 0.36, 1.45],
];

export const RaceOpponents = memo(function RaceOpponents() {
  const groups = useRef<any[]>([]);

  useFrame(() => {
    const active = raceDrive.active;
    if (!active) {
      for (let car = 0; car < AI_COUNT; car++) {
        const node = groups.current[car];
        if (node && node.visible) node.visible = false;
      }
      return;
    }
    for (let car = 0; car < AI_COUNT; car++) {
      const node = groups.current[car];
      if (!node) continue;
      node.visible = true;
      node.position.set(raceAi.x[car], raceAi.y[car], raceAi.z[car]);
      // Same convention as the player's rig: local -Z is forward.
      node.rotation.y = raceAi.heading[car];
    }
    markShadowsDirty();
  }, -2);

  return (
    <>
      {Array.from({ length: AI_COUNT }, (_, car) => (
        <group
          key={car}
          visible={false}
          ref={(node: any) => {
            if (node) groups.current[car] = node;
          }}
        >
          {/* Chassis, nose wedge and rear wing share the car's paint. */}
          <mesh
            geometry={unitBox}
            material={shellMaterials[car]}
            position={[0, 0.58, 0]}
            scale={[1.9, 0.5, 4.3]}
            castShadow
          />
          <mesh
            geometry={unitBox}
            material={shellMaterials[car]}
            position={[0, 0.42, -1.9]}
            scale={[1.72, 0.26, 1.4]}
            castShadow
          />
          <mesh
            geometry={unitBox}
            material={cockpitMaterial}
            position={[0, 0.99, 0.34]}
            scale={[1.46, 0.44, 1.95]}
          />
          <mesh
            geometry={unitBox}
            material={shellMaterials[car]}
            position={[0, 1.2, 2.06]}
            scale={[1.78, 0.07, 0.52]}
          />
          {WHEELS.map((position, index) => (
            <mesh
              key={index}
              geometry={wheelGeometry}
              material={tyreMaterial}
              position={position}
              raycast={() => null}
            />
          ))}
        </group>
      ))}
    </>
  );
});
