/**
 * Compact interaction menu shown after a right-click on the pet.
 */
interface PetMenuProps {
  sleeping: boolean;
  onFeed: () => void;
  onPet: () => void;
  onSlap: () => void;
  onTalk: () => void;
  onToggleSleep: () => void;
  onOpenSettings: () => void;
  onHide: () => void;
  onClose: () => void;
}

export function PetMenu({
  sleeping,
  onFeed,
  onPet,
  onSlap,
  onTalk,
  onToggleSleep,
  onOpenSettings,
  onHide,
  onClose,
}: PetMenuProps) {
  const item = (label: string, action: () => void) => (
    <button
      type="button"
      className="pet-menu-item"
      onClick={() => {
        action();
        onClose();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="pet-menu" role="menu" aria-label="Pet interactions">
      {item('🍬 Feed', onFeed)}
      {item('💜 Pet', onPet)}
      {item('👋 Slap', onSlap)}
      {item('💬 Talk', onTalk)}
      {item(sleeping ? '☀️ Wake up' : '🌙 Sleep', onToggleSleep)}
      {item('⚙️ Settings', onOpenSettings)}
      {item('👻 Hide', onHide)}
    </div>
  );
}
