import { MathUtils, Vector3 } from "three";

export type Point3 = [number, number, number];

export interface CameraGoal {
  position: Point3;
  target: Point3;
  fov: number;
  interior?: boolean;
  overview?: boolean;
  seq?: number;
}

const UP = new Vector3(0, 1, 0);

export function orientCameraGoal(goal: CameraGoal, yaw = 0): CameraGoal {
  return {
    ...goal,
    position: new Vector3(...goal.position).applyAxisAngle(UP, yaw).toArray() as Point3,
    target: new Vector3(...goal.target).applyAxisAngle(UP, yaw).toArray() as Point3,
  };
}

export function responsiveCameraGoal(goal: CameraGoal, aspect: number): CameraGoal {
  if (goal.interior || !goal.overview) return goal;
  const target = new Vector3(...goal.target);
  // Preserve horizontal framing on narrow screens without changing desktop views.
  const scale = MathUtils.clamp(1.35 / Math.max(aspect, 0.3), 1, 2.8);
  if (scale === 1) return goal;
  const position = new Vector3(...goal.position).sub(target).multiplyScalar(scale).add(target);
  return { ...goal, position: position.toArray() as Point3 };
}
