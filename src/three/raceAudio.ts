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
let garageMusicNodes: AudioNode[] = [];
let garageMusicBus: GainNode | null = null;
let garageMusicTimer: number | null = null;
let garageMusicCleanupTimer: number | null = null;
let garageMusicPlaying = false;

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

/** Original sample-free showroom loop: mellow keys, warm bass, and a laid-back sports-game beat. */
export function startGarageTheme() {
  if (!ctx || ctx.state !== "running" || typeof window === "undefined") return false;
  if (garageMusicPlaying && garageMusicBus) return true;
  if (garageMusicCleanupTimer !== null) {
    window.clearTimeout(garageMusicCleanupTimer);
    garageMusicCleanupTimer = null;
    clearGarageMusicNodes();
  }

  const context = ctx;
  const now = context.currentTime;
  const bus = context.createGain();
  bus.gain.setValueAtTime(0.0001, now);
  bus.gain.exponentialRampToValueAtTime(0.34, now + 1.4);
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.012;
  compressor.release.value = 0.22;
  bus.connect(compressor);
  compressor.connect(context.destination);

  const delay = context.createDelay(1);
  delay.delayTime.value = 0.31;
  const delayFeedback = context.createGain();
  delayFeedback.gain.value = 0.17;
  const delayFilter = context.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 2600;
  delay.connect(delayFilter);
  delayFilter.connect(bus);
  delay.connect(delayFeedback);
  delayFeedback.connect(delay);

  garageMusicBus = bus;
  garageMusicNodes = [bus, compressor, delay, delayFeedback, delayFilter];
  garageMusicPlaying = true;

  const trackNodes = (nodes: AudioNode[], source: AudioScheduledSourceNode) => {
    garageMusicNodes.push(...nodes);
    source.addEventListener("ended", () => {
      for (const node of nodes) {
        try { node.disconnect(); } catch { /* Already detached. */ }
        const index = garageMusicNodes.indexOf(node);
        if (index >= 0) garageMusicNodes.splice(index, 1);
      }
    }, { once: true });
  };
  const midiHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
  const note = (frequency: number, at: number, duration: number, level: number, wave: OscillatorType, echo = false, cutoff = 2200) => {
    const oscillator = context.createOscillator();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, at);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, at);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + Math.min(0.035, duration * 0.18));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    if (echo) envelope.connect(delay);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.025);
    trackNodes([oscillator, filter, envelope], oscillator);
  };
  const noiseHit = (at: number, duration: number, level: number, highpass: number, bandpass = false) => {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = bandpass ? "bandpass" : "highpass";
    filter.frequency.setValueAtTime(highpass, at);
    filter.Q.value = bandpass ? 0.8 : 0.35;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(level, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(bus);
    source.start(at);
    source.stop(at + duration + 0.02);
    trackNodes([source, filter, envelope], source);
  };
  const kick = (at: number) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(118, at);
    oscillator.frequency.exponentialRampToValueAtTime(45, at + 0.14);
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.48, at + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(at);
    oscillator.stop(at + 0.24);
    trackNodes([oscillator, envelope], oscillator);
  };

  const bpm = 92;
  const eighth = 60 / bpm / 2;
  const barDuration = eighth * 8;
  const chordNotes = [
    [50, 53, 57, 60, 64], // Dm9
    [46, 50, 53, 57],     // Bbmaj7
    [41, 45, 48, 52],     // Fmaj7
    [48, 52, 55, 62],     // Cadd9
  ];
  const bassRoots = [38, 34, 29, 36];
  const melody = [0, -1, 2, -1, 3, -1, 2, -1, 0, -1, 2, 4, -1, 3, 2, -1, 0, -1, 2, -1, 4, -1, 5, -1, 3, -1, 2, 0, -1, 2, 3, 5];
  const melodyNotes = [62, 65, 67, 69, 72, 74];
  const noise = makeAirNoiseBuffer(context);
  let nextStepTime = now + 0.06;
  let stepNumber = 0;
  const scheduleAhead = () => {
    if (!garageMusicPlaying || !ctx || ctx !== context || context.state !== "running") return;
    const horizon = context.currentTime + 0.12;
    while (nextStepTime < horizon) {
      const stepInLoop = stepNumber % 32;
      const bar = Math.floor(stepInLoop / 8);
      const stepInBar = stepInLoop % 8;
      const beat = Math.floor(stepInBar / 2);
      const at = nextStepTime;
      if (stepInBar === 0 || stepInBar === 4 || (stepInBar === 7 && bar % 2 === 1)) kick(at);
      if (stepInBar === 2 || stepInBar === 6) noiseHit(at, 0.16, 0.105, 1550, true);
      if (stepInBar % 2 === 1) noiseHit(at, 0.045, stepInBar === 7 ? 0.025 : 0.04, 7200);
      if (stepInBar === 0) {
        for (const midi of chordNotes[bar]) note(midiHz(midi), at, barDuration * 0.94, 0.018, "triangle", false, 1500);
      }
      if (stepInBar === 0 || stepInBar === 4) {
        const bassMidi = bassRoots[bar] + (beat === 2 ? 7 : 0);
        note(midiHz(bassMidi), at, 0.34, 0.16, "sine", false, 250);
      }
      const melodyIndex = melody[stepInLoop];
      if (melodyIndex >= 0) note(midiHz(melodyNotes[melodyIndex]), at, 0.23, 0.055, "sine", true, 1900);
      stepNumber++;
      nextStepTime += eighth;
    }
  };
  // Prime the first beat immediately; the look-ahead keeps later steps gap-free.
  scheduleAhead();
  garageMusicTimer = window.setInterval(scheduleAhead, 25);
  return true;
}

function clearGarageMusicNodes() {
  const nodes = [...garageMusicNodes];
  garageMusicNodes = [];
  garageMusicBus = null;
  for (const node of nodes) {
    try { (node as any).stop?.(); } catch { /* Already stopped. */ }
    try { node.disconnect(); } catch { /* Already detached. */ }
  }
}

export function stopGarageTheme() {
  if (garageMusicTimer !== null && typeof window !== "undefined") window.clearInterval(garageMusicTimer);
  garageMusicTimer = null;
  garageMusicPlaying = false;
  const bus = garageMusicBus;
  if (bus && ctx && ctx.state === "running") {
    try {
      const now = ctx.currentTime;
      bus.gain.cancelScheduledValues(now);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), now);
      bus.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    } catch { /* Context may be shutting down. */ }
  }
  if (garageMusicCleanupTimer !== null && typeof window !== "undefined") window.clearTimeout(garageMusicCleanupTimer);
  if (typeof window !== "undefined") {
    garageMusicCleanupTimer = window.setTimeout(() => {
      garageMusicCleanupTimer = null;
      clearGarageMusicNodes();
    }, 220);
  } else clearGarageMusicNodes();
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
  stopGarageTheme();
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
