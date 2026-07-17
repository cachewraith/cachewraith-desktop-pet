/**
 * Tiny WebAudio synth for project-owned interaction sounds. No audio files
 * are shipped; everything is generated, so nothing can fail to load.
 * Respects the mute + volume preferences and avoids overlapping spam.
 *
 * Every pet gets its own "voice": a waveform and pitch derived from its
 * category, so a robot buzzes low while a space pet chirps high.
 */
import type { PetCategory } from '../../features/pet-library/types/pet-library.types';
import { getPreference } from '../storage/preferences';
import { logger } from '../../utils/logger';
import nomNomUrl from '../../assets/sounds/nom-nom-nom.mp3';
import snoreUrl from '../../assets/sounds/snore-mimimimimimi.mp3';
import slapUrl from '../../assets/sounds/slap-oh_LGvkhyt.mp3';
import typingUrl from '../../assets/sounds/among-us-typing.mp3';
import meowUrl from '../../assets/sounds/meow-sound.mp3';

type SoundName = 'click' | 'feed' | 'eat' | 'happy' | 'levelUp' | 'message';

const MIN_GAP_MS = 150;

interface PetVoice {
  wave: OscillatorType;
  /** Multiplied into every note frequency. */
  pitch: number;
  /** Compensates for how harsh the waveform sounds at equal gain. */
  loudness: number;
}

const CATEGORY_VOICES: Record<PetCategory, PetVoice> = {
  ghost: { wave: 'sine', pitch: 1, loudness: 1 },
  animal: { wave: 'triangle', pitch: 1.35, loudness: 0.9 },
  robot: { wave: 'square', pitch: 0.7, loudness: 0.45 },
  slime: { wave: 'sine', pitch: 0.8, loudness: 1 },
  fantasy: { wave: 'triangle', pitch: 1.15, loudness: 0.9 },
  elemental: { wave: 'sawtooth', pitch: 0.9, loudness: 0.55 },
  space: { wave: 'sine', pitch: 1.6, loudness: 0.95 },
  nature: { wave: 'triangle', pitch: 1.05, loudness: 0.9 },
};

let audioContext: AudioContext | null = null;
let lastPlayed = 0;
let muted = false;
let volume = 0.7; // 0..1, from the soundVolume preference (0–100)
let voice: PetVoice = CATEGORY_VOICES.ghost;

export function setMuted(value: boolean): void {
  muted = value;
}

/** Volume preference is 0–100; 50 matches the original fixed loudness. */
export function setVolume(percent: number): void {
  volume = Math.min(100, Math.max(0, percent)) / 100;
}

/** Give the synth the active pet's voice; undefined falls back to the ghost. */
export function setPetVoice(category: PetCategory | undefined): void {
  voice = (category && CATEGORY_VOICES[category]) || CATEGORY_VOICES.ghost;
}

export async function syncSoundFromPreferences(): Promise<void> {
  muted = !(await getPreference('soundEnabled'));
  setVolume(await getPreference('soundVolume'));
}

/** @deprecated kept for older call sites; also syncs volume now. */
export const syncMuteFromPreferences = syncSoundFromPreferences;

function getContext(): AudioContext | null {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    return audioContext;
  } catch (error) {
    logger.warn('sound', 'WebAudio unavailable', error);
    return null;
  }
}

interface Note {
  frequency: number;
  start: number;
  duration: number;
}

const SOUNDS: Record<SoundName, Note[]> = {
  click: [{ frequency: 660, start: 0, duration: 0.06 }],
  feed: [
    { frequency: 392, start: 0, duration: 0.08 },
    { frequency: 523, start: 0.09, duration: 0.1 },
  ],
  // Staccato low "chomps" ending in a satisfied gulp; timed to fit inside
  // the 2.2s eating state.
  eat: [
    { frequency: 235, start: 0, duration: 0.055 },
    { frequency: 205, start: 0.2, duration: 0.055 },
    { frequency: 245, start: 0.4, duration: 0.055 },
    { frequency: 200, start: 0.6, duration: 0.055 },
    { frequency: 240, start: 0.8, duration: 0.06 },
    { frequency: 165, start: 1.15, duration: 0.14 },
  ],
  happy: [
    { frequency: 523, start: 0, duration: 0.08 },
    { frequency: 659, start: 0.09, duration: 0.08 },
    { frequency: 784, start: 0.18, duration: 0.12 },
  ],
  levelUp: [
    { frequency: 523, start: 0, duration: 0.1 },
    { frequency: 659, start: 0.11, duration: 0.1 },
    { frequency: 784, start: 0.22, duration: 0.1 },
    { frequency: 1047, start: 0.33, duration: 0.2 },
  ],
  message: [{ frequency: 880, start: 0, duration: 0.05 }],
};

// ---- Looped audio clips for longer pet states (eating, sleeping) ----

interface LoopingClip {
  /** (Re)start the loop; it stops itself after `durationMs` if one was given. */
  play(): void;
  stop(): void;
}

/** Without `durationMs` the clip loops until stop() is called. */
function createLoopingClip(url: string, durationMs?: number, fallback?: SoundName): LoopingClip {
  let audio: HTMLAudioElement | null = null;
  let stopTimer: number | null = null;

  const stop = () => {
    if (stopTimer !== null) {
      window.clearTimeout(stopTimer);
      stopTimer = null;
    }
    audio?.pause();
  };

  const play = () => {
    if (muted || volume <= 0) return;
    try {
      if (!audio) {
        audio = new Audio(url);
        audio.loop = true;
      }
      audio.volume = volume;
      audio.currentTime = 0;
      void audio.play().catch((error) => {
        logger.warn('sound', `clip ${url} failed to play`, error);
        if (fallback) playSound(fallback);
      });
      if (stopTimer !== null) window.clearTimeout(stopTimer);
      if (durationMs !== undefined) {
        stopTimer = window.setTimeout(stop, durationMs);
      }
    } catch (error) {
      logger.warn('sound', `clip ${url} unavailable`, error);
      if (fallback) playSound(fallback);
    }
  };

  return { play, stop };
}

/** Plays an audio clip once from the start; a synth sound as fallback. */
function createOneShotClip(url: string, fallback?: SoundName): () => void {
  let audio: HTMLAudioElement | null = null;

  return () => {
    if (muted || volume <= 0) return;
    try {
      if (!audio) {
        audio = new Audio(url);
      }
      audio.volume = volume;
      audio.currentTime = 0;
      void audio.play().catch((error) => {
        logger.warn('sound', `clip ${url} failed to play`, error);
        if (fallback) playSound(fallback);
      });
    } catch (error) {
      logger.warn('sound', `clip ${url} unavailable`, error);
      if (fallback) playSound(fallback);
    }
  };
}

const eatingClip = createLoopingClip(nomNomUrl, 3000, 'eat');
const snoringClip = createLoopingClip(snoreUrl, 5000);
// No duration: the keyboard clatter loops for as long as the user types.
const typingClip = createLoopingClip(typingUrl);

/** One-shot slap clip for the slap interaction. */
export const playSlapSound = createOneShotClip(slapUrl, 'click');

/** One-shot meow for cat pets; silence (no synth fallback) for everyone else. */
export const playMeowSound = createOneShotClip(meowUrl);

/** Loop the keyboard clatter while the pet types along with the user. */
export const playTypingSound = typingClip.play;
export const stopTypingSound = typingClip.stop;

/** Loop the nom-nom clip while the pet chews; synth munch as fallback. */
export const playEatingSound = eatingClip.play;
export const stopEatingSound = eatingClip.stop;

/** Loop the snore clip for the first few seconds of sleep. */
export const playSnoreSound = snoringClip.play;
export const stopSnoreSound = snoringClip.stop;

export function playSound(name: SoundName): void {
  if (muted || volume <= 0) return;
  const now = Date.now();
  if (now - lastPlayed < MIN_GAP_MS) return;
  lastPlayed = now;

  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  // 0.16 at 100% volume → 0.08 at the 50% mark, the original loudness.
  const peak = 0.16 * volume * voice.loudness;
  const t0 = ctx.currentTime;
  for (const note of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = voice.wave;
    osc.frequency.value = note.frequency * voice.pitch;
    gain.gain.setValueAtTime(0, t0 + note.start);
    gain.gain.linearRampToValueAtTime(peak, t0 + note.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.start + note.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + note.start);
    osc.stop(t0 + note.start + note.duration + 0.02);
  }
}
