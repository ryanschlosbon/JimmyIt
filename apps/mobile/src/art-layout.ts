import { ART, SIZE, SPACE } from './design/tokens';

/** Reserves room for navigation as well as every color and brush target in the drawing sidebar. */
export function getArtLayout(height: number, compact: boolean, colorCount: number, brushCount: number) {
  const panelHeight = (count: number, columns: number) => {
    const rows = Math.ceil(count / columns);
    return rows * SIZE.touchTarget + (rows - 1) * SPACE.sm + SPACE.sm * 2 + ART.borderWidth * 2;
  };
  const toolsHeight = (columns: number) => panelHeight(colorCount, columns) + panelHeight(brushCount, columns)
    + SPACE.sm;
  const workspaceHeight = Math.max(Math.max(ART.canvasMinHeight, toolsHeight(6))
    + ART.titleHeight + ART.actionHeight + SPACE.sm * 2, height - ART.viewportChromeHeight);
  const canvasHeight = workspaceHeight - ART.titleHeight - ART.actionHeight - SPACE.sm * 2;
  const toolColumns = compact ? 4 : [2, 3, 4, 6].find(columns => toolsHeight(columns) <= canvasHeight) ?? 6;
  return {
    canvasHeight,
    sidebarWidth: toolColumns * SIZE.touchTarget + (toolColumns - 1) * SPACE.sm + SPACE.sm * 2 + ART.borderWidth * 2,
    toolColumns,
    toolsHeight: toolsHeight(toolColumns),
    workspaceHeight,
  };
}
