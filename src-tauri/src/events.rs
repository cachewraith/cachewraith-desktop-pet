//! Central event-name constants shared between the tray, native code and
//! the React frontend. Keep in sync with `src/types/events.ts`.

pub const SHOW_PET: &str = "cachewraith://show-pet";
pub const HIDE_PET: &str = "cachewraith://hide-pet";
pub const FEED_PET: &str = "cachewraith://feed-pet";
pub const OPEN_CHAT: &str = "cachewraith://open-chat";
pub const RESET_POSITION: &str = "cachewraith://reset-position";
pub const TOGGLE_MUTE: &str = "cachewraith://toggle-mute";
pub const OPEN_SETTINGS_SECTION: &str = "cachewraith://open-settings-section";
pub const AUTOSTART_CHANGED: &str = "cachewraith://autostart-changed";
