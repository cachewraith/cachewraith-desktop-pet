/**
 * Pixi host component. The Application is created exactly once per mount;
 * animation is driven entirely by the Pixi ticker, never by React renders.
 */
import { useEffect, useRef } from 'react';
import { Application, Ticker } from 'pixi.js';

import type { PetStateName } from '../../features/pet/pet.types';
import { logger } from '../../utils/logger';
import { GhostPet } from './ghost';

interface PetCanvasProps {
  petState: PetStateName;
  reducedMotion: boolean;
  width: number;
  height: number;
}

export function PetCanvas({ petState, reducedMotion, width, height }: PetCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<GhostPet | null>(null);
  const appRef = useRef<Application | null>(null);
  const latestProps = useRef({ petState, reducedMotion });
  useEffect(() => {
    latestProps.current = { petState, reducedMotion };
  }, [petState, reducedMotion]);

  // Create the Pixi application once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let destroyed = false;
    const app = new Application();

    (async () => {
      try {
        await app.init({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });
      } catch (error) {
        logger.error('pixi', 'failed to initialize renderer', error);
        return;
      }
      if (destroyed) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      host.appendChild(app.canvas);

      const ghost = new GhostPet(width / 2, height - 70);
      ghostRef.current = ghost;
      app.stage.addChild(ghost);
      // Apply any props that changed while the renderer was initializing.
      ghost.setPetState(latestProps.current.petState);
      ghost.setReducedMotion(latestProps.current.reducedMotion);

      app.ticker.add((ticker: Ticker) => {
        ghost.update(ticker.deltaMS / 1000);
      });
    })();

    return () => {
      destroyed = true;
      const currentApp = appRef.current;
      appRef.current = null;
      if (ghostRef.current) {
        ghostRef.current.destroyPet();
        ghostRef.current = null;
      }
      if (currentApp) {
        currentApp.destroy(true, { children: true });
      }
    };
    // Width/height are fixed for the lifetime of the pet window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push state changes into the ghost without re-creating anything.
  useEffect(() => {
    ghostRef.current?.setPetState(petState);
    const app = appRef.current;
    if (app) {
      // Pause rendering entirely while hidden to save CPU.
      if (petState === 'hidden') {
        app.ticker.stop();
      } else if (!app.ticker.started) {
        app.ticker.start();
      }
    }
  }, [petState]);

  useEffect(() => {
    ghostRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return <div ref={hostRef} className="pet-canvas" aria-hidden="true" />;
}
