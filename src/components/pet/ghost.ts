/**
 * Original project-owned CacheWraith ghost, drawn with PixiJS Graphics.
 * A GhostPet is a Container; the animation controller maps XState states
 * to transforms updated from the Pixi ticker (React never re-renders for
 * animation frames).
 */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

import type { PetStateName } from '../../features/pet/pet.types';

const BODY_COLOR = 0xbfa8ff;
const BODY_EDGE = 0x8f7ae0;
const GLOW_INNER = 0x9d8cff;
const GLOW_OUTER = 0x4fd8ff;
const EYE_COLOR = 0x2b1b4d;
const BLUSH_COLOR = 0xff9ad5;
const MOUTH_COLOR = 0x2b1b4d;
const STAR_COLORS = [0x9d8cff, 0x4fd8ff, 0xffd166, 0xff9ad5];
const HOODIE_COLOR = 0x1e2338;
const HOODIE_EDGE = 0x12162a;
const HOODIE_POCKET = 0x272d4a;
const HOODIE_STRING = 0xaab6e0;
const HOODIE_STITCH = 0x7ef9a2;

const BODY_W = 120;
const BODY_H = 130;

interface Star {
  sprite: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function drawBody(g: Graphics): void {
  const w = BODY_W;
  const h = BODY_H;
  g.clear();
  // Dome + wavy hem, classic ghost silhouette.
  g.moveTo(-w / 2, 0);
  g.bezierCurveTo(-w / 2, -h * 0.85, w / 2, -h * 0.85, w / 2, 0);
  g.lineTo(w / 2, h * 0.28);
  const waves = 4;
  const waveW = w / waves;
  for (let i = 0; i < waves; i++) {
    const x0 = w / 2 - i * waveW;
    g.quadraticCurveTo(x0 - waveW / 2, h * 0.28 + (i % 2 === 0 ? 18 : -6), x0 - waveW, h * 0.28);
  }
  g.closePath();
  g.fill({ color: BODY_COLOR });
  g.stroke({ color: BODY_EDGE, width: 3, alpha: 0.7 });
}

/**
 * Hacker hoodie worn while typing: a dark hood pulled up around the face,
 * a torso with a kangaroo pocket and hem, and dangling drawstrings. The
 * face opening is refilled with the body color so the hood reads as worn
 * over the head rather than pasted on top.
 */
function drawHoodie(hoodie: Container): void {
  const hood = new Graphics();
  hood.moveTo(-66, -16);
  hood.bezierCurveTo(-66, -126, 66, -126, 66, -16);
  hood.closePath();
  hood.fill({ color: HOODIE_COLOR });
  hood.stroke({ color: HOODIE_EDGE, width: 3, alpha: 0.85 });
  hood.ellipse(0, -56, 42, 33).fill({ color: BODY_COLOR });
  hood.ellipse(0, -56, 42, 33).stroke({ color: HOODIE_STITCH, width: 2, alpha: 0.35 });

  const torso = new Graphics();
  torso.moveTo(-62, -20);
  torso.lineTo(62, -20);
  torso.lineTo(60, 26);
  torso.quadraticCurveTo(0, 32, -60, 26);
  torso.closePath();
  torso.fill({ color: HOODIE_COLOR });
  torso.stroke({ color: HOODIE_EDGE, width: 3, alpha: 0.85 });
  // Ribbed hem.
  torso.moveTo(-60, 20).quadraticCurveTo(0, 26, 60, 20);
  torso.stroke({ color: HOODIE_EDGE, width: 3, alpha: 0.7 });

  const pocket = new Graphics();
  pocket.roundRect(-24, -6, 48, 20, 5).fill({ color: HOODIE_POCKET });
  pocket.roundRect(-24, -6, 48, 20, 5).stroke({ color: HOODIE_EDGE, width: 2, alpha: 0.8 });

  const strings = new Graphics();
  for (const side of [-1, 1]) {
    strings.moveTo(side * 15, -26).quadraticCurveTo(side * 17, -14, side * 13, -2);
    strings.stroke({ color: HOODIE_STRING, width: 2.5, cap: 'round' });
    strings.circle(side * 13, 0, 2.5).fill({ color: HOODIE_STRING });
  }

  hoodie.addChild(hood, torso, pocket, strings);
}

function drawStar(g: Graphics, color: number): void {
  const spikes = 4;
  const outer = 6;
  const inner = 2.5;
  g.clear();
  for (let i = 0; i < spikes * 2; i++) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill({ color, alpha: 0.95 });
}

export class GhostPet extends Container {
  private readonly glow = new Graphics();
  private readonly body = new Graphics();
  private readonly hoodie = new Container();
  private readonly face = new Container();
  private readonly leftEye = new Graphics();
  private readonly rightEye = new Graphics();
  private readonly mouth = new Graphics();
  private readonly blushLeft = new Graphics();
  private readonly blushRight = new Graphics();
  private readonly zzz: Text;
  private readonly stars: Star[] = [];
  private readonly starLayer = new Container();

  private state: PetStateName = 'initializing';
  private reducedMotion = false;
  private time = 0;
  private blinkTimer = 2 + Math.random() * 3;
  private blinkPhase = 0;
  private walkDirection = 1;
  private walkOffset = 0;
  private starCooldown = 0;
  private readonly homeX: number;
  private readonly homeY: number;

  constructor(homeX: number, homeY: number) {
    super();
    this.homeX = homeX;
    this.homeY = homeY;
    this.position.set(homeX, homeY);

    this.glow.circle(0, -30, 95).fill({ color: GLOW_OUTER, alpha: 0.08 });
    this.glow.circle(0, -35, 75).fill({ color: GLOW_INNER, alpha: 0.1 });
    this.glow.circle(0, -40, 58).fill({ color: GLOW_INNER, alpha: 0.12 });
    this.addChild(this.glow);

    drawBody(this.body);
    this.body.pivot.set(0, 0);
    this.body.position.set(0, 0);
    this.addChild(this.body);

    drawHoodie(this.hoodie);
    this.hoodie.visible = false;
    this.addChild(this.hoodie);

    this.leftEye.ellipse(0, 0, 8, 11).fill(EYE_COLOR);
    this.leftEye.circle(2.5, -3.5, 2.6).fill({ color: 0xffffff, alpha: 0.9 });
    this.leftEye.position.set(-26, -62);
    this.rightEye.ellipse(0, 0, 8, 11).fill(EYE_COLOR);
    this.rightEye.circle(2.5, -3.5, 2.6).fill({ color: 0xffffff, alpha: 0.9 });
    this.rightEye.position.set(26, -62);

    this.blushLeft.ellipse(0, 0, 7, 4).fill({ color: BLUSH_COLOR, alpha: 0.55 });
    this.blushLeft.position.set(-40, -46);
    this.blushRight.ellipse(0, 0, 7, 4).fill({ color: BLUSH_COLOR, alpha: 0.55 });
    this.blushRight.position.set(40, -46);

    this.mouth.position.set(0, -42);
    this.drawMouthFor('idle');

    this.face.addChild(this.leftEye, this.rightEye, this.blushLeft, this.blushRight, this.mouth);
    this.addChild(this.face);

    this.zzz = new Text({
      text: 'z z z',
      style: new TextStyle({
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: 18,
        fill: 0xcdd9ff,
        fontStyle: 'italic',
      }),
    });
    this.zzz.position.set(45, -120);
    this.zzz.alpha = 0;
    this.addChild(this.zzz);

    this.addChild(this.starLayer);
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
  }

  setPetState(state: PetStateName): void {
    if (this.state === state) return;
    this.state = state;
    this.drawMouthFor(state);
    this.hoodie.visible = state === 'typing';
    if (state === 'celebrating' && !this.reducedMotion) {
      this.burstStars(14);
    }
  }

  private drawMouthFor(state: PetStateName): void {
    const g = this.mouth;
    g.clear();
    switch (state) {
      case 'happy':
      case 'celebrating':
        g.moveTo(-10, 0).quadraticCurveTo(0, 10, 10, 0);
        g.stroke({ color: MOUTH_COLOR, width: 3, cap: 'round' });
        break;
      case 'sad':
      case 'hungry':
        g.moveTo(-9, 4).quadraticCurveTo(0, -5, 9, 4);
        g.stroke({ color: MOUTH_COLOR, width: 3, cap: 'round' });
        break;
      case 'eating':
      case 'talking':
        g.ellipse(0, 2, 7, 8).fill(MOUTH_COLOR);
        break;
      case 'sleeping':
        g.ellipse(0, 2, 4, 5).fill({ color: MOUTH_COLOR, alpha: 0.8 });
        break;
      default:
        g.moveTo(-6, 0).quadraticCurveTo(0, 4, 6, 0);
        g.stroke({ color: MOUTH_COLOR, width: 3, cap: 'round' });
    }
  }

  private burstStars(count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = new Graphics();
      drawStar(sprite, STAR_COLORS[i % STAR_COLORS.length]);
      sprite.position.set((Math.random() - 0.5) * 60, -60 + (Math.random() - 0.5) * 40);
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.starLayer.addChild(sprite);
      this.stars.push({
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.6,
      });
    }
  }

  /** Advance the animation. deltaSeconds comes from the Pixi ticker. */
  update(deltaSeconds: number): void {
    const dt = Math.min(deltaSeconds, 0.1);
    this.time += dt;
    const t = this.time;
    const calm = this.reducedMotion;

    // Blinking (skipped while sleeping — eyes are already closed).
    if (this.state !== 'sleeping') {
      this.blinkTimer -= dt;
      if (this.blinkTimer <= 0) {
        this.blinkPhase = 0.22;
        this.blinkTimer = 2.5 + Math.random() * 4;
      }
      if (this.blinkPhase > 0) {
        this.blinkPhase = Math.max(0, this.blinkPhase - dt);
        const openness = this.blinkPhase > 0.11 ? 0.15 : 1;
        this.leftEye.scale.y = openness;
        this.rightEye.scale.y = openness;
      } else {
        this.leftEye.scale.y = 1;
        this.rightEye.scale.y = 1;
      }
    } else {
      this.leftEye.scale.y = 0.12;
      this.rightEye.scale.y = 0.12;
    }

    // Baselines, adjusted per state below.
    let targetX = this.homeX + this.walkOffset;
    let targetY = this.homeY;
    let bodyRotation = 0;
    let bodyScaleY = 1;
    this.zzz.alpha = Math.max(0, this.zzz.alpha - dt * 2);

    switch (this.state) {
      case 'idle':
      case 'initializing':
        targetY += calm ? 0 : Math.sin(t * 1.6) * 6;
        break;
      case 'walking': {
        if (!calm) {
          this.walkOffset += this.walkDirection * 24 * dt;
          if (this.walkOffset > 55) this.walkDirection = -1;
          if (this.walkOffset < -55) this.walkDirection = 1;
          targetX = this.homeX + this.walkOffset;
          targetY += Math.sin(t * 5) * 4;
          bodyRotation = this.walkDirection * 0.06;
        }
        break;
      }
      case 'sleeping':
        targetY += calm ? 4 : 8 + Math.sin(t * 0.9) * 2;
        bodyScaleY = 0.96;
        this.zzz.alpha = 0.5 + Math.sin(t * 1.2) * 0.4;
        this.zzz.y = -120 - (calm ? 0 : Math.sin(t * 0.9) * 6);
        break;
      case 'happy':
        targetY += calm ? -2 : -Math.abs(Math.sin(t * 6)) * 14;
        break;
      case 'sad':
      case 'hungry':
        targetY += 6;
        bodyScaleY = 0.95;
        bodyRotation = calm ? 0 : Math.sin(t * 0.8) * 0.02;
        break;
      case 'eating':
        this.mouth.scale.y = 0.4 + Math.abs(Math.sin(t * 10)) * 0.7;
        targetY += calm ? 0 : Math.sin(t * 8) * 2;
        break;
      case 'talking':
        this.mouth.scale.y = 0.4 + Math.abs(Math.sin(t * 7)) * 0.7;
        targetY += calm ? 0 : Math.sin(t * 2.2) * 4;
        break;
      case 'typing':
        // Quick little bobs, like tapping away at the keys.
        targetY += calm ? 0 : Math.sin(t * 9) * 2;
        bodyRotation = calm ? 0 : Math.sin(t * 4.5) * 0.02;
        break;
      case 'celebrating':
        targetY += calm ? -4 : -Math.abs(Math.sin(t * 7)) * 18;
        bodyRotation = calm ? 0 : Math.sin(t * 9) * 0.08;
        if (!calm) {
          this.starCooldown -= dt;
          if (this.starCooldown <= 0) {
            this.burstStars(3);
            this.starCooldown = 0.35;
          }
        }
        break;
      case 'dragging':
        bodyScaleY = 1.06;
        bodyRotation = calm ? 0 : Math.sin(t * 12) * 0.05;
        break;
      case 'hidden':
        return;
    }

    if (this.state !== 'eating' && this.state !== 'talking') {
      this.mouth.scale.y = 1;
    }

    // Ease toward targets for smooth state changes.
    const ease = calm ? 1 : Math.min(1, dt * 8);
    this.x += (targetX - this.x) * ease;
    this.y += (targetY - this.y) * ease;
    this.body.rotation += (bodyRotation - this.body.rotation) * ease;
    this.face.rotation = this.body.rotation;
    this.body.scale.y += (bodyScaleY - this.body.scale.y) * ease;
    // The hoodie is worn on the body, so it follows the same sway.
    this.hoodie.rotation = this.body.rotation;
    this.hoodie.scale.y = this.body.scale.y;

    // Glow pulse.
    this.glow.alpha = calm ? 0.9 : 0.75 + Math.sin(t * 1.1) * 0.25;

    // Star particles.
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];
      star.life += dt;
      star.vy += 60 * dt;
      star.sprite.x += star.vx * dt;
      star.sprite.y += star.vy * dt;
      star.sprite.rotation += dt * 4;
      star.sprite.alpha = 1 - star.life / star.maxLife;
      if (star.life >= star.maxLife) {
        this.starLayer.removeChild(star.sprite);
        star.sprite.destroy();
        this.stars.splice(i, 1);
      }
    }
  }

  destroyPet(): void {
    for (const star of this.stars) {
      star.sprite.destroy();
    }
    this.stars.length = 0;
    this.destroy({ children: true });
  }
}
