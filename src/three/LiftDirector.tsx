import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { liftTimeline } from "./liftTimeline";
import { markShadowsDirty } from "./sceneMotion";

interface LiftDirectorProps {
  /** Incremented every time a vehicle asset finishes loading → replays the entrance. */
  entranceSeq: number;
  /** Called once the elevator has slowly aligned the car with the garage exit. */
  onDriveAlignmentComplete?: () => void;
}

export function LiftDirector({ entranceSeq, onDriveAlignmentComplete }: LiftDirectorProps) {
  const invalidate = useThree((s) => s.invalidate);
  const resumed = useRef(false);

  useLayoutEffect(() => {
    if (entranceSeq > 0) {
      liftTimeline.begin(entranceSeq);
      markShadowsDirty();
      invalidate();
    }
  }, [entranceSeq, invalidate]);

  useEffect(() => {
    const onVisibility = () => {
      if (!document.hidden) {
        resumed.current = true;
        invalidate();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [invalidate]);

  // Update before all scene consumers. Resolution stays fixed throughout motion.
  useFrame((_, delta) => {
    if (document.hidden) return;
    const wasMoving = liftTimeline.animating;
    const wasDriveAligning = liftTimeline.phase === "drive-align";
    const moving = liftTimeline.step(resumed.current ? 0 : delta);
    if (wasDriveAligning && liftTimeline.phase === "done") onDriveAlignmentComplete?.();
    resumed.current = false;
    if (wasMoving) markShadowsDirty();
    if (moving) invalidate();
  }, -20);

  return null;
}
