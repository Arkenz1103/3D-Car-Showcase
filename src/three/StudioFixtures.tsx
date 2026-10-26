import { memo, useLayoutEffect, useRef } from "react";
import { InstancedMesh, Matrix4 } from "three";

export const DrainSlats = memo(function DrainSlats() {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const matrix = new Matrix4();
    for (let i = 0; i < 22; i++) {
      matrix.makeTranslation(-2.18 + i * 0.208, 0.004, 0);
      mesh.current.setMatrixAt(i, matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, []);

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 22]} raycast={() => null}>
      <boxGeometry args={[0.05, 0.012, 0.24]} />
      <meshStandardMaterial color="#565d66" metalness={0.9} roughness={0.32} />
    </instancedMesh>
  );
});

interface CeilingFixturesProps {
  positions: [number, number, number][];
  color: string;
}

// Identical fixtures share geometry and material without losing any detail.
export const CeilingFixtures = memo(function CeilingFixtures({ positions, color }: CeilingFixturesProps) {
  const lamps = useRef<InstancedMesh>(null);
  const cases = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!lamps.current || !cases.current) return;
    const matrix = new Matrix4();
    positions.forEach(([x, y, z], index) => {
      matrix.makeRotationX(Math.PI / 2).setPosition(x, y, z);
      lamps.current!.setMatrixAt(index, matrix);
      matrix.makeTranslation(x, y + 0.02, z);
      cases.current!.setMatrixAt(index, matrix);
    });
    lamps.current.instanceMatrix.needsUpdate = true;
    cases.current.instanceMatrix.needsUpdate = true;
    lamps.current.computeBoundingSphere();
    cases.current.computeBoundingSphere();
  }, [positions]);

  return (
    <>
      <instancedMesh ref={lamps} args={[undefined, undefined, positions.length]} raycast={() => null}>
        <planeGeometry args={[1, 2.6]} />
        <meshBasicMaterial color={color} />
      </instancedMesh>
      <instancedMesh ref={cases} args={[undefined, undefined, positions.length]} raycast={() => null}>
        <boxGeometry args={[1.12, 0.06, 2.72]} />
        <meshStandardMaterial color="#1a1c22" metalness={0.7} roughness={0.35} />
      </instancedMesh>
    </>
  );
});
