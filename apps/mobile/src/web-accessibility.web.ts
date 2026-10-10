export function setupWebAccessibility(dark: boolean): () => void {
  const style = document.createElement('style');
  style.textContent = `
    html, body, #root { height: 100%; }
    body { margin: 0; }
    #drawing-canvas { touch-action: none; cursor: crosshair; }
    [role="button"]:focus-visible, [role="switch"]:focus-visible, a:focus-visible {
      outline: 3px solid ${dark ? '#FFD844' : '#9A6E00'} !important; outline-offset: 4px;
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
    }
  `;
  document.head.appendChild(style);
  document.title = 'Jimmy — a little play, a lot of possibility';
  document.documentElement.lang = 'en';
  return () => style.remove();
}
