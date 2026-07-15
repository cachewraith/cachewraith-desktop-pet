/**
 * Central Tauri event names shared between the tray, Rust and React.
 * Keep in sync with `src-tauri/src/events.rs`.
 */
export const AppEvents = {
  showPet: 'cachewraith://show-pet',
  hidePet: 'cachewraith://hide-pet',
  feedPet: 'cachewraith://feed-pet',
  openChat: 'cachewraith://open-chat',
  resetPosition: 'cachewraith://reset-position',
  toggleMute: 'cachewraith://toggle-mute',
  openSettingsSection: 'cachewraith://open-settings-section',
  autostartChanged: 'cachewraith://autostart-changed',
  petStateChanged: 'cachewraith://pet-state-changed',
  petProfileChanged: 'cachewraith://pet-profile-changed',
  activePetChanged: 'cachewraith://active-pet-changed',
  /** JS-to-JS only: the companion pet list changed (payload: string[]). */
  companionsChanged: 'cachewraith://companions-changed',
  petSizeChanged: 'cachewraith://pet-size-changed',
  soundVolumeChanged: 'cachewraith://sound-volume-changed',
  /** Emitted by Rust while the user is typing anywhere (activity only, no keys). */
  userTyping: 'cachewraith://user-typing',
} as const;

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];
