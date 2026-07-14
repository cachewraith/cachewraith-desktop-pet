/**
 * Application-wide pixel-art configuration for PixiJS. Imported once from
 * main.tsx before any texture is created so every sprite uses sharp
 * nearest-neighbor scaling.
 */
import { AbstractRenderer, TextureSource } from 'pixi.js';

export function configurePixelArt(): void {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  // Snap sprite positions to whole device pixels to avoid shimmering.
  AbstractRenderer.defaultOptions.roundPixels = true;
}
