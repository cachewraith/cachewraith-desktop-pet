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
  petSizeChanged: 'cachewraith://pet-size-changed',
} as const;

export type AppEventName = (typeof AppEvents)[keyof typeof AppEvents];
