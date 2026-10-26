// Geometry and lighting changes invalidate shadows; HUD and camera updates do not.
export const sceneMotion = { shadowsDirty: true, cameraMoving: false };

export function markShadowsDirty() {
  sceneMotion.shadowsDirty = true;
}
