/**
 * The popover's measurements, in rem. The stylesheet reads them from here, so
 * the boxes an image is placed by are the boxes it is drawn in.
 */
const PANE_WIDTH = 26;
export const MAX_HEIGHT = 16;

/**
 * The most a column image may take. A pane with one is exactly as tall as its
 * image, plus the glass's inset above and below it, so the image runs from top
 * to bottom whole. It stops a rem short of the pane's cap to leave room for
 * that inset.
 */
const COLUMN_WIDTH = 9;
const COLUMN_HEIGHT = MAX_HEIGHT - 1;

/**
 * A banner at rest, and what it gives way to as the text below it scrolls. It
 * gives up less than a third of itself, so the pane keeps its picture.
 */
export const BANNER_HEIGHT = 7.5;
export const BANNER_MIN_HEIGHT = 5.25;

/** A pane with a banner is taller, so the banner doesn't crowd the text. */
const BANNERED_MAX_HEIGHT = 20;

/** The same measurements as custom properties, for the pane's style. */
export const geometryStyle = {
    "--pane-width": `${PANE_WIDTH}rem`,
    "--max-height": `${MAX_HEIGHT}rem`,
    "--banner-height": `${BANNER_HEIGHT}rem`,
    "--banner-min-height": `${BANNER_MIN_HEIGHT}rem`,
    "--bannered-max-height": `${BANNERED_MAX_HEIGHT}rem`,
};

/** Where a popover's image goes: down its right edge, or across its top. */
export type Placement = "column" | "banner";

/**
 * How an image meets its box: shrunk to fit inside it whole, or cropped to
 * fill it.
 */
type Fit = "contain" | "cover";

export interface Box {
    width: number;
    height: number;
    fit: Fit;
}

/**
 * The largest box each placement gives an image. A column shows the image
 * whole, and the pane takes the height of what it draws. A banner runs the
 * full width at its resting height, and crops.
 */
export const boxes: Readonly<Record<Placement, Box>> = {
    column: { width: COLUMN_WIDTH, height: COLUMN_HEIGHT, fit: "contain" },
    banner: { width: PANE_WIDTH, height: BANNER_HEIGHT, fit: "cover" },
};

export const boxAspect = (where: Placement): number =>
    boxes[where].width / boxes[where].height;

/**
 * How well an image's shape suits a box, from 0 to 1. Cropped to cover the
 * box, it is the share of the image kept; shrunk to fit inside, it is the
 * share of the box filled. Both come to the same ratio of the two shapes, so
 * one measure compares a cropping placement with one that doesn't crop.
 */
export const suitability = (imageAspect: number, box: number): number =>
    Math.min(imageAspect, box) / Math.max(imageAspect, box);

/**
 * The image aspect ratio that suits both placements equally. `suitability` falls
 * off in proportion on either side of a box's own aspect, so the two curves
 * cross at the geometric mean of the boxes' aspects.
 */
export const crossover = Math.sqrt(boxAspect("column") * boxAspect("banner"));

/**
 * The placement that suits an image of this size better: the column for one
 * that would leave less of it empty, the banner for one it would crop less.
 */
export const placement = (width: number, height: number): Placement =>
    width / height < crossover ? "column" : "banner";

/** Pixels per rem, at the browser's default root size, which the site keeps. */
export const REM = 16;

/** Device pixels per CSS pixel that a copy should hold up at. */
export const DENSITY = 2;

/**
 * How wide, in CSS pixels, an image is drawn in its box. Cropped to cover, a
 * wide image is sized by the box's height, so its width overhangs. Shrunk to
 * fit, a tall image is sized by the box's height, so its width falls short.
 */
export function drawnWidth(where: Placement, imageAspect: number): number {
    const { width, height, fit } = boxes[where];
    const fitted = fit === "cover" ? Math.max : Math.min;
    return REM * fitted(width, height * imageAspect);
}

/** The width, in pixels, to scale an image to for its box. */
export const sourceWidth = (where: Placement, imageAspect: number): number =>
    Math.ceil(DENSITY * drawnWidth(where, imageAspect));

/**
 * Whether an image is too small to fill its box without being enlarged. Such
 * an image is an icon or a logo rather than a picture of the page, and blown
 * up it is only a blur.
 */
export const tooSmall = (width: number, height: number): boolean =>
    width < drawnWidth(placement(width, height), width / height);
