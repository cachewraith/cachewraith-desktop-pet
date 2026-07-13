/**
 * Tiny logging utility. Verbose output only in development; never log
 * secrets or full conversation contents.
 */
const isDev = import.meta.env.DEV;

type LogValue = unknown;

export const logger = {
  debug(scope: string, message: string, detail?: LogValue): void {
    if (isDev) {
      console.debug(`[cachewraith:${scope}] ${message}`, detail ?? '');
    }
  },
  info(scope: string, message: string, detail?: LogValue): void {
    if (isDev) {
      console.info(`[cachewraith:${scope}] ${message}`, detail ?? '');
    }
  },
  warn(scope: string, message: string, detail?: LogValue): void {
    console.warn(`[cachewraith:${scope}] ${message}`, detail ?? '');
  },
  error(scope: string, message: string, detail?: LogValue): void {
    console.error(`[cachewraith:${scope}] ${message}`, detail ?? '');
  },
};
