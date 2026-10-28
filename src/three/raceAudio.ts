// @ts-nocheck
/**
 * Synthesised race audio — no samples, no loading, no network.
 *
 * Everything is built from three primitives created ONCE when the race starts
 * (i.e. inside the "Start Race" user gesture, which is what browser autoplay
 * policies require):
 *
 *   engine  two detuned saw oscillators -> lowpass -> gain
 *   tyres   one looping noise buffer    -> bandpass -> gain
 *   nitro   sweep oscillator + noise    -> gain envelope (retriggerable)
 *
 * Per frame we only ever write `frequency` / `gain` values with
 * `setTargetAtTime`, so the hot path allocates nothing. `disposeAudio()` tears
 * every node down when the race is left — nothing survives the unmount.
 */
import { raceTelemetry } from "./raceEngine";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let engineGain: GainNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let engineOscA: OscillatorNode | null = null;
let engineOscB: OscillatorNode | null = null;
let tyreGain: GainNode | null = null;
let tyreSource: AudioBufferSourceNode | null = null;
let nitroGain: GainNode | null = null;
let nitroOsc: OscillatorNode | null = null;
let nitroNoise: AudioBufferSourceNode | null = null;
let crashGain: GainNode | null = null;
let crashOsc: OscillatorNode | null = null;
let liftSoundNodes: AudioNode[] = [];
let liftSoundTimer: number | null = null;

/** Idle / redline fundamental, in Hz. */
const ENGINE_MIN_HZ = 34;
const ENGINE_SPAN_HZ = 128;
const NITRO_BURST = 0.42;

function makeNoiseBuffer(context: AudioContext) {
  const length = Math.floor(context.sampleRate * 1.2);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    // Brown-ish noise: reads as tyre scrub instead of a hiss.
    last = last * 0.74 + (Math.random() * 2 - 1) * 0.26;
    data[i] = last * 1.8;
  }
  return buffer;
}

function makeAirNoiseBuffer(context: AudioContext) {
  const length = Math.floor(context.sampleRate * 1.1);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.35;
  return buffer;
}

/** Builds the whole graph. Safe to call repeatedly; only the first call wins. */
export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;

  ctx = new Ctor();
  const now = ctx.currentTime;

  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  // ---------------------------------------------------------------- engine
  engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 900;
  engineFilter.Q.value = 1.1;

  engineGain = ctx.createGain();
  engineGain.gain.value = 0;

  engineFilter.connect(engineGain);
  engineGain.connect(master);

  engineOscA = ctx.createOscillator();
  engineOscA.type = "sawtooth";
  engineOscA.frequency.value = ENGINE_MIN_HZ;
  engineOscA.connect(engineFilter);
  engineOscA.start(now);

  // A slightly sharp second voice gives the V12 its rasp.
  engineOscB = ctx.createOscillator();
  engineOscB.type = "square";
  engineOscB.frequency.value = ENGINE_MIN_HZ * 2.02;
  const engineB = ctx.createGain();
  engineB.gain.value = 0.32;
  engineOscB.connect(engineB);
  engineB.connect(engineFilter);
  engineOscB.start(now);

  // ----------------------------------------------------------------- tyres
  const noise = makeNoiseBuffer(ctx);

  const tyreFilter = ctx.createBiquadFilter();
  tyreFilter.type = "bandpass";
  tyreFilter.frequency.value = 1750;
  tyreFilter.Q.value = 5.5;

  tyreGain = ctx.createGain();
  tyreGain.gain.value = 0;
  tyreFilter.connect(tyreGain);
  tyreGain.connect(master);

  tyreSource = ctx.createBufferSource();
  tyreSource.buffer = noise;
  tyreSource.loop = true;
  tyreSource.connect(tyreFilter);
  tyreSource.start(now);

  // ----------------------------------------------------------------- nitro
  nitroGain = ctx.createGain();
  nitroGain.gain.value = 0;
  nitroGain.connect(master);

  nitroOsc = ctx.createOscillator();
  nitroOsc.type = "triangle";
  nitroOsc.frequency.value = 180;
  const nitroOscGain = ctx.createGain();
  nitroOscGain.gain.value = 0.8;
  nitroOsc.connect(nitroOscGain);
  nitroOscGain.connect(nitroGain);
  nitroOsc.start(now);

  nitroNoise = ctx.createBufferSource();
  nitroNoise.buffer = noise;
  nitroNoise.loop = true;
  nitroNoise.connect(nitroGain);
  nitroNoise.start(now);

  // Reused low thud for barrier impacts; the event handler only schedules ramps.
  crashGain = ctx.createGain();
  crashGain.gain.value = 0;
  crashGain.connect(master);
  crashOsc = ctx.createOscillator();
  crashOsc.type = "triangle";
  crashOsc.frequency.value = 72;
  crashOsc.connect(crashGain);
  crashOsc.start(now);

  // A live gesture created the context, so this usually resolves immediately.
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Attempt to resume Web Audio from a trusted user gesture. */
export function unlockAudioFromGesture(): Promise<boolean> {
  const context = initAudio();
  if (!context) return Promise.resolve(false);
  const resume = context.state === "running" ? Promise.resolve() : context.resume();
  return resume.then(() => context.state === "running").catch(() => false);
}

/**
 * Futuristic lift sound: a soft servo beneath a pronounced compressed-air hiss
 * on ascent, with a slower mechanical whirr for the showcase turn.
 */
export function playLiftServoSound(duration = 3.8, style: "align" | "ascend" | "showcase" = "align") {
  // Do not create/resume audio from the animation loop; browsers require a
  // user gesture. Drive, Race, or Replay Entrance initializes the context.
  if (!ctx || ctx.state !== "running" || typeof window === "undefined") return false;
  stopLiftServoSound();

  const context = ctx;
  const now = context.currentTime;
  const length = Math.max(0.7, duration);
  const end = now + length;
  const showcase = style === "showcase";
  const ascent = style === "ascend";
  const peak = showcase ? 0.038 : 0.09;
  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(peak, now + Math.min(0.35, length * 0.08));
  output.gain.setValueAtTime(peak * 0.72, Math.max(now + 0.4, end - 0.42));
  output.gain.exponentialRampToValueAtTime(0.0001, end);
  output.connect(context.destination);

  const motorFilter = context.createBiquadFilter();
  motorFilter.type = "lowpass";
  motorFilter.frequency.setValueAtTime(ascent ? 145 : showcase ? 250 : 320, now);
  motorFilter.frequency.linearRampToValueAtTime(ascent ? 360 : showcase ? 390 : 720, now + length * 0.48);
  motorFilter.frequency.exponentialRampToValueAtTime(ascent ? 125 : 240, end);
  motorFilter.Q.value = 0.7;
  const motorGain = context.createGain();
  motorGain.gain.value = ascent ? 0.14 : showcase ? 0.48 : 0.34;
  motorFilter.connect(motorGain);
  motorGain.connect(output);

  const motor = context.createOscillator();
  motor.type = "sawtooth";
  motor.frequency.setValueAtTime(ascent ? 26 : showcase ? 56 : 48, now);
  motor.frequency.exponentialRampToValueAtTime(ascent ? 52 : showcase ? 74 : 96, now + length * 0.42);
  motor.frequency.exponentialRampToValueAtTime(ascent ? 30 : showcase ? 52 : 58, end);
  motor.connect(motorFilter);
  motor.start(now);
  motor.stop(end + 0.04);

  const servo = context.createOscillator();
  servo.type = "triangle";
  servo.frequency.setValueAtTime(ascent ? 72 : showcase ? 132 : 168, now);
  servo.frequency.exponentialRampToValueAtTime(ascent ? 128 : showcase ? 174 : 286, now + length * 0.38);
  servo.frequency.exponentialRampToValueAtTime(ascent ? 62 : showcase ? 116 : 122, end);
  const servoGain = context.createGain();
  servoGain.gain.value = ascent ? 0.08 : showcase ? 0.1 : 0.16;
  servo.connect(servoGain);
  servoGain.connect(output);
  servo.start(now);
  servo.stop(end + 0.04);

  const hissFilter = context.createBiquadFilter();
  hissFilter.type = "bandpass";
  hissFilter.frequency.setValueAtTime(ascent ? 680 : 760, now);
  hissFilter.frequency.linearRampToValueAtTime(ascent ? 2050 : 1420, now + length * 0.55);
  hissFilter.Q.value = ascent ? 0.45 : 0.65;
  const hissPeak = showcase ? 0.028 : ascent ? 0.5 : 0.15;
  const hissGain = context.createGain();
  hissGain.gain.setValueAtTime(0.0001, now);
  hissGain.gain.exponentialRampToValueAtTime(hissPeak, now + Math.min(0.4, length * 0.1));
  hissGain.gain.setValueAtTime(hissPeak * 0.5, Math.max(now + 0.45, end - 0.38));
  hissGain.gain.exponentialRampToValueAtTime(0.0001, end);
  hissFilter.connect(hissGain);
  hissGain.connect(output);

  const hiss = context.createBufferSource();
  hiss.buffer = ascent ? makeAirNoiseBuffer(context) : makeNoiseBuffer(context);
  hiss.loop = true;
  hiss.connect(hissFilter);
  hiss.start(now);
  hiss.stop(end + 0.04);

  liftSoundNodes = [output, motorFilter, motorGain, motor, servo, servoGain, hissFilter, hissGain, hiss];
  liftSoundTimer = window.setTimeout(stopLiftServoSound, (length + 0.25) * 1000);
  return true;
}

export function stopLiftServoSound() {
  if (liftSoundTimer !== null && typeof window !== "undefined") window.clearTimeout(liftSoundTimer);
  liftSoundTimer = null;
  for (const node of liftSoundNodes) {
    try {
      (node as any).stop?.();
    } catch {
      // A scheduled source may already have finished.
    }
    try {
      node.disconnect();
    } catch {
      // Already detached.
    }
  }
  liftSoundNodes = [];
}

/** Re-arms the context after a tab switch or the browser's autoplay policy. */
export function resumeAudio() {
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

export function isAudioReady() {
  return !!ctx;
}

/**
 * One frame of audio. `active` is false while paused / back in the showroom, in
 * which case the master is ramped to silence without stopping the oscillators.
 */
export function updateAudio(delta: number, active: boolean) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const ramp = Math.min(Math.max(delta, 0.008), 0.05);

  if (!active) {
    master.gain.setTargetAtTime(0, now, 0.08);
    return;
  }

  const rpmNorm = Math.min(1, Math.max(0, (raceTelemetry.rpm - 800) / 8000));
  const speedNorm = Math.min(1, raceTelemetry.speedKph / 260);

  master.gain.setTargetAtTime(0.85, now, 0.12);

  const fundamental = ENGINE_MIN_HZ + rpmNorm * ENGINE_SPAN_HZ;
  engineOscA.frequency.setTargetAtTime(fundamental, now, ramp);
  engineOscB.frequency.setTargetAtTime(fundamental * 2.02, now, ramp);
  engineFilter.frequency.setTargetAtTime(520 + rpmNorm * 3400, now, ramp);
  engineGain.gain.setTargetAtTime(
    0.05 + rpmNorm * 0.075 + (raceTelemetry.nitroActive ? 0.03 : 0),
    now,
    ramp,
  );

  // Tyre squeal: lateral slip, or a locked rear under the handbrake.
  const scrub = Math.min(1, raceTelemetry.drift * 0.09) + (raceTelemetry.handbraking ? 0.4 : 0);
  const squeal = Math.min(1, scrub) * Math.min(1, speedNorm * 1.8);
  tyreGain.gain.setTargetAtTime(squeal * 0.16, now, 0.05);
}

/** Short pitch-shifted burst — fired on the Shift edge, not per frame. */
export function triggerTurboBurst() {
  if (!ctx || !nitroGain || !nitroOsc) return;
  const now = ctx.currentTime;
  nitroGain.gain.cancelScheduledValues(now);
  nitroGain.gain.setValueAtTime(0.0001, now);
  nitroGain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
  nitroGain.gain.exponentialRampToValueAtTime(0.0001, now + NITRO_BURST);

  nitroOsc.frequency.cancelScheduledValues(now);
  nitroOsc.frequency.setValueAtTime(1250, now);
  nitroOsc.frequency.exponentialRampToValueAtTime(170, now + NITRO_BURST);
}

/** Heavy, short impact thunk triggered only on a debounced barrier collision. */
export function triggerCrashImpact(strength: number) {
  if (!ctx || !crashGain || !crashOsc) return;
  const now = ctx.currentTime;
  const peak = 0.08 + Math.max(0, Math.min(1, strength)) * 0.34;
  crashGain.gain.cancelScheduledValues(now);
  crashGain.gain.setValueAtTime(0.0001, now);
  crashGain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
  crashGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
  crashOsc.frequency.cancelScheduledValues(now);
  crashOsc.frequency.setValueAtTime(142, now);
  crashOsc.frequency.exponentialRampToValueAtTime(42, now + 0.24);
}

/** Tears the graph down — called when the race mode unmounts. */
export function disposeAudio() {
  stopLiftServoSound();
  const stop = (node: any) => {
    try {
      node?.stop?.();
    } catch {
      // Already stopped.
    }
    try {
      node?.disconnect?.();
    } catch {
      // Already detached.
    }
  };
  stop(engineOscA);
  stop(engineOscB);
  stop(tyreSource);
  stop(nitroOsc);
  stop(nitroNoise);
  stop(crashOsc);
  for (const node of [engineGain, engineFilter, tyreGain, nitroGain, crashGain, master]) {
    try {
      node?.disconnect?.();
    } catch {
      // Already detached.
    }
  }
  engineOscA = engineOscB = null;
  engineGain = engineFilter = null;
  tyreSource = tyreGain = null;
  nitroOsc = nitroGain = nitroNoise = null;
  crashOsc = crashGain = null;
  master = null;
  const context = ctx;
  ctx = null;
  context?.close?.().catch?.(() => {});
}
