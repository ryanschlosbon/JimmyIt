import { describe, expect, it } from 'vitest';
import { getArtSidebar, prefersArtSidebar, toolPanelWidth } from './art-layout';
import { ART_BRUSH_SIZES, SIZE } from './design/tokens';

describe('art workspace that fits the screen', () => {
  it('puts the tools beside the canvas on wide windows and under it on tall ones', () => {
    expect(prefersArtSidebar(1333, 620)).toBe(true); // tablet landscape
    expect(prefersArtSidebar(1280, 800)).toBe(true);
    expect(prefersArtSidebar(800, 1150)).toBe(false); // tablet portrait
    expect(prefersArtSidebar(375, 700)).toBe(false); // phone
  });

  it('uses the narrowest sidebar whose panels fit the height', () => {
    expect(getArtSidebar(900, 12, ART_BRUSH_SIZES.length).toolColumns).toBe(2);
    expect(getArtSidebar(620, 12, 8).toolColumns).toBe(3);
    expect(getArtSidebar(460, 12, 8).toolColumns).toBe(4);
    expect(getArtSidebar(300, 12, 8).toolColumns).toBe(6);
  });

  it('always fits the chosen panels when there is room for them', () => {
    for (const height of [300, 460, 620, 900]) {
      const sidebar = getArtSidebar(height, 12, 8);
      if (sidebar.toolColumns < 6) expect(sidebar.toolsHeight).toBeLessThanOrEqual(height);
      expect(sidebar.sidebarWidth).toBe(toolPanelWidth(sidebar.toolColumns));
      expect(sidebar.sidebarWidth).toBeGreaterThanOrEqual(sidebar.toolColumns * SIZE.touchTarget);
    }
  });
});
