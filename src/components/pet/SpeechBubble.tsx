interface SpeechBubbleProps {
  text: string | null;
}

/** Rounded speech bubble shown above the pet for a few seconds. */
export function SpeechBubble({ text }: SpeechBubbleProps) {
  if (!text) return null;
  return (
    <div className="speech-bubble" role="status" aria-live="polite">
      {text}
      <span className="speech-bubble-tail" aria-hidden="true" />
    </div>
  );
}
