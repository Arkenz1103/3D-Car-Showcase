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
let engineStartNodes: AudioNode[] = [];
let engineStartTimer: number | null = null;
let lastCountdownTone: { value: number; at: number } | null = null;

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

/**
 * Schedules a short synth voice on the shared, already-unlocked context.
 * One-shot oscillator and gain nodes disconnect as soon as their note ends.
 */
function scheduleSynthVoice(
  frequency: number,
  endFrequency: number,
  duration: number,
  peak: number,
  wave: OscillatorType,
  at: number,
) {
  if (!ctx || !master || ctx.state === "closed") return;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration * 0.92);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.008, duration * 0.08));
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope);
  envelope.connect(master);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(at);
  oscillator.stop(at + duration + 0.02);
}

/** Per-second standing-start beep, triggered alongside the red/yellow/green lamp pulse. */
export function playRaceCountdownTone(value: number) {
  if (!ctx || !master || value < 1 || value > 5) return;
  // React StrictMode replays mount effects in development; don't double the
  // initial T-5 tone when that replay re-emits the same countdown event.
  const wallNow = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (lastCountdownTone?.value === value && wallNow - lastCountdownTone.at < 120) return;
  lastCountdownTone = { value, at: wallNow };
  const frequency = value >= 3 ? 440 : value === 2 ? 660 : 880;
  const now = ctx.currentTime;
  master.gain.setTargetAtTime(0.82, now, 0.03);
  scheduleSynthVoice(frequency, frequency, 0.1, 0.14, "sine", now);
}

/** Bright high-pitch sweep played at T-0 as GO releases the grid. */
export function playRaceGoChime() {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.setTargetAtTime(0.82, now, 0.03);
  scheduleSynthVoice(1200, 1760, 0.3, 0.15, "sine", now);
  scheduleSynthVoice(2400, 3520, 0.26, 0.035, "sine", now + 0.008);
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

/** Synthesized starter crank, engine catch, and brief ignition flare. */
export function playEngineStartSound() {
  if (!ctx || ctx.state !== "running" || !master || typeof window === "undefined") return false;
  stopEngineStartSound();

  const context = ctx;
  const now = context.currentTime;
  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.setValueAtTime(0.0001, now + 0.035);
  output.gain.exponentialRampToValueAtTime(0.52, now + 0.12);
  output.gain.setValueAtTime(0.42, now + 0.72);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 1.42);
  output.connect(master);

  const starterFilter = context.createBiquadFilter();
  starterFilter.type = "lowpass";
  starterFilter.frequency.setValueAtTime(280, now);
  starterFilter.frequency.linearRampToValueAtTime(520, now + 0.45);
  starterFilter.Q.value = 1.6;
  const starterGain = context.createGain();
  starterGain.gain.setValueAtTime(0.0001, now);
  starterGain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
  starterGain.gain.setValueAtTime(0.11, now + 0.14);
  starterGain.gain.setValueAtTime(0.18, now + 0.25);
  starterGain.gain.setValueAtTime(0.1, now + 0.34);
  starterGain.gain.setValueAtTime(0.15, now + 0.46);
  starterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.63);
  starterFilter.connect(starterGain);
  starterGain.connect(output);

  const starter = context.createOscillator();
  starter.type = "sawtooth";
  starter.frequency.setValueAtTime(48, now);
  starter.frequency.linearRampToValueAtTime(39, now + 0.22);
  starter.frequency.linearRampToValueAtTime(55, now + 0.5);
  starter.connect(starterFilter);
  starter.start(now);
  starter.stop(now + 0.66);

  const engineFilter = context.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.setValueAtTime(520, now + 0.42);
  engineFilter.frequency.linearRampToValueAtTime(2100, now + 0.76);
  engineFilter.frequency.exponentialRampToValueAtTime(780, now + 1.38);
  engineFilter.Q.value = 1.15;
  const engineGain = context.createGain();
  engineGain.gain.setValueAtTime(0.0001, now);
  engineGain.gain.setValueAtTime(0.0001, now + 0.42);
  engineGain.gain.exponentialRampToValueAtTime(0.3, now + 0.7);
  engineGain.gain.setValueAtTime(0.2, now + 0.88);
  engineGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  engineFilter.connect(engineGain);
  engineGain.connect(output);

  const catchFire = context.createOscillator();
  catchFire.type = "sawtooth";
  catchFire.frequency.setValueAtTime(31, now + 0.42);
  catchFire.frequency.exponentialRampToValueAtTime(104, now + 0.74);
  catchFire.frequency.exponentialRampToValueAtTime(44, now + 1.38);
  catchFire.connect(engineFilter);
  catchFire.start(now + 0.42);
  catchFire.stop(now + 1.44);

  const catchNoiseFilter = context.createBiquadFilter();
  catchNoiseFilter.type = "bandpass";
  catchNoiseFilter.frequency.setValueAtTime(460, now + 0.42);
  catchNoiseFilter.frequency.exponentialRampToValueAtTime(1320, now + 0.78);
  catchNoiseFilter.Q.value = 0.8;
  const catchNoiseGain = context.createGain();
  catchNoiseGain.gain.setValueAtTime(0.0001, now);
  catchNoiseGain.gain.setValueAtTime(0.0001, now + 0.44);
  catchNoiseGain.gain.exponentialRampToValueAtTime(0.045, now + 0.68);
  catchNoiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.12);
  catchNoiseFilter.connect(catchNoiseGain);
  catchNoiseGain.connect(output);

  const catchNoise = context.createBufferSource();
  catchNoise.buffer = makeAirNoiseBuffer(context);
  catchNoise.connect(catchNoiseFilter);
  catchNoise.start(now + 0.43);
  catchNoise.stop(now + 1.16);

  engineStartNodes = [output, starterFilter, starterGain, starter, engineFilter, engineGain, catchFire, catchNoiseFilter, catchNoiseGain, catchNoise];
  engineStartTimer = window.setTimeout(stopEngineStartSound, 1650);
  return true;
}

export function stopEngineStartSound() {
  if (engineStartTimer !== null && typeof window !== "undefined") window.clearTimeout(engineStartTimer);
  engineStartTimer = null;
  for (const node of engineStartNodes) {
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
  engineStartNodes = [];
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
  stopEngineStartSound();
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
