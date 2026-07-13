import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';

import { petMachine, type PetEvent } from './pet.machine';

function actorAt(events: PetEvent[]) {
  const actor = createActor(petMachine).start();
  for (const event of events) {
    actor.send(event);
  }
  return actor;
}

describe('petMachine', () => {
  it('starts in initializing and becomes idle on READY', () => {
    const actor = actorAt([]);
    expect(actor.getSnapshot().value).toBe('initializing');
    actor.send({ type: 'READY' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('walks and stops walking', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'START_WALKING' }]);
    expect(actor.getSnapshot().value).toBe('walking');
    actor.send({ type: 'STOP_WALKING' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('sleeps and wakes on click', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'BECOME_SLEEPY' }]);
    expect(actor.getSnapshot().value).toBe('sleeping');
    actor.send({ type: 'PET_CLICKED' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('feeding leads to eating, then finish eating leads to happy', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'FEED' }]);
    expect(actor.getSnapshot().value).toBe('eating');
    actor.send({ type: 'FINISH_EATING' });
    expect(actor.getSnapshot().value).toBe('happy');
  });

  it('chat moves to talking and back to idle', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'CHAT_STARTED' }]);
    expect(actor.getSnapshot().value).toBe('talking');
    actor.send({ type: 'CHAT_FINISHED' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('can be dragged from any state and returns to idle', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'BECOME_SLEEPY' }, { type: 'DRAG_START' }]);
    expect(actor.getSnapshot().value).toBe('dragging');
    actor.send({ type: 'DRAG_END' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('hides from any state and shows again', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'CHAT_STARTED' }, { type: 'HIDE' }]);
    expect(actor.getSnapshot().value).toBe('hidden');
    actor.send({ type: 'SHOW' });
    expect(actor.getSnapshot().value).toBe('idle');
  });

  it('becomes hungry globally and eating cures it', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'BECOME_HUNGRY' }]);
    expect(actor.getSnapshot().value).toBe('hungry');
    actor.send({ type: 'FEED' });
    expect(actor.getSnapshot().value).toBe('eating');
  });

  it('clicking while idle makes the pet happy and counts clicks', () => {
    const actor = actorAt([{ type: 'READY' }, { type: 'PET_CLICKED' }]);
    expect(actor.getSnapshot().value).toBe('happy');
    expect(actor.getSnapshot().context.clickCount).toBe(1);
  });
});
