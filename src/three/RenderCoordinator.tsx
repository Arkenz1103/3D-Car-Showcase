import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { liftTimeline } from "./liftTimeline";
import { sceneMotion } from "./sceneMotion";

export function RenderCoordinator() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const get = useThree((state) => state.get);

  useLayoutEffect(() => {
    const previous = scene.onBeforeRender;
    const previousAutoUpdate = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    sceneMotion.shadowsDirty = true;

    // The reflection camera must not consume a pending shadow update.
    scene.onBeforeRender = function (...args) {
      previous.apply(this, args);
      const mainView = args[2] === camera;
      gl.shadowMap.needsUpdate = mainView && sceneMotion.shadowsDirty;
      if (mainView) sceneMotion.shadowsDirty = false;
    };

    if (import.meta.env.DEV || import.meta.env.MODE === "test") {
      Object.assign(window, { __SHOWROOM__: { getState: get, liftTimeline, sceneMotion } });
    }

    return () => {
      scene.onBeforeRender = previous;
      gl.shadowMap.autoUpdate = previousAutoUpdate;
      gl.shadowMap.needsUpdate = true;
      if (import.meta.env.DEV || import.meta.env.MODE === "test")
        Reflect.deleteProperty(window, "__SHOWROOM__");
    };
  }, [gl, scene, camera, get]);

  return null;
}
