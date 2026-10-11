// Browser rendering of the four illustrations in apps/mobile/src/components/GameArt.tsx.
// Keep their paths aligned with the mobile shelf when its artwork changes.
export type MobileGameArtName = 'stopwatch' | 'target' | 'brush' | 'shapes';

export function MobileGameArt({ name, ink, accent, shadow }: {
  readonly name: MobileGameArtName;
  readonly ink: string;
  readonly accent: string;
  readonly shadow: string;
}) {
  const line = { stroke: ink, strokeWidth: 5, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, fill: 'none' };
  return <svg className="shelf-art" viewBox="0 0 100 100" aria-hidden="true">
    {name === 'stopwatch' && <>
      <ellipse cx="58" cy="90" rx="30" ry="3.2" fill={shadow} />
      <g transform="rotate(-8 45 58)">
        <circle cx="45" cy="58" r="29" {...line} />
        <line x1="52" y1="30" x2="55.5" y2="22" {...line} />
        <line x1="47.5" y1="19.5" x2="63.5" y2="26" {...line} />
        <line x1="70" y1="43" x2="77" y2="39.5" {...line} />
        <line x1="74.5" y1="35" x2="79.5" y2="45.5" {...line} />
        <line x1="45" y1="58" x2="51" y2="43" {...line} />
        <line x1="45" y1="58" x2="57" y2="63" {...line} />
      </g>
    </>}
    {name === 'target' && <>
      <ellipse cx="50" cy="90" rx="30" ry="3.2" fill={shadow} />
      <circle cx="42" cy="56" r="27" {...line} />
      <circle cx="42" cy="56" r="16" fill={accent} stroke={ink} strokeWidth="5" />
      <circle cx="42" cy="56" r="5" fill={ink} />
      <g transform="rotate(40 66 30)">
        <rect x="60" y="2" width="12" height="44" rx="6" {...line} />
        <line x1="60" y1="14" x2="72" y2="14" {...line} />
        <polygon points="60,46 72,46 66,58" {...line} />
      </g>
      <path d="M80 54l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5Z" fill={accent}
        stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />
    </>}
    {name === 'brush' && <>
      <ellipse cx="50" cy="90" rx="32" ry="3.2" fill={shadow} />
      <path d="M12 70c10-12 18-12 24-4s14 8 24-6" stroke={accent} strokeWidth="9" strokeLinecap="round" fill="none" />
      <g transform="rotate(38 62 40)">
        <rect x="56" y="4" width="12" height="40" rx="6" {...line} />
        <rect x="54" y="44" width="16" height="9" rx="2" fill={ink} />
        <path d="M54 53h16c0 12-3 20-8 24-5-4-8-12-8-24Z" fill={accent} stroke={ink}
          strokeWidth="5" strokeLinejoin="round" />
      </g>
    </>}
    {name === 'shapes' && <>
      <ellipse cx="50" cy="90" rx="34" ry="3.2" fill={shadow} />
      <circle cx="32" cy="58" r="20" stroke={ink} strokeWidth="5" strokeDasharray="7 7"
        strokeLinecap="round" fill="none" />
      <rect x="56" y="14" width="30" height="30" rx="7" fill={accent} stroke={ink} strokeWidth="5"
        transform="rotate(12 71 29)" />
      <polygon points="68,52 86,80 50,80" fill="none" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
    </>}
  </svg>;
}
