/**
 * In-memory pet statistics manager. Stats tick once a minute in memory and
 * persist to SQLite only every few minutes or on meaningful interactions —
 * never on a per-second cadence.
 */
import { notify } from '../../services/notifications/notifications';
import { playSound } from '../../services/sound/sound';
import { logger } from '../../utils/logger';
import {
  applyDelta,
  decayTick,
  INTERACTION_DELTAS,
  moodForStats,
  normalizeStats,
  VERY_HUNGRY_THRESHOLD,
  type PetStats,
} from './pet.stats';
import {
  loadPetProfile,
  logActivity,
  resetPetProgress,
  savePetStats,
  touchLastInteraction,
} from './pet.repository';
import type { PetProfile, PetStateName } from './pet.types';

const TICK_MS = 60_000;
const PERSIST_EVERY_TICKS = 5;

export type StatsListener = (stats: PetStats, mood: string) => void;

export class PetStatsService {
  private stats: PetStats;
  private profile: PetProfile;
  private listeners = new Set<StatsListener>();
  private tickTimer: number | null = null;
  private ticksSincePersist = 0;
  private dirty = false;
  private notifiedHungry = false;
  private currentState: PetStateName = 'initializing';

  private constructor(profile: PetProfile) {
    this.profile = profile;
    this.stats = normalizeStats(profile);
  }

  static async create(): Promise<PetStatsService> {
    const profile = await loadPetProfile();
    return new PetStatsService(profile);
  }

  get current(): PetStats {
    return { ...this.stats };
  }

  get petName(): string {
    return this.profile.name;
  }

  get mood(): string {
    return moodForStats(this.stats);
  }

  setPetState(state: PetStateName): void {
    this.currentState = state;
  }

  subscribe(listener: StatsListener): () => void {
    this.listeners.add(listener);
    listener(this.current, this.mood);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = window.setInterval(() => void this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    void this.persist();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.current, this.mood);
    }
  }

  private async tick(): Promise<void> {
    // Skip decay while hidden to stay lightweight and non-punishing.
    if (this.currentState === 'hidden') return;
    this.stats = decayTick(this.stats, this.currentState);
    this.dirty = true;
    this.emit();

    if (this.stats.hunger >= VERY_HUNGRY_THRESHOLD && !this.notifiedHungry) {
      this.notifiedHungry = true;
      void notify(
        'hungry',
        `${this.profile.name} is very hungry`,
        'A snack from the tray menu or the pet menu would help.'
      );
    }
    if (this.stats.hunger < VERY_HUNGRY_THRESHOLD - 20) {
      this.notifiedHungry = false;
    }

    this.ticksSincePersist += 1;
    if (this.ticksSincePersist >= PERSIST_EVERY_TICKS) {
      await this.persist();
    }
  }

  async persist(): Promise<void> {
    if (!this.dirty) return;
    try {
      await savePetStats(this.stats, this.mood);
      this.dirty = false;
      this.ticksSincePersist = 0;
    } catch (error) {
      logger.warn('pet', 'failed to persist stats (will retry)', error);
    }
  }

  private async interact(kind: 'feed' | 'pet' | 'chat', details: string | null): Promise<void> {
    const before = this.stats.level;
    this.stats = applyDelta(this.stats, INTERACTION_DELTAS[kind]);
    this.dirty = true;
    this.emit();
    await this.persist();
    void touchLastInteraction().catch(() => undefined);
    void logActivity(kind, details, INTERACTION_DELTAS[kind].experience ?? 0);

    if (this.stats.level > before) {
      playSound('levelUp');
      void logActivity('level_up', `Reached level ${this.stats.level}`, 0);
      void notify(
        'level-up',
        `${this.profile.name} reached level ${this.stats.level}!`,
        'All those interactions are paying off.'
      );
    }
  }

  async feed(): Promise<void> {
    playSound('feed');
    await this.interact('feed', null);
  }

  async petThePet(): Promise<void> {
    playSound('happy');
    await this.interact('pet', null);
  }

  async rewardChat(): Promise<void> {
    await this.interact('chat', null);
  }

  async reset(): Promise<void> {
    await resetPetProgress();
    void logActivity('reset', 'Pet progress reset', 0);
    this.profile = await loadPetProfile();
    this.stats = normalizeStats(this.profile);
    this.dirty = false;
    this.notifiedHungry = false;
    this.emit();
  }

  async refreshProfile(): Promise<PetProfile> {
    this.profile = await loadPetProfile();
    this.stats = normalizeStats(this.profile);
    this.emit();
    return this.profile;
  }
}
