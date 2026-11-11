/**
 * Workout alerts (rest over, goal time reached): a buzz where the phone supports it, and a
 * short beep made in the browser, for phones that cannot vibrate (every iPhone browser).
 *
 * Sound is a per-device choice kept in plain localStorage, like the theme. It starts on
 * only where vibration is missing, so Android keeps its silent buzz unless asked.
 * Browsers only allow sound after a tap, so workout mode calls unlockSound() from ▶.
 */
export const SOUND_KEY = 'gymx:sounds';

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function canVibrate(): boolean {
  return typeof globalThis.navigator?.vibrate === 'function';
}

export function getSounds(): boolean {
  try {
    const v = storage()?.getItem(SOUND_KEY);
    if (v === 'on') return true;
    if (v === 'off') return false;
  } catch {
    /* storage blocked: use the default */
  }
  return !canVibrate();
}

export function setSounds(on: boolean): void {
  try {
    storage()?.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
  override = on;
}

/** The choice made this visit, in case storage is blocked. */
let override: boolean | null = null;
const soundsOn = () => override ?? getSounds();

type AudioCtor = typeof AudioContext;
let audio: AudioContext | null = null;
/** Until when (ms, Date.now) a quiet tone is already keeping the audio output awake. */
let awakeUntil = 0;

/**
 * Prepares sound; call from a tap (any tap in workout mode). Safe to call often. Phones pause
 * a page's sound when the output changes (earphones connected, music started), and only a
 * tap is sure to restart it, so every tap is a chance to.
 */
export function unlockSound(): void {
  if (soundsOn()) openAudio();
}

/** Creates (or restarts) the shared audio output. Only works after the user has tapped. */
function openAudio(): void {
  try {
    // Mix with the user's music instead of pausing it, and follow the silent switch (Safari).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session && session.type !== 'ambient') session.type = 'ambient';
    const Ctor = (globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext) as AudioCtor | undefined;
    if (!Ctor) return;
    if (audio?.state === 'closed') audio = null;
    audio ??= new Ctor();
    void resume();
  } catch {
    audio = null;
  }
}

/** Restarts paused sound ('suspended', or Safari's 'interrupted'); resolves once it runs. */
function resume(): Promise<boolean> {
  if (!audio) return Promise.resolve(false);
  if (audio.state === 'running') return Promise.resolve(true);
  try {
    return audio.resume().then(() => audio?.state === 'running', () => false);
  } catch {
    return Promise.resolve(false);
  }
}

/** Runs `play` now if sound is running, or after restarting it if it was paused. */
function whenRunning(play: (ctx: AudioContext) => void): void {
  if (!audio) return;
  const run = () => {
    try {
      if (audio?.state === 'running') play(audio);
    } catch {
      /* no sound this time */
    }
  };
  if (audio.state === 'running') run();
  else void resume().then((ok) => ok && run());
}

/** A tone from `start` (audio clock) lasting `length` seconds, at `level` (0–1). */
function tone(ctx: AudioContext, freq: number, start: number, length: number, level: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(level, start + Math.min(0.02, length / 4));
  gain.gain.setValueAtTime(level, Math.max(start + 0.02, start + length - 0.02));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.01);
}

/** Two soft rising tones, about a third of a second. */
function beep(): void {
  whenRunning((ctx) => {
    const t0 = ctx.currentTime;
    tone(ctx, 880, t0, 0.14, 0.3);
    tone(ctx, 1175, t0 + 0.16, 0.14, 0.3);
  });
}

/**
 * Bluetooth earphones switch their link off after a few seconds of silence and need up to a
 * second to wake, which swallows a short beep. Call this just before a known alert: it plays
 * a tone far too quiet to hear, for `ms`, so the link is awake when the beep comes.
 */
export function keepSoundAwake(ms = 2500): void {
  if (!soundsOn() || !audio) return;
  const now = Date.now();
  if (awakeUntil > now + 500) return; // already awake long enough
  awakeUntil = now + ms;
  whenRunning((ctx) => tone(ctx, 220, ctx.currentTime, ms / 1000, 0.001));
}

/** Plays the beep once when sound is switched on (call from a tap), after waking earphones. */
export function previewSound(): void {
  unlockSound();
  keepSoundAwake();
  setTimeout(beep, PREVIEW_DELAY_MS);
}
const PREVIEW_DELAY_MS = 1000;

/** Buzzes (where supported) and beeps (if sound is on). */
export function alertUser(pattern: number | number[] = 200): void {
  try {
    if (canVibrate()) navigator.vibrate(pattern);
  } catch {
    /* some browsers throw without a recent tap */
  }
  if (soundsOn()) beep();
}

/**
 * Ticks while a number wheel turns (see number-wheel.ts): a separate per-device choice from the
 * alerts above, on by default, since the user is touching the screen when they play.
 */
export const TICK_KEY = 'gymx:ticks';
let tickOverride: boolean | null = null;

export function getTicks(): boolean {
  if (tickOverride !== null) return tickOverride;
  try {
    return storage()?.getItem(TICK_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setTicks(on: boolean): void {
  tickOverride = on;
  try {
    storage()?.setItem(TICK_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked: the choice lasts for this visit only */
  }
}

/** Gets sound ready for ticks; call when a turn starts (a pointerdown). */
export function unlockTicks(): void {
  if (getTicks()) openAudio();
}

let tickBuffer: AudioBuffer | null = null;
let lastTick = 0;
/** Ticks closer together than this are skipped, so a fast flick rattles instead of buzzing. */
const TICK_GAP_MS = 22;

/**
 * One short, dry "detent" click per step: a filtered noise burst with a tiny pitched body,
 * a little higher going up than down. With `haptic`, phones that can also buzz briefly.
 */
export function tick(dir: 1 | -1, haptic = false): void {
  if (!getTicks()) return;
  const now = Date.now();
  if (now - lastTick < TICK_GAP_MS) return;
  lastTick = now;
  if (haptic && canVibrate()) {
    try {
      navigator.vibrate(4);
    } catch {
      /* needs a recent tap in some browsers */
    }
  }
  whenRunning((ctx) => {
    const t = ctx.currentTime;
    if (!tickBuffer || tickBuffer.sampleRate !== ctx.sampleRate) {
      const len = Math.floor(ctx.sampleRate * 0.012);
      tickBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = tickBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = tickBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = dir > 0 ? 4200 : 3200;
    band.Q.value = 1.2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.5;
    noise.connect(band).connect(noiseGain).connect(ctx.destination);
    noise.start(t);
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(dir > 0 ? 1500 : 1150, t);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  });
}
