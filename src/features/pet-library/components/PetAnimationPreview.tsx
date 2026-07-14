/**
 * Lightweight pixel-art animation preview: a CSS sprite strip advanced by
 * a small interval — no Pixi application per card. Static (frame 0) unless
 * `playing`, so idle gallery cost is zero.
 */
import { useEffect, useRef, useState } from 'react';

import { getSpriteUrl } from '../services/pet-asset-loader';
import type { PetAnimationDefinition, PetCharacterManifest } from '../types/pet-library.types';

interface PetAnimationPreviewProps {
  manifest: PetCharacterManifest;
  animation?: string;
  scale?: number;
  playing: boolean;
  className?: string;
}

export function PetAnimationPreview({
  manifest,
  animation = 'idle',
  scale = 3,
  playing,
  className,
}: PetAnimationPreviewProps) {
  const def: PetAnimationDefinition | undefined =
    manifest.animations[animation as keyof typeof manifest.animations] ?? manifest.animations.idle;
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    frameRef.current = 0;
    if (!playing || !def || def.frameCount <= 1) return;
    const interval = window.setInterval(
      () => {
        frameRef.current = (frameRef.current + 1) % def.frameCount;
        setFrame(frameRef.current);
      },
      Math.max(40, 1000 / def.frameRate)
    );
    return () => window.clearInterval(interval);
  }, [playing, def, animation]);

  if (!def) {
    return <div className={`pet-preview pet-preview-missing ${className ?? ''}`}>?</div>;
  }
  const url = getSpriteUrl(manifest.slug, def.asset);
  if (!url) {
    return <div className={`pet-preview pet-preview-missing ${className ?? ''}`}>?</div>;
  }

  const w = def.frameWidth * scale;
  const h = def.frameHeight * scale;
  return (
    <div
      className={`pet-preview ${className ?? ''}`}
      role="img"
      aria-label={`${manifest.name} ${def.name} animation`}
      style={{
        width: w,
        height: h,
        backgroundImage: `url("${url}")`,
        backgroundSize: `${def.frameCount * w}px ${h}px`,
        backgroundPosition: `${-(playing ? frame : 0) * w}px 0`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}
