/**
 * Pixel-art laptop the pet "types on" during the typing state. Drawn as an
 * inline SVG on a 32x22 pixel grid so it stays crisp at any scale.
 *
 * Seen from behind: the pet sits on the far side facing us, so we see the
 * back of the lid with a glowing logo, screen light spilling around the
 * edges, and a sliver of the keyboard deck past the lid. All animation is
 * disabled via CSS when reduced motion is on.
 */
export function PixelLaptop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <div
      className={reducedMotion ? 'pet-laptop pet-laptop-still' : 'pet-laptop'}
      aria-hidden="true"
    >
      <svg
        className="pixel-laptop"
        viewBox="0 0 32 22"
        shapeRendering="crispEdges"
        role="presentation"
      >
        {/* Screen light spilling over the top and sides of the lid,
            flickering as "text" appears on the far side. */}
        <rect x="5" y="0" width="22" height="1" fill="#9fe8ff" className="px-glow" />
        <rect x="4" y="1" width="1" height="14" fill="#9fe8ff" opacity="0.5" className="px-glow" />
        <rect x="27" y="1" width="1" height="14" fill="#9fe8ff" opacity="0.5" className="px-glow" />

        {/* Back of the lid */}
        <rect x="5" y="1" width="22" height="15" fill="#454b6e" />
        <rect x="6" y="2" width="20" height="13" fill="#3a3f61" />

        {/* Little ghost logo on the lid, pulsing with the glow */}
        <rect x="14" y="6" width="4" height="3" fill="#bfa8ff" className="px-logo" />
        <rect x="14" y="9" width="1" height="1" fill="#bfa8ff" className="px-logo" />
        <rect x="16" y="9" width="1" height="1" fill="#bfa8ff" className="px-logo" />

        {/* Keyboard deck sticking out past the lid toward the pet */}
        <rect x="2" y="16" width="28" height="4" fill="#454b6e" />
        <rect x="2" y="16" width="28" height="1" fill="#5a6188" />
        <rect x="2" y="20" width="28" height="1" fill="#23284a" />
      </svg>
    </div>
  );
}
