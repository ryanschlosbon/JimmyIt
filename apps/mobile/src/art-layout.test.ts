import { describe, expect, it } from 'vitest';
import { getArtLayout } from './art-layout';
import { ART, ART_BRUSH_SIZES } from './design/tokens';

describe('art workspace with All games navigation', () => {
  it.each([1024, 800, 668, 600])('fits every desktop tool in a %i-pixel-high window', height => {
    const layout = getArtLayout(height, false, 12, ART_BRUSH_SIZES.length);
    expect(layout.toolsHeight).toBeLessThanOrEqual(layout.workspaceHeight);
    expect(layout.workspaceHeight + ART.viewportChromeHeight).toBeLessThanOrEqual(height);
    expect(layout.canvasHeight).toBeGreaterThanOrEqual(ART.canvasMinHeight);
  });

  it('keeps the reference two-column palette when enough height is available', () => {
    expect(getArtLayout(1024, false, 12, 8).toolColumns).toBe(2);
    expect(getArtLayout(800, false, 12, 8).toolColumns).toBe(3);
    expect(getArtLayout(668, false, 12, 8).toolColumns).toBe(4);
  });

  it('uses a wide palette on phones and preserves the minimum canvas on very short windows', () => {
    expect(getArtLayout(812, true, 12, 8).toolColumns).toBe(4);
    const short = getArtLayout(320, false, 12, 8);
    expect(short.canvasHeight).toBe(ART.canvasMinHeight);
    expect(short.toolsHeight).toBeLessThanOrEqual(short.workspaceHeight);
  });
});
