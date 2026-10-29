// @ts-nocheck
import React from "react";
import { Html } from "@react-three/drei";
import { CARS } from "@/data/catalog";
import { loadVehicleAsset } from "@/lib/gltf";

const DISPLAY_X = [-7.15, 7.15];

/**
 * Static side-bay cars make the garage feel like a small collection rather than
 * a single-car studio. Bundled GLBs are warmed one at a time during idle time;
 * loadVehicleAsset shares parsed geometry/textures with the active vehicle, so
 * selecting a display car later avoids another GLB decode.
 */
export function GarageCarDisplays({ activeCarId, onSelectCar }) {
  const [assets, setAssets] = React.useState({});

  React.useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let idleId = 0;
    let index = 0;

    const loadNext = async () => {
      if (cancelled || index >= CARS.length) return;
      const car = CARS[index++];
      try {
        const asset = await loadVehicleAsset(null, null, car);
        if (!cancelled) setAssets((previous) => ({ ...previous, [car.id]: asset }));
      } catch {
        // The main garage car remains usable if a side-display model fails.
      }
      if (!cancelled && index < CARS.length) scheduleNext();
    };

    const scheduleNext = () => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(loadNext, { timeout: 1800 });
      } else {
        timer = window.setTimeout(loadNext, 900);
      }
    };

    timer = window.setTimeout(scheduleNext, 850);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleId && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
  }, []);

  const displayCars = CARS.filter((car) => car.id !== activeCarId && assets[car.id]);

  return (
    <group name="Garage_Supercar_Display_Bays">
      {displayCars.map((car, index) => {
        const x = DISPLAY_X[index % DISPLAY_X.length];
        const scene = assets[car.id].gltf.scene;
        return (
          <group key={car.id} position={[x, 0, 0]}>
            <mesh position={[0, 0.035, 0]} raycast={() => null} receiveShadow={false}>
              <boxGeometry args={[3.55, 0.07, 6.45]} />
              <meshStandardMaterial color="#17191e" metalness={0.42} roughness={0.48} />
            </mesh>
            <mesh position={[0, 0.073, 0]} raycast={() => null}>
              <boxGeometry args={[3.4, 0.012, 6.3]} />
              <meshStandardMaterial color="#24272c" metalness={0.34} roughness={0.54} />
            </mesh>
            {[-1, 1].map((side) => (
              <mesh key={`side-edge-${side}`} position={[side * 1.69, 0.082, 0]} raycast={() => null}>
                <boxGeometry args={[0.035, 0.008, 6.3]} />
                <meshBasicMaterial color="#b6952f" toneMapped={false} />
              </mesh>
            ))}
            {[-1, 1].map((side) => (
              <mesh key={`end-edge-${side}`} position={[0, 0.082, side * 3.13]} raycast={() => null}>
                <boxGeometry args={[3.4, 0.008, 0.035]} />
                <meshBasicMaterial color="#b6952f" toneMapped={false} />
              </mesh>
            ))}

            <group
              position={[0, 0.09, 0]}
              onClick={(event) => {
                event.stopPropagation();
                onSelectCar?.(car.id);
              }}
              onPointerOver={() => { document.body.style.cursor = "pointer"; }}
              onPointerOut={() => { document.body.style.cursor = "auto"; }}
            >
              <primitive object={scene} dispose={null} />
            </group>
            <Html position={[0, 0.2, 3.3]} center distanceFactor={5} zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}>
              <div className="whitespace-nowrap rounded-md border border-[#b6952f]/45 bg-black/75 px-2 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-white/85 backdrop-blur-sm">
                {car.brand} · {car.shortTitle}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
