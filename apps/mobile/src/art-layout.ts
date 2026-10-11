import { ART, SIZE, SPACE } from './design/tokens';

/** Reserves room for navigation as well as every color and brush target in the drawing sidebar. */
export function getArtLayout(height: number, compact: boolean, colorCount: number, brushCount: number) {
  const workspaceHeight = Math.max(ART.canvasMinHeight + ART.titleHeight + ART.actionHeight + SPACE.sm * 2,
    height - ART.viewportChromeHeight);
  const panelHeight = (count: number, columns: number) => {
    const rows = Math.ceil(count / columns);
    return rows * SIZE.touchTarget + (rows - 1) * SPACE.sm + SPACE.sm * 2 + ART.borderWidth * 2;
  };
  const toolsHeight = (columns: number) => panelHeight(colorCount, columns) + panelHeight(brushCount, columns)
    + SIZE.touchTarget + SPACE.sm * 2;
  const toolColumns = compact ? 4 : [2, 3, 4].find(columns => toolsHeight(columns) <= workspaceHeight) ?? 4;
  return {
    canvasHeight: workspaceHeight - ART.titleHeight - ART.actionHeight - SPACE.sm * 2,
    sidebarWidth: toolColumns * SIZE.touchTarget + (toolColumns - 1) * SPACE.sm + SPACE.sm * 2 + ART.borderWidth * 2,
    toolColumns,
    toolsHeight: toolsHeight(toolColumns),
    workspaceHeight,
  };
}
