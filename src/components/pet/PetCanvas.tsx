/**
 * Pixi host component. The Application is created exactly once per mount;
 * character switches swap textures inside the single PixelPetController.
 * Animation is driven entirely by the Pixi ticker, never by React renders.
 */
import { useEffect, useRef } from 'react';
import { Application, Ticker } from 'pixi.js';

import type { PetStateName } from '../../features/pet/pet.types';
import { logger } from '../../utils/logger';
import { PixelPetController } from './pixelPet';

interface PetCanvasProps {
  petId: string;
  petState: PetStateName;
  reducedMotion: boolean;
  width: number;
  height: number;
}

export function PetCanvas({ petId, petState, reducedMotion, width, height }: PetCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<PixelPetController | null>(null);
  const appRef = useRef<Application | null>(null);
  const latestProps = useRef({ petId, petState, reducedMotion });
  useEffect(() => {
    latestProps.current = { petId, petState, reducedMotion };
  }, [petId, petState, reducedMotion]);

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
          antialias: false,
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

      const controller = new PixelPetController(width / 2, height - 24);
      controllerRef.current = controller;
      app.stage.addChild(controller);
      // Apply any props that changed while the renderer was initializing.
      controller.setReducedMotion(latestProps.current.reducedMotion);
      controller.setPetState(latestProps.current.petState);
      void controller.setCharacter(latestProps.current.petId);

      app.ticker.add((ticker: Ticker) => {
        controller.update(ticker.deltaMS / 1000);
      });
    })();

    return () => {
      destroyed = true;
      const currentApp = appRef.current;
      appRef.current = null;
      if (controllerRef.current) {
        controllerRef.current.destroyController();
        controllerRef.current = null;
      }
      if (currentApp) {
        currentApp.destroy(true, { children: true });
      }
    };
    // Width/height are fixed for the lifetime of the pet window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Character swap without recreating the Application.
  useEffect(() => {
    void controllerRef.current?.setCharacter(petId);
  }, [petId]);

  // Push state changes into the controller without re-creating anything.
  useEffect(() => {
    controllerRef.current?.setPetState(petState);
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
    controllerRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return <div ref={hostRef} className="pet-canvas" aria-hidden="true" />;
}
