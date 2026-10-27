const BRAKE_LAMP_PARTS = /taillight|rear_lamp|lamp_rear|rear_light|brake_ring/i;
const NON_BRAKE_LIGHT_PARTS = /steering_shift_led|manettino|lamp_rear_housing/i;

/** Match only physical rear-lamp surfaces, not similarly named cockpit LEDs or lamp housings. */
export function isBrakeLightSurface(meshName: string, materialName: string): boolean {
  const label = `${meshName} ${materialName}`;
  return BRAKE_LAMP_PARTS.test(label) && !NON_BRAKE_LIGHT_PARTS.test(label);
}
