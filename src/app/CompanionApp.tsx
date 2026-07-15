/**
 * Companion window application: a lightweight extra desktop pet. Shares the
 * behavior machine, canvas and sounds with the main pet, but has no chat,
 * stats or hunger — those live in the main pet window.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useMachine } from '@xstate/react';

import { PetCanvas } from '../components/pet/PetCanvas';
import { PixelLaptop } from '../components/pet/PixelLaptop';
import { SpeechBubble } from '../components/pet/SpeechBubble';
import { petMachine } from '../features/pet/pet.machine';
import type { PetStateName } from '../features/pet/pet.types';
import { getManifest } from '../features/pet-library/services/pet-asset-loader';
import { randomDialogueLine } from '../features/pet-library/services/pet-dialogue';
import {
  playSlapSound,
  playSnoreSound,
  playSound,
  setMuted,
  setPetVoice,
  setVolume,
  stopSnoreSound,
  syncSoundFromPreferences,
} from '../services/sound/sound';
import {
  getPreference,
  PET_SIZE_SCALES,
  type PetSizeName,
} from '../services/storage/preferences';
import {
  companionFallbackOffsetX,
  getCompanionPosition,
  removeCompanion,
  saveCompanionPosition,
} from '../services/windows/companionWindows';
import { startDragging, PET_WINDOW_SIZE, type WindowPos } from '../services/windows/petWindow';
import { AppEvents } from '../types/events';
import { logger } from '../utils/logger';

const CLICK_REACTIONS = ['Hello! 👋', 'Hi there!', 'Good to see you!', '✨'];
const SLAP_REACTIONS = ['Ouch!! 😵', 'Hey!! What was that for?!', 'Rude!!'];

const DRAG_THRESHOLD_PX = 6;
/** The pet stops typing this long after the user's last keystroke. */
const TYPING_STOP_DELAY_MS = 2_000;

/** Compact right-click menu for a companion pet; mirrors PetMenu's markup. */
function CompanionMenu({
  sleeping,
  onPet,
  onSlap,
  onToggleSleep,
  onDismiss,
  onClose,
}: {
  sleeping: boolean;
  onPet: () => void;
  onSlap: () => void;
  onToggleSleep: () => void;
  onDismiss: () => void;
  onClose: () => void;
}) {
  const item = (label: string, action: () => void) => (
    <button
      type="button"
      className="pet-menu-item"
      onClick={() => {
        action();
        onClose();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="pet-menu" role="menu" aria-label="Companion interactions">
      {item('💜 Pet', onPet)}
      {item('👋 Slap', onSlap)}
      {item(sleeping ? '☀️ Wake up' : '🌙 Sleep', onToggleSleep)}
      {item('✖ Dismiss', onDismiss)}
    </div>
  );
}

export default function CompanionApp({ petId }: { petId: string }) {
  const [state, send] = useMachine(petMachine);
  const petState = state.value as PetStateName;

  const manifest = getManifest(petId);
  const [bubble, setBubble] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [petSize, setPetSize] = useState<PetSizeName>('medium');

  const bubbleTimer = useRef<number | null>(null);
  const bubbleDuration = useRef(4000);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragActive = useRef(false);
  const typingStopTimer = useRef<number | null>(null);
  const moveDebounce = useRef<number | null>(null);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const showBubble = useCallback((text: string) => {
    setBubble(text);
    if (bubbleTimer.current !== null) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), bubbleDuration.current);
  }, []);

  // ---- Initialization: preferences, voice, position restore ----
  useEffect(() => {
    (async () => {
      try {
        await syncSoundFromPreferences();
        setPetVoice(manifest?.category);
        setReducedMotion(
          (await getPreference('reducedMotion')) ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
        bubbleDuration.current = await getPreference('speechBubbleDurationMs');
        setPetSize(await getPreference('petSize'));

        const saved = await getCompanionPosition(petId);
        const offsetX = await companionFallbackOffsetX(petId);
        const applied = await invoke<WindowPos>('apply_saved_position', {
          x: saved?.x ?? null,
          y: saved?.y ?? null,
          offsetX,
        });
        await saveCompanionPosition(petId, applied);
      } catch (error) {
        logger.warn('companion', 'initialization incomplete', error);
      }
      await getCurrentWindow().show();
      sendRef.current({ type: 'READY' });
    })();
  }, [petId, manifest]);

  // ---- Snoring for the first seconds of sleep, like the main pet ----
  useEffect(() => {
    if (petState !== 'sleeping') return;
    playSnoreSound();
    return () => stopSnoreSound();
  }, [petState]);

  // ---- Tauri events shared with the main pet window ----
  useEffect(() => {
    const unlisteners: Promise<UnlistenFn>[] = [
      listen(AppEvents.showPet, () => {
        void getCurrentWindow().show();
        sendRef.current({ type: 'SHOW' });
      }),
      listen(AppEvents.hidePet, () => {
        sendRef.current({ type: 'HIDE' });
        void getCurrentWindow().hide();
      }),
      listen<boolean>(AppEvents.toggleMute, (event) => setMuted(!event.payload)),
      listen<number>(AppEvents.soundVolumeChanged, (event) => {
        if (typeof event.payload === 'number') setVolume(event.payload);
      }),
      listen<PetSizeName>(AppEvents.petSizeChanged, (event) => {
        if (event.payload === 'small' || event.payload === 'medium' || event.payload === 'large') {
          setPetSize(event.payload);
        }
      }),
    ];
    return () => {
      for (const p of unlisteners) {
        p.then((unlisten) => unlisten()).catch(() => undefined);
      }
    };
  }, []);

  // ---- Type along with the user, like the main pet ----
  useEffect(() => {
    const unlistenPromise = listen(AppEvents.userTyping, () => {
      sendRef.current({ type: 'TYPING_START' });
      if (typingStopTimer.current !== null) window.clearTimeout(typingStopTimer.current);
      typingStopTimer.current = window.setTimeout(() => {
        sendRef.current({ type: 'TYPING_STOP' });
      }, TYPING_STOP_DELAY_MS);
    });
    return () => {
      if (typingStopTimer.current !== null) window.clearTimeout(typingStopTimer.current);
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, []);

  // ---- Persist position after native drags ----
  useEffect(() => {
    const window_ = getCurrentWindow();
    const unlistenPromise = window_.onMoved(() => {
      if (moveDebounce.current !== null) window.clearTimeout(moveDebounce.current);
      moveDebounce.current = window.setTimeout(() => {
        void window_
          .outerPosition()
          .then((pos) => saveCompanionPosition(petId, { x: pos.x, y: pos.y }))
          .catch((error) => logger.warn('companion', 'failed to save position', error));
        if (dragActive.current) {
          dragActive.current = false;
          sendRef.current({ type: 'DRAG_END' });
        }
      }, 350);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [petId]);

  // ---- Interactions ----
  const petThePet = useCallback(() => {
    playSound('click');
    if (petState === 'sleeping') {
      send({ type: 'WAKE_UP' });
      showBubble('Hm? Oh, hello!');
      return;
    }
    send({ type: 'PET_CLICKED' });
    showBubble(
      randomDialogueLine(
        manifest?.dialogue,
        'clicked',
        CLICK_REACTIONS[Math.floor(Math.random() * CLICK_REACTIONS.length)]
      )
    );
  }, [manifest, petState, send, showBubble]);

  const slap = useCallback(() => {
    send({ type: 'SLAP' });
    playSlapSound();
    showBubble(SLAP_REACTIONS[Math.floor(Math.random() * SLAP_REACTIONS.length)]);
  }, [send, showBubble]);

  const toggleSleep = useCallback(() => {
    if (petState === 'sleeping') {
      send({ type: 'WAKE_UP' });
    } else {
      send({ type: 'BECOME_SLEEPY' });
      showBubble('zzz…');
    }
  }, [petState, send, showBubble]);

  const dismiss = useCallback(() => {
    // Persists the removal first; closing this window ends the app.
    void removeCompanion(petId).catch((error) =>
      logger.error('companion', 'failed to dismiss companion', error)
    );
  }, [petId]);

  // ---- Pointer handling (click to pet, drag to move) ----
  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = pointerStart.current;
      if (!start || dragActive.current) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > DRAG_THRESHOLD_PX) {
        pointerStart.current = null;
        dragActive.current = true;
        send({ type: 'DRAG_START' });
        void startDragging().catch((error) => {
          logger.warn('companion', 'startDragging failed', error);
          dragActive.current = false;
          sendRef.current({ type: 'DRAG_END' });
        });
      }
    },
    [send]
  );

  const onPointerUp = useCallback(() => {
    pointerStart.current = null;
  }, []);

  const onClick = useCallback(() => {
    if (dragActive.current) return;
    petThePet();
  }, [petThePet]);

  const onContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenuOpen((open) => !open);
  }, []);

  // ---- Dismiss the right-click menu like a native context menu ----
  useEffect(() => {
    if (!menuOpen) return;
    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.pet-menu')) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onWindowBlur = () => setMenuOpen(false);
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [menuOpen]);

  const name = manifest?.name ?? 'Companion';

  return (
    <div className="pet-root">
      <div
        className="pet-area"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        onContextMenu={onContextMenu}
        role="img"
        aria-label={`${name} the companion pet, currently ${petState}`}
        title={`${name} — drag to move, right-click for options`}
      >
        <SpeechBubble text={bubble} />
        <PetCanvas
          petId={petId}
          petState={petState}
          reducedMotion={reducedMotion}
          sizeFactor={PET_SIZE_SCALES[petSize]}
          width={PET_WINDOW_SIZE.width}
          height={PET_WINDOW_SIZE.height - 40}
        />
        {petState === 'typing' && <PixelLaptop reducedMotion={reducedMotion} />}
      </div>

      {menuOpen && (
        <CompanionMenu
          sleeping={petState === 'sleeping'}
          onPet={petThePet}
          onSlap={slap}
          onToggleSleep={toggleSleep}
          onDismiss={dismiss}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}
