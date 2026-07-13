/**
 * XState machine describing CacheWraith's behavior. Pure and side-effect
 * free (timing uses named delays) so transitions are unit-testable.
 */
import { assign, setup } from 'xstate';

export type PetEvent =
  | { type: 'READY' }
  | { type: 'IDLE_TIMEOUT' }
  | { type: 'START_WALKING' }
  | { type: 'STOP_WALKING' }
  | { type: 'BECOME_SLEEPY' }
  | { type: 'WAKE_UP' }
  | { type: 'BECOME_HUNGRY' }
  | { type: 'FEED' }
  | { type: 'FINISH_EATING' }
  | { type: 'PET_CLICKED' }
  | { type: 'CHAT_STARTED' }
  | { type: 'CHAT_FINISHED' }
  | { type: 'CELEBRATE' }
  | { type: 'DRAG_START' }
  | { type: 'DRAG_END' }
  | { type: 'HIDE' }
  | { type: 'SHOW' };

export interface PetMachineContext {
  /** State to return to after dragging or hiding ends. */
  clickCount: number;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export const petMachine = setup({
  types: {
    context: {} as PetMachineContext,
    events: {} as PetEvent,
  },
  delays: {
    walkDelay: () => Math.round(randomBetween(12_000, 35_000)),
    walkDuration: () => Math.round(randomBetween(4_000, 9_000)),
    sleepDelay: () => Math.round(randomBetween(120_000, 240_000)),
    happyDuration: 2_500,
    sadDuration: 5_000,
    eatingDuration: 2_200,
    celebrateDuration: 3_000,
    hungrySulkDelay: 45_000,
  },
}).createMachine({
  id: 'pet',
  initial: 'initializing',
  context: { clickCount: 0 },
  on: {
    HIDE: '.hidden',
    DRAG_START: '.dragging',
    BECOME_HUNGRY: '.hungry',
  },
  states: {
    initializing: {
      on: { READY: 'idle' },
    },
    idle: {
      on: {
        START_WALKING: 'walking',
        BECOME_SLEEPY: 'sleeping',
        FEED: 'eating',
        PET_CLICKED: {
          target: 'happy',
          actions: assign({ clickCount: ({ context }) => context.clickCount + 1 }),
        },
        CHAT_STARTED: 'talking',
        CELEBRATE: 'celebrating',
        IDLE_TIMEOUT: 'sleeping',
      },
      after: {
        walkDelay: 'walking',
        sleepDelay: 'sleeping',
      },
    },
    walking: {
      on: {
        STOP_WALKING: 'idle',
        PET_CLICKED: 'happy',
        FEED: 'eating',
        CHAT_STARTED: 'talking',
        BECOME_SLEEPY: 'sleeping',
      },
      after: { walkDuration: 'idle' },
    },
    sleeping: {
      on: {
        WAKE_UP: 'idle',
        PET_CLICKED: 'idle',
        FEED: 'eating',
        CHAT_STARTED: 'talking',
      },
    },
    happy: {
      on: {
        CELEBRATE: 'celebrating',
        CHAT_STARTED: 'talking',
        FEED: 'eating',
      },
      after: { happyDuration: 'idle' },
    },
    sad: {
      on: {
        PET_CLICKED: 'happy',
        FEED: 'eating',
        CHAT_STARTED: 'talking',
      },
      after: { sadDuration: 'idle' },
    },
    hungry: {
      on: {
        FEED: 'eating',
        PET_CLICKED: 'hungry',
        CHAT_STARTED: 'talking',
      },
      after: { hungrySulkDelay: 'sad' },
    },
    eating: {
      on: { FINISH_EATING: 'happy' },
      after: { eatingDuration: 'happy' },
    },
    talking: {
      on: {
        CHAT_FINISHED: 'idle',
        CELEBRATE: 'celebrating',
        FEED: 'eating',
      },
    },
    celebrating: {
      after: { celebrateDuration: 'idle' },
      on: { CHAT_STARTED: 'talking' },
    },
    dragging: {
      on: { DRAG_END: 'idle' },
    },
    hidden: {
      on: { SHOW: 'idle' },
    },
  },
});
