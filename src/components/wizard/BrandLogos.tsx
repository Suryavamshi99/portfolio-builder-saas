/** Small brand marks for the generation-method cards. Swap in the official SVG files if you prefer exact artwork. */
export function ClaudeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Claude" role="img">
      <g fill="#D97757">
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x="11" y="1.5" width="2" height="9" rx="1" transform={`rotate(${i * 36} 12 12)`} />
        ))}
      </g>
    </svg>
  );
}

export function ChatGPTLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="ChatGPT" role="img" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
      {Array.from({ length: 6 }).map((_, i) => (
        <path key={i} d="M12 2.8 18.4 6.5v4.2L12 7.6 8.5 9.6" transform={`rotate(${i * 60} 12 12)`} />
      ))}
    </svg>
  );
}
