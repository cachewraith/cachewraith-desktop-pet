/**
 * Generic pixel-art pet renderer. One instance lives in the single Pixi
 * Application of the pet window; switching characters swaps textures
 * without recreating the Application.
 *
 * Fallback chain when something is missing or broken:
 *   requested animation → pet idle → CacheWraith sheet → GhostPet vector
 *   graphic (always available, drawn in code).
 */
import { AnimatedSprite, Assets, Container, Graphics, Rectangle, Texture } from 'pixi.js';

import {
  animationForState,
  resolveAnimation,
} from '../../features/pet-library/services/animation-fallback';
import { getManifest, getSpriteUrl } from '../../features/pet-library/services/pet-asset-loader';
import {
  DEFAULT_PET_ID,
  type ParticleKind,
  type PetAnimationDefinition,
  type PetAnimationName,
  type PetCharacterManifest,
} from '../../features/pet-library/types/pet-library.types';
import type { PetStateName } from '../../features/pet/pet.types';
import { logger } from '../../utils/logger';
import { GhostPet } from './ghost';

interface Particle {
  sprite: Graphics;
  vx: number;
  vy: number;
  sway: number;
  life: number;
  maxLife: number;
}

const WALK_RANGE = 55;

export class PixelPetController extends Container {
  private readonly homeX: number;
  private readonly homeY: number;
  private readonly glow = new Graphics();
  private readonly particleLayer = new Container();
  private readonly particles: Particle[] = [];

  private manifest: PetCharacterManifest | null = null;
  private textures = new Map<PetAnimationName, Texture[]>();
  private frameRates = new Map<PetAnimationName, number>();
  private loadedUrls: string[] = [];
  private sprite: AnimatedSprite | null = null;
  private ghostFallback: GhostPet | null = null;

  private petState: PetStateName = 'initializing';
  private currentAnimation: PetAnimationName | null = null;
  private reducedMotion = false;
  private time = 0;
  private walkOffset = 0;
  private walkDirection = 1;
  private ambientTimer = 0;
  private glitchTimer = 3;
  private glitchActive = 0;
  private loadGeneration = 0;

  constructor(homeX: number, homeY: number) {
    super();
    this.homeX = homeX;
    this.homeY = homeY;
    this.position.set(homeX, homeY);
    this.addChild(this.glow);
    this.addChild(this.particleLayer);
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    this.ghostFallback?.setReducedMotion(value);
  }

  /**
   * User-chosen size multiplier. Scaling the whole container keeps the
   * sprite, glow and particles proportional, and since children sit above
   * the origin the pet stays planted on its baseline.
   */
  setSizeFactor(factor: number): void {
    this.scale.set(factor);
  }

  /** Load and display a character; safe to call repeatedly. */
  async setCharacter(petId: string): Promise<void> {
    const generation = ++this.loadGeneration;
    const manifest = getManifest(petId) ?? getManifest(DEFAULT_PET_ID);

    if (!manifest) {
      logger.warn('pixel-pet', 'no manifests available, using vector fallback');
      this.useGhostFallback();
      return;
    }

    try {
      const { textures, frameRates, urls } = await this.loadTextures(manifest);
      if (generation !== this.loadGeneration) {
        // A newer selection superseded this load; release what we fetched.
        void Promise.allSettled(urls.map((url) => Assets.unload(url)));
        return;
      }
      this.disposeCharacter();
      this.manifest = manifest;
      this.textures = textures;
      this.frameRates = frameRates;
      this.loadedUrls = urls;
      this.drawGlow();
      this.currentAnimation = null;
      this.applyState(this.petState);
    } catch (error) {
      logger.error('pixel-pet', `failed to load "${petId}", using fallback`, error);
      if (petId !== DEFAULT_PET_ID && getManifest(DEFAULT_PET_ID)) {
        await this.setCharacter(DEFAULT_PET_ID);
      } else {
        this.useGhostFallback();
      }
    }
  }

  private async loadTextures(manifest: PetCharacterManifest): Promise<{
    textures: Map<PetAnimationName, Texture[]>;
    frameRates: Map<PetAnimationName, number>;
    urls: string[];
  }> {
    const textures = new Map<PetAnimationName, Texture[]>();
    const frameRates = new Map<PetAnimationName, number>();
    const urls: string[] = [];

    const entries = Object.entries(manifest.animations) as [
      PetAnimationName,
      PetAnimationDefinition,
    ][];
    await Promise.all(
      entries.map(async ([name, def]) => {
        const url = getSpriteUrl(manifest.slug, def.asset);
        if (!url) throw new Error(`missing sprite asset ${def.asset}`);
        const base = await Assets.load<Texture>(url);
        urls.push(url);
        const frames: Texture[] = [];
        for (let i = 0; i < def.frameCount; i++) {
          frames.push(
            new Texture({
              source: base.source,
              frame: new Rectangle(i * def.frameWidth, 0, def.frameWidth, def.frameHeight),
            })
          );
        }
        textures.set(name, frames);
        frameRates.set(name, def.frameRate);
      })
    );
    return { textures, frameRates, urls };
  }

  private useGhostFallback(): void {
    this.disposeCharacter();
    this.ghostFallback = new GhostPet(0, 0);
    this.ghostFallback.setReducedMotion(this.reducedMotion);
    this.ghostFallback.setPetState(this.petState);
    this.addChild(this.ghostFallback);
  }

  private drawGlow(): void {
    this.glow.clear();
    const color = this.manifest?.effects?.glowColor;
    if (!color) return;
    const tint = Number.parseInt(color.replace('#', ''), 16);
    this.glow.circle(0, -70, 90).fill({ color: tint, alpha: 0.07 });
    this.glow.circle(0, -75, 62).fill({ color: tint, alpha: 0.09 });
  }

  setPetState(state: PetStateName): void {
    this.petState = state;
    this.ghostFallback?.setPetState(state);
    this.applyState(state);
  }

  private applyState(state: PetStateName): void {
    if (this.ghostFallback) return;
    const animationName = animationForState(state);
    if (animationName === null) return; // hidden — ticker stops outside
    if (animationName === this.currentAnimation && this.sprite) return;

    const fallbackManifest = getManifest(DEFAULT_PET_ID);
    const resolved = resolveAnimation(this.manifest, animationName, fallbackManifest);
    if (!resolved) {
      this.useGhostFallback();
      return;
    }
    const frames = this.textures.get(resolved.definition.name);
    if (!frames || frames.length === 0) {
      this.useGhostFallback();
      return;
    }

    if (!this.sprite) {
      this.sprite = new AnimatedSprite(frames);
      this.addChild(this.sprite);
    } else {
      this.sprite.textures = frames;
    }
    const def = resolved.definition;
    this.sprite.anchor.set(def.anchorX ?? 0.5, def.anchorY ?? 1);
    const scale = def.scale ?? 5;
    this.sprite.scale.set(scale * Math.sign(this.sprite.scale.x || 1), scale);
    this.sprite.animationSpeed = (this.frameRates.get(def.name) ?? def.frameRate) / 60;
    this.sprite.loop = def.loop;
    this.sprite.gotoAndPlay(0);
    this.currentAnimation = animationName;

    if (state === 'celebrating' && !this.reducedMotion) {
      this.burstParticles(this.manifest?.effects?.celebrationParticle ?? 'spark', 12);
    }
  }

  // ---- particles ----
  private particleColor(index: number): number {
    const colors = this.manifest?.effects?.particleColors ?? ['#9d8cff', '#4fd8ff'];
    const hex = colors[index % colors.length];
    return Number.parseInt(hex.replace('#', ''), 16);
  }

  private spawnParticle(kind: ParticleKind, x: number, y: number, index: number): void {
    const g = new Graphics();
    const color = this.particleColor(index);
    const size = kind === 'star' || kind === 'spark' ? 4 : 3;
    g.rect(-size / 2, -size / 2, size, size).fill({ color, alpha: 0.95 });
    g.position.set(x, y);
    this.particleLayer.addChild(g);

    let vx = 0;
    let vy = 0;
    let sway = 0;
    switch (kind) {
      case 'spark':
        vx = (Math.random() - 0.5) * 40;
        vy = -60 - Math.random() * 50;
        break;
      case 'star':
      case 'pixel':
        vx = (Math.random() - 0.5) * 140;
        vy = -40 - Math.random() * 80;
        break;
      case 'leaf':
        vx = (Math.random() - 0.5) * 20;
        vy = 20 + Math.random() * 20;
        sway = 20 + Math.random() * 20;
        break;
      case 'snow':
        vx = (Math.random() - 0.5) * 12;
        vy = 25 + Math.random() * 15;
        sway = 10 + Math.random() * 10;
        break;
    }
    this.particles.push({
      sprite: g,
      vx,
      vy,
      sway,
      life: 0,
      maxLife: 0.8 + Math.random() * 0.7,
    });
  }

  private burstParticles(kind: ParticleKind, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawnParticle(kind, (Math.random() - 0.5) * 100, -60 - Math.random() * 60, i);
    }
  }

  /** Advance animation side-work (float, glow, particles, walking drift). */
  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.1);
    this.time += dt;
    const t = this.time;
    const calm = this.reducedMotion;

    if (this.ghostFallback) {
      this.ghostFallback.update(dt);
      return;
    }

    const effects = this.manifest?.effects;
    const floatAmount = calm ? 0 : (effects?.idleFloatAmount ?? 2);
    const floatSpeed = effects?.idleFloatSpeed ?? 1.4;

    // Position: float + walking drift.
    let targetX = this.homeX;
    let floatY = 0;
    if (this.petState === 'walking' && !calm) {
      this.walkOffset += this.walkDirection * 26 * dt;
      if (this.walkOffset > WALK_RANGE) this.walkDirection = -1;
      if (this.walkOffset < -WALK_RANGE) this.walkDirection = 1;
      if (this.sprite) {
        const s = Math.abs(this.sprite.scale.x);
        this.sprite.scale.x = this.walkDirection >= 0 ? s : -s;
      }
    } else if (this.petState === 'idle' || this.petState === 'initializing') {
      floatY = Math.sin(t * floatSpeed) * floatAmount;
    } else if (this.petState === 'sleeping') {
      floatY = calm ? 2 : 2 + Math.sin(t * 0.8);
    }
    targetX += this.walkOffset;

    const ease = Math.min(1, dt * 8);
    this.x += (targetX - this.x) * ease;
    this.y = this.homeY + floatY;

    // Glow pulse.
    this.glow.alpha = calm ? 0.9 : 0.7 + Math.sin(t * 1.1) * 0.3;

    // Ambient particles (EmberFox sparks, FrostFang snow, …).
    const ambient = effects?.ambientParticle;
    if (ambient && !calm && this.petState !== 'sleeping') {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.spawnParticle(ambient, (Math.random() - 0.5) * 90, -30 - Math.random() * 80, 0);
        this.ambientTimer = 0.7 + Math.random() * 0.6;
      }
    }

    // GlitchSlime's occasional harmless glitch.
    if (effects?.glitch && !calm && this.sprite) {
      this.glitchTimer -= dt;
      if (this.glitchTimer <= 0) {
        this.glitchActive = 0.12;
        this.glitchTimer = 3 + Math.random() * 4;
      }
      if (this.glitchActive > 0) {
        this.glitchActive -= dt;
        this.sprite.x = (Math.random() - 0.5) * 4;
        this.sprite.tint = Math.random() > 0.5 ? 0xff88ff : 0x88ffff;
        if (this.glitchActive <= 0) {
          this.sprite.x = 0;
          this.sprite.tint = 0xffffff;
        }
      }
    }

    // Particle physics.
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.sway === 0) p.vy += 90 * dt;
      p.sprite.x += p.vx * dt + (p.sway ? Math.sin(p.life * 6) * p.sway * dt : 0);
      p.sprite.y += p.vy * dt;
      p.sprite.alpha = 1 - p.life / p.maxLife;
      if (p.life >= p.maxLife) {
        this.particleLayer.removeChild(p.sprite);
        p.sprite.destroy();
        this.particles.splice(i, 1);
      }
    }
  }

  /** Release the current character's sprite + textures. */
  private disposeCharacter(): void {
    if (this.sprite) {
      this.removeChild(this.sprite);
      this.sprite.destroy();
      this.sprite = null;
    }
    if (this.ghostFallback) {
      this.removeChild(this.ghostFallback);
      this.ghostFallback.destroyPet();
      this.ghostFallback = null;
    }
    for (const frames of this.textures.values()) {
      for (const texture of frames) texture.destroy();
    }
    this.textures.clear();
    this.frameRates.clear();
    const urls = this.loadedUrls;
    this.loadedUrls = [];
    void Promise.allSettled(urls.map((url) => Assets.unload(url)));
    this.currentAnimation = null;
    this.manifest = null;
  }

  destroyController(): void {
    this.disposeCharacter();
    for (const p of this.particles) p.sprite.destroy();
    this.particles.length = 0;
    this.destroy({ children: true });
  }
}
