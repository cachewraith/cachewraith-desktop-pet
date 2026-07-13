/**
 * Tiny WebAudio synth for project-owned interaction sounds. No audio files
 * are shipped; everything is generated, so nothing can fail to load.
 * Respects the mute preference and avoids overlapping spam.
 */
import { getPreference } from '../storage/preferences';
import { logger } from '../../utils/logger';

type SoundName = 'click' | 'feed' | 'happy' | 'levelUp' | 'message';

const MIN_GAP_MS = 150;

let audioContext: AudioContext | null = null;
let lastPlayed = 0;
let muted = false;

export function setMuted(value: boolean): void {
  muted = value;
}

export async function syncMuteFromPreferences(): Promise<void> {
  muted = !(await getPreference('soundEnabled'));
}

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

export function playSound(name: SoundName): void {
  if (muted) return;
  const now = Date.now();
  if (now - lastPlayed < MIN_GAP_MS) return;
  lastPlayed = now;

  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }

  const t0 = ctx.currentTime;
  for (const note of SOUNDS[name]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = note.frequency;
    // Keep everything quiet: peak gain 0.08, fast fade-out.
    gain.gain.setValueAtTime(0, t0 + note.start);
    gain.gain.linearRampToValueAtTime(0.08, t0 + note.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + note.start + note.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + note.start);
    osc.stop(t0 + note.start + note.duration + 0.02);
  }
}
