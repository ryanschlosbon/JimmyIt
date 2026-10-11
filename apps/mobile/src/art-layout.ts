import { ART, SIZE, SPACE } from './design/tokens';

/** Height of one tool panel (colors or brushes) laid out in `columns` columns. */
function panelHeight(count: number, columns: number): number {
  const rows = Math.ceil(count / columns);
  return rows * SIZE.touchTarget + (rows - 1) * SPACE.sm + SPACE.sm * 2 + ART.borderWidth * 2;
}

/** Width of a panel (or sidebar) holding `columns` touch targets. */
export function toolPanelWidth(columns: number): number {
  return columns * SIZE.touchTarget + (columns - 1) * SPACE.sm + SPACE.sm * 2 + ART.borderWidth * 2;
}

/**
 * Wide windows put the tools in a sidebar next to the canvas; tall ones put them in strips under it, so the canvas
 * keeps most of the screen either way.
 */
export function prefersArtSidebar(width: number, height: number): boolean {
  return width >= SIZE.compactWidth && width >= height * 0.9;
}

/**
 * The narrowest sidebar whose color and brush panels both fit in `toolsHeight` (the sidebar's height under its
 * All games button). Very short windows get the widest sidebar.
 */
export function getArtSidebar(toolsHeight: number, colorCount: number, brushCount: number) {
  const height = (columns: number) => panelHeight(colorCount, columns) + panelHeight(brushCount, columns) + SPACE.sm;
  const toolColumns = [2, 3, 4, 6].find(columns => height(columns) <= toolsHeight) ?? 6;
  return { toolColumns, sidebarWidth: toolPanelWidth(toolColumns), toolsHeight: height(toolColumns) };
}
