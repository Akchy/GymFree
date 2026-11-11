import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A stand-in for the Web Audio API that records the tones played. */
class FakeAudio {
  static made = 0;
  static tones: number[] = [];
  static last: FakeAudio | null = null;
  state: AudioContextState | 'interrupted' = 'suspended';
  currentTime = 0;
  destination = {};
  constructor() {
    FakeAudio.made++;
    FakeAudio.last = this;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    const osc = { type: '', frequency: { value: 0 }, connect: (g: unknown) => g, start: () => FakeAudio.tones.push(osc.frequency.value), stop: () => undefined };
    return osc;
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (d: unknown) => d };
  }
}

const load = () => import('../../src/ui/alerts');
const setVibrate = (fn: unknown) => Object.defineProperty(navigator, 'vibrate', { value: fn, configurable: true });

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  FakeAudio.made = 0;
  FakeAudio.tones = [];
  vi.stubGlobal('AudioContext', FakeAudio);
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete (navigator as { vibrate?: unknown }).vibrate;
  delete (navigator as { audioSession?: unknown }).audioSession;
});

describe('workout alerts', () => {
  it('turns sound on by default only where the phone cannot vibrate', async () => {
    let a = await load();
    expect(a.canVibrate()).toBe(false);
    expect(a.getSounds()).toBe(true);
    setVibrate(vi.fn());
    vi.resetModules();
    a = await load();
    expect(a.getSounds()).toBe(false);
  });

  it('remembers the choice on this device', async () => {
    const a = await load();
    a.setSounds(false);
    expect(localStorage.getItem(a.SOUND_KEY)).toBe('off');
    expect(a.getSounds()).toBe(false);
    a.setSounds(true);
    expect(a.getSounds()).toBe(true);
  });

  it('buzzes and beeps once sound has been unlocked by a tap', async () => {
    const vibrate = vi.fn();
    setVibrate(vibrate);
    const session = { type: 'auto' };
    Object.defineProperty(navigator, 'audioSession', { value: session, configurable: true });
    const a = await load();
    a.setSounds(true);
    a.alertUser(200); // no tap yet: buzz only
    expect(vibrate).toHaveBeenCalledWith(200);
    expect(FakeAudio.tones).toEqual([]);
    a.unlockSound();
    await Promise.resolve();
    expect(session.type).toBe('ambient'); // mixes with the user's music
    a.unlockSound();
    expect(FakeAudio.made).toBe(1);
    a.alertUser([150, 100, 150]);
    expect(vibrate).toHaveBeenLastCalledWith([150, 100, 150]);
    expect(FakeAudio.tones).toEqual([880, 1175]);
  });

  it('stays silent with sound off, and survives missing APIs', async () => {
    const a = await load();
    a.setSounds(false);
    a.unlockSound();
    a.alertUser();
    expect(FakeAudio.made).toBe(0);
    setVibrate(() => {
      throw new Error('no tap');
    });
    vi.stubGlobal('AudioContext', undefined);
    a.setSounds(true);
    a.unlockSound();
    expect(() => a.alertUser()).not.toThrow();
  });

  it('restarts sound the phone paused (earphones connected, music started) before beeping', async () => {
    const a = await load();
    a.setSounds(true);
    a.unlockSound();
    await Promise.resolve();
    expect(FakeAudio.last!.state).toBe('running');
    FakeAudio.last!.state = 'interrupted'; // Safari, after the audio output changed
    a.alertUser();
    expect(FakeAudio.tones).toEqual([]); // waits for the restart…
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.last!.state).toBe('running');
    expect(FakeAudio.tones).toEqual([880, 1175]); // …then beeps
    // A closed context is replaced on the next tap
    FakeAudio.last!.state = 'closed';
    a.unlockSound();
    expect(FakeAudio.made).toBe(2);
  });

  it('gives up quietly if the phone refuses to restart sound', async () => {
    const a = await load();
    a.setSounds(true);
    a.unlockSound();
    FakeAudio.last!.state = 'interrupted';
    FakeAudio.last!.resume = () => Promise.reject(new Error('needs a tap'));
    a.alertUser();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.tones).toEqual([]);
  });

  it('keeps the earphones awake with an inaudible tone before an alert, once at a time', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const a = await load();
    a.setSounds(true);
    a.keepSoundAwake(); // no sound unlocked yet: nothing to do
    expect(FakeAudio.tones).toEqual([]);
    a.unlockSound();
    await Promise.resolve();
    a.keepSoundAwake();
    a.keepSoundAwake(); // already awake
    expect(FakeAudio.tones).toEqual([220]);
    vi.spyOn(Date, 'now').mockReturnValue(1_002_100);
    a.keepSoundAwake(); // about to fall asleep again
    expect(FakeAudio.tones).toEqual([220, 220]);
    a.setSounds(false);
    vi.spyOn(Date, 'now').mockReturnValue(1_010_000);
    a.keepSoundAwake();
    expect(FakeAudio.tones).toHaveLength(2);
    vi.restoreAllMocks();
  });

  it('plays a sample when sound is switched on, after waking the earphones', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    const a = await load();
    a.setSounds(true);
    a.previewSound();
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeAudio.tones).toEqual([220]);
    vi.advanceTimersByTime(1000);
    expect(FakeAudio.tones).toEqual([220, 880, 1175]);
    vi.useRealTimers();
  });
});
