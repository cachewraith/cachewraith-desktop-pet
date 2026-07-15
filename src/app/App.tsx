/**
 * Pet window application: PixiJS ghost + XState behavior + native window
 * integration (drag, tray events, global shortcut side effects).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useMachine } from '@xstate/react';

import { ChatPanel } from '../components/chat/ChatPanel';
import { PetCanvas } from '../components/pet/PetCanvas';
import { PetMenu } from '../components/pet/PetMenu';
import { PixelLaptop } from '../components/pet/PixelLaptop';
import { SpeechBubble } from '../components/pet/SpeechBubble';
import { useChat } from '../features/chat/useChat';
import { petMachine } from '../features/pet/pet.machine';
import { PetStatsService } from '../features/pet/pet.service';
import {
  HUNGRY_STATE_THRESHOLD,
  SLEEPY_ENERGY_THRESHOLD,
  type PetStats,
} from '../features/pet/pet.stats';
import type { PetStateName } from '../features/pet/pet.types';
import { getManifest } from '../features/pet-library/services/pet-asset-loader';
import { randomDialogueLine } from '../features/pet-library/services/pet-dialogue';
import { resolveActivePetId } from '../features/pet-library/services/pet-library.service';
import {
  DEFAULT_PET_ID,
  type ActivePetChangedPayload,
  type PetDialogue,
} from '../features/pet-library/types/pet-library.types';
import {
  playEatingSound,
  playSlapSound,
  playSnoreSound,
  playSound,
  playTypingSound,
  setMuted,
  setPetVoice,
  setVolume,
  stopEatingSound,
  stopSnoreSound,
  stopTypingSound,
  syncSoundFromPreferences,
} from '../services/sound/sound';
import {
  getPreference,
  PET_SIZE_SCALES,
  type PetSizeName,
} from '../services/storage/preferences';
import { syncCompanionWindows } from '../services/windows/companionWindows';
import {
  hidePetWindow,
  restorePositionAndShow,
  saveCurrentPosition,
  setChatExpanded,
  startDragging,
  PET_WINDOW_CHAT_SIZE,
  PET_WINDOW_SIZE,
} from '../services/windows/petWindow';
import { AppEvents } from '../types/events';
import { logger } from '../utils/logger';

const SLAP_REACTIONS = ['Ouch!! 😵', 'Hey!! What was that for?!', 'Ow… my ectoplasm… 💢', 'Rude!!'];

const CLICK_REACTIONS = [
  'Boo! 👻',
  'Hi there!',
  'Need anything?',
  'The cache spirits approve.',
  "You've got this.",
  'A short break restores mana.',
];

const DRAG_THRESHOLD_PX = 6;
const SINGLE_CLICK_DELAY_MS = 260;
/** The pet stops typing this long after the user's last keystroke. */
const TYPING_STOP_DELAY_MS = 2_000;

export default function App() {
  const [state, send] = useMachine(petMachine);
  const petState = state.value as PetStateName;

  const [service, setService] = useState<PetStatsService | null>(null);
  const [activePetId, setActivePetId] = useState(DEFAULT_PET_ID);
  const [stats, setStats] = useState<PetStats | null>(null);
  const [mood, setMood] = useState('content');
  const [petName, setPetName] = useState('CacheWraith');
  const [bubble, setBubble] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [petSize, setPetSize] = useState<PetSizeName>('medium');
  const [initError, setInitError] = useState<string | null>(null);

  const bubbleTimer = useRef<number | null>(null);
  const bubbleDuration = useRef(4000);
  const clickTimer = useRef<number | null>(null);
  const typingStopTimer = useRef<number | null>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragActive = useRef(false);
  const moveDebounce = useRef<number | null>(null);
  const dialogueRef = useRef<PetDialogue | undefined>(undefined);
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const showBubble = useCallback((text: string) => {
    setBubble(text);
    if (bubbleTimer.current !== null) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), bubbleDuration.current);
  }, []);

  // ---- Chat ----
  const chat = useChat({
    onTalkingChange: (talking) => {
      sendRef.current({ type: talking ? 'CHAT_STARTED' : 'CHAT_FINISHED' });
    },
    onAssistantReply: () => {
      playSound('message');
      void service?.rewardChat();
    },
  });

  const openChat = useCallback(async () => {
    setMenuOpen(false);
    setChatOpen(true);
    await setChatExpanded(true);
  }, []);

  const closeChat = useCallback(async () => {
    setChatOpen(false);
    await setChatExpanded(false);
  }, []);

  // ---- Initialization ----
  useEffect(() => {
    let statsService: PetStatsService | null = null;
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        await syncSoundFromPreferences();
        setReducedMotion(
          (await getPreference('reducedMotion')) ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        );
        bubbleDuration.current = await getPreference('speechBubbleDurationMs');
        setPetSize(await getPreference('petSize'));

        const petId = await resolveActivePetId();
        setActivePetId(petId);
        dialogueRef.current = getManifest(petId)?.dialogue;
        setPetVoice(getManifest(petId)?.category);

        statsService = await PetStatsService.create();
        if (disposed) return;
        setService(statsService);
        setPetName(statsService.petName);
        unsubscribe = statsService.subscribe((s, m) => {
          setStats(s);
          setMood(m);
        });
        statsService.start();
      } catch (error) {
        logger.error('app', 'initialization failed', error);
        setInitError(
          'CacheWraith could not open its local data. The pet still works, but progress will not be saved.'
        );
      }
      await restorePositionAndShow();
      sendRef.current({ type: 'READY' });
      syncCompanionWindows().catch((error) =>
        logger.warn('app', 'failed to open companion windows', error)
      );
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
      statsService?.stop();
    };
  }, []);

  // ---- Keep the stats service and tray informed about the state ----
  useEffect(() => {
    service?.setPetState(petState);
  }, [service, petState]);

  // ---- Munching sound while eating ----
  // The looped clip stops on its own after 3s; the cleanup also stops it
  // early if the eating state is interrupted (drag, chat, hide…).
  useEffect(() => {
    if (petState !== 'eating') return;
    playEatingSound();
    return () => stopEatingSound();
  }, [petState]);

  // ---- Snoring for the first 5s of sleep ----
  // The clip stops itself after 5s; the cleanup stops it early on wake-up.
  useEffect(() => {
    if (petState !== 'sleeping') return;
    playSnoreSound();
    return () => stopSnoreSound();
  }, [petState]);

  // ---- Keyboard clatter while typing along ----
  // Loops for the whole typing state; only the main pet plays it so
  // companions don't stack the same clip. Cleanup stops it on any exit.
  useEffect(() => {
    if (petState !== 'typing') return;
    playTypingSound();
    return () => stopTypingSound();
  }, [petState]);

  // ---- Derive hunger/sleep transitions from stats ----
  useEffect(() => {
    if (!stats) return;
    if (
      stats.hunger >= HUNGRY_STATE_THRESHOLD &&
      petState !== 'hungry' &&
      petState !== 'eating' &&
      petState !== 'dragging' &&
      petState !== 'hidden' &&
      petState !== 'talking'
    ) {
      send({ type: 'BECOME_HUNGRY' });
      // Defer the bubble so the effect itself does not set state synchronously.
      window.setTimeout(
        () =>
          showBubble(
            randomDialogueLine(dialogueRef.current, 'hungry', 'My ectoplasm is rumbling… 🍬')
          ),
        0
      );
    } else if (stats.energy <= SLEEPY_ENERGY_THRESHOLD && petState === 'idle') {
      send({ type: 'BECOME_SLEEPY' });
    }
  }, [stats, petState, send, showBubble]);

  // ---- Interactions ----
  const feed = useCallback(() => {
    send({ type: 'FEED' });
    showBubble(randomDialogueLine(dialogueRef.current, 'fed', 'Nom nom… ✨'));
    void service?.feed();
  }, [send, service, showBubble]);

  const slap = useCallback(() => {
    send({ type: 'SLAP' });
    playSlapSound();
    showBubble(SLAP_REACTIONS[Math.floor(Math.random() * SLAP_REACTIONS.length)]);
  }, [send, showBubble]);

  const petThePet = useCallback(() => {
    send({ type: 'PET_CLICKED' });
    showBubble('💜');
    void service?.petThePet();
  }, [send, service, showBubble]);

  const toggleSleep = useCallback(() => {
    if (petState === 'sleeping') {
      send({ type: 'WAKE_UP' });
      showBubble('Back on duty!');
    } else {
      send({ type: 'BECOME_SLEEPY' });
      showBubble('zzz…');
    }
  }, [petState, send, showBubble]);

  const openSettings = useCallback(async () => {
    setMenuOpen(false);
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const settings = await WebviewWindow.getByLabel('settings');
      if (settings) {
        await settings.show();
        await settings.setFocus();
      }
    } catch (error) {
      logger.error('app', 'failed to open settings', error);
    }
  }, []);

  const hidePet = useCallback(async () => {
    setMenuOpen(false);
    send({ type: 'HIDE' });
    await hidePetWindow();
  }, [send]);

  // ---- Tauri events from tray / Rust ----
  useEffect(() => {
    const unlisteners: Promise<UnlistenFn>[] = [
      listen(AppEvents.showPet, () => sendRef.current({ type: 'SHOW' })),
      listen(AppEvents.hidePet, () => sendRef.current({ type: 'HIDE' })),
      listen(AppEvents.feedPet, () => {
        sendRef.current({ type: 'SHOW' });
        feed();
      }),
      listen(AppEvents.openChat, () => {
        sendRef.current({ type: 'SHOW' });
        void openChat();
      }),
      listen(AppEvents.resetPosition, () => {
        void saveCurrentPosition();
        showBubble('Home sweet corner.');
      }),
      listen<boolean>(AppEvents.toggleMute, (event) => {
        setMuted(!event.payload);
      }),
      listen(AppEvents.petProfileChanged, async () => {
        if (service) {
          const profile = await service.refreshProfile();
          setPetName(profile.name);
        }
      }),
      listen<number>(AppEvents.soundVolumeChanged, (event) => {
        if (typeof event.payload === 'number') setVolume(event.payload);
      }),
      listen<PetSizeName>(AppEvents.petSizeChanged, (event) => {
        if (event.payload === 'small' || event.payload === 'medium' || event.payload === 'large') {
          setPetSize(event.payload);
        }
      }),
      listen<ActivePetChangedPayload>(AppEvents.activePetChanged, (event) => {
        const petId = event.payload?.petId;
        if (typeof petId === 'string' && petId) {
          setActivePetId(petId);
          dialogueRef.current = getManifest(petId)?.dialogue;
          const manifest = getManifest(petId);
          setPetVoice(manifest?.category);
          playSound('happy');
          showBubble(
            randomDialogueLine(
              manifest?.dialogue,
              'greeting',
              `${manifest?.name ?? 'A new friend'} is here!`
            )
          );
        }
      }),
    ];
    return () => {
      for (const p of unlisteners) {
        p.then((unlisten) => unlisten()).catch(() => undefined);
      }
    };
  }, [feed, openChat, service, showBubble]);

  // ---- Pet types along on its laptop while the user types anywhere ----
  // Rust polls for keyboard activity (never key identities) and emits
  // userTyping while keys are pressed; 2s of silence ends the reaction.
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
        void saveCurrentPosition();
        if (dragActive.current) {
          dragActive.current = false;
          sendRef.current({ type: 'DRAG_END' });
        }
      }, 350);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, []);

  // ---- Pointer handling on the pet itself ----
  const onPetPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }, []);

  const onPetPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = pointerStart.current;
      if (!start || dragActive.current) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        pointerStart.current = null;
        dragActive.current = true;
        send({ type: 'DRAG_START' });
        void startDragging().catch((error) => {
          logger.warn('app', 'startDragging failed', error);
          dragActive.current = false;
          sendRef.current({ type: 'DRAG_END' });
        });
      }
    },
    [send]
  );

  const onPetPointerUp = useCallback(() => {
    pointerStart.current = null;
  }, []);

  const onPetClick = useCallback(() => {
    if (dragActive.current) return;
    if (clickTimer.current !== null) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => {
      playSound('click');
      if (petState === 'sleeping') {
        send({ type: 'WAKE_UP' });
        showBubble('Hm? Oh, hello!');
      } else {
        petThePet();
        showBubble(
          randomDialogueLine(
            dialogueRef.current,
            'clicked',
            CLICK_REACTIONS[Math.floor(Math.random() * CLICK_REACTIONS.length)]
          )
        );
      }
    }, SINGLE_CLICK_DELAY_MS);
  }, [petState, petThePet, send, showBubble]);

  // ---- Dismiss the right-click menu like a native context menu ----
  // Close on any press outside the menu, on Escape, and when the window
  // loses focus (clicking the desktop or another app blurs us).
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.pet-menu')) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onWindowBlur = () => setMenuOpen(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [menuOpen]);

  const onPetDoubleClick = useCallback(() => {
    if (clickTimer.current !== null) {
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    void openChat();
  }, [openChat]);

  const onPetContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenuOpen((open) => !open);
  }, []);

  const size = chatOpen ? PET_WINDOW_CHAT_SIZE : PET_WINDOW_SIZE;

  return (
    <div className={chatOpen ? 'pet-root pet-root-chat' : 'pet-root'}>
      {chatOpen && (
        <ChatPanel
          petName={petName}
          messages={chat.messages}
          loading={chat.loading}
          sending={chat.sending}
          error={chat.error}
          onSend={(text) => void chat.send(text)}
          onClear={() => void chat.clear()}
          onClose={() => void closeChat()}
        />
      )}

      <div
        className="pet-area"
        onPointerDown={onPetPointerDown}
        onPointerMove={onPetPointerMove}
        onPointerUp={onPetPointerUp}
        onClick={onPetClick}
        onDoubleClick={onPetDoubleClick}
        onContextMenu={onPetContextMenu}
        role="img"
        aria-label={`${petName} the desktop ghost, currently ${petState}`}
        title={`${petName} — drag to move, double-click to chat, right-click for options`}
      >
        <SpeechBubble text={bubble} />
        <PetCanvas
          petId={activePetId}
          petState={petState}
          reducedMotion={reducedMotion}
          sizeFactor={PET_SIZE_SCALES[petSize]}
          width={PET_WINDOW_SIZE.width}
          height={PET_WINDOW_SIZE.height - 40}
        />
        {petState === 'typing' && <PixelLaptop reducedMotion={reducedMotion} />}
        <div className="pet-status-row">
          {stats && (
            <span className="level-indicator" title={`Level ${stats.level} — mood: ${mood}`}>
              Lv {stats.level}
            </span>
          )}
        </div>
      </div>

      {menuOpen && (
        <PetMenu
          sleeping={petState === 'sleeping'}
          onFeed={feed}
          onPet={petThePet}
          onSlap={slap}
          onTalk={() => void openChat()}
          onToggleSleep={toggleSleep}
          onOpenSettings={() => void openSettings()}
          onHide={() => void hidePet()}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {initError && <p className="pet-init-error">{initError}</p>}
      <span className="visually-hidden">{`Window size ${size.width}x${size.height}`}</span>
    </div>
  );
}
