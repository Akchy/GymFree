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
  if (!soundsOn()) return;
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
