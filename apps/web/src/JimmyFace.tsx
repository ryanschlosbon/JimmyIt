// Browser rendering of Jimmy's face from apps/mobile/src/components/Jimmy.tsx (the `face` drawing).
// Keep the paths aligned with the mobile component when its artwork changes.
export function JimmyFace({ size, color }: { readonly size: number; readonly color: string }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block' }}>
    <circle cx="50" cy="50" r="50" fill={color} />
    <g stroke="#7A0B5A" strokeWidth="1.3" fill="none">
      <circle cx="28.8" cy="45.6" r="13.3" /><circle cx="71.4" cy="45.6" r="13.3" />
    </g>
    <ellipse cx="32" cy="45.6" rx="10.4" ry="12.1" fill="#7A0B5A" />
    <ellipse cx="74.6" cy="45.6" rx="10.4" ry="12.1" fill="#7A0B5A" />
    <path d="M32.6 68.2Q41 78.6 52 75.2Q58.4 72.6 61.6 64.4" fill="none" stroke="#7A0B5A" strokeWidth="1.4" />
    <path d="M61.6 64.4Q72.4 68.4 73.2 74.4Q73.6 80.6 64.4 80.6Q57.4 80.4 50.8 75.6" fill="none"
      stroke="#7A0B5A" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>;
}
