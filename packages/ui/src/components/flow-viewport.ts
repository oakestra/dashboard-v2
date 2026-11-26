export interface FitOptions {
  /** Frame height bounds in px. */
  minHeight: number;
  maxHeight: number;
  /** Space around the graph in graph units. */
  padding?: number;
  /**
   * Smallest zoom the frame settles on. Below about 0.6 the node text is too small to read, so a
   * graph wider than the frame is shown at this zoom from its start, and the rest is a pan away.
   */
  minZoom?: number;
  maxZoom?: number;
  /** Screen px kept free below the graph, for controls drawn over the frame's bottom edge. */
  bottomInset?: number;
}

export interface ViewportFit {
  x: number;
  y: number;
  zoom: number;
  /** Height the frame should take, in px. */
  height: number;
}

export const MIN_READABLE_ZOOM = 0.6;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/**
 * Viewport and frame height for a laid-out graph in a frame of the given width. The height follows
 * the graph, so a flat graph gets a flat frame instead of a box of empty space. The graph is
 * centered when it fits; when it does not, it starts at its top left corner, where the first
 * column is (left to right) or the first row (top to bottom).
 *
 * `containerWidth` 0 means not measured yet (or no layout engine, as in jsdom): zoom 1.
 */
export function fitViewport(
  size: { width: number; height: number },
  containerWidth: number,
  {
    minHeight,
    maxHeight,
    padding = 24,
    minZoom = MIN_READABLE_ZOOM,
    maxZoom = 1,
    bottomInset = 0,
  }: FitOptions,
): ViewportFit {
  const paddedWidth = size.width + 2 * padding;
  const paddedHeight = size.height + 2 * padding;
  const zoom = containerWidth > 0 ? clamp(containerWidth / paddedWidth, minZoom, maxZoom) : maxZoom;
  const height = Math.round(
    clamp(paddedHeight * zoom + bottomInset, minHeight, Math.max(minHeight, maxHeight)),
  );
  const place = (frame: number, scaled: number, graph: number) =>
    scaled <= frame ? (frame - graph * zoom) / 2 : padding * zoom;
  return {
    x: containerWidth > 0 ? place(containerWidth, paddedWidth * zoom, size.width) : padding,
    y: place(height - bottomInset, paddedHeight * zoom, size.height),
    zoom,
    height,
  };
}
