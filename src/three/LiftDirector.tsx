import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useRef } from "react";
import { liftTimeline } from "./liftTimeline";
import { markShadowsDirty } from "./sceneMotion";

interface LiftDirectorProps {
  /** Incremented every time a vehicle asset finishes loading → replays the entrance. */
  entranceSeq: number;
}

export function LiftDirector({ entranceSeq }: LiftDirectorProps) {
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
    const moving = liftTimeline.step(resumed.current ? 0 : delta);
    resumed.current = false;
    if (wasMoving) markShadowsDirty();
    if (moving) invalidate();
  }, -20);

  return null;
}
