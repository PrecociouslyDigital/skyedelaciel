import type { ImageMetadata } from "astro";
import { getImage, inferRemoteSize } from "astro:assets";
import { drawnWidth, placement, sourceWidth, tooSmall } from "./geometry";
import { memoise } from "./memo";

/** The copy on this site, and its size in pixels. */
interface Copy {
    src: string;
    width: number;
    height: number;
}

/**
 * A popover's image, copied onto this site and placed by its shape. A column
 * image also carries the size it is drawn at, in CSS pixels, because the pane
 * is built around it. A banner is drawn at the stylesheet's size, and crops.
 */
export type PreviewImage =
    | (Copy & { placement: "banner" })
    | (Copy & {
          placement: "column";
          drawn: { width: number; height: number };
      });

/**
 * Images kept in the repository, for hand-written entries and fixtures. Such
 * an entry names one by its root-relative path, which is also this glob's key.
 */
const local = import.meta.glob<ImageMetadata>(
    "/src/assets/link-images/*.{avif,gif,jpeg,jpg,png,svg,webp}",
    { import: "default" },
);

/** The image as `getImage` takes it, and its full size. */
async function original(
    url: string,
): Promise<{ src: ImageMetadata | string; width: number; height: number }> {
    const load = local[url];
    if (load) {
        const src = await load();
        return { src, width: src.width, height: src.height };
    }
    return { src: url, ...(await inferRemoteSize(url)) };
}

/**
 * Copy a popover's image onto this site at the size its placement needs, so
 * that reading the popover requests nothing from anyone else. Each image is
 * copied once per build, however many times it is linked.
 */
export const placeImage = memoise(
    async (url): Promise<PreviewImage | undefined> => {
        try {
            const { src, width, height } = await original(url);
            if (tooSmall(width, height)) return undefined;
            const where = placement(width, height);
            const aspect = width / height;
            const scaled = Math.min(width, sourceWidth(where, aspect));
            const size = { width: scaled, height: Math.round(scaled / aspect) };
            const copy = {
                src: (await getImage({ src, ...size })).src,
                ...size,
            };
            if (where === "banner") return { placement: where, ...copy };
            const drawn = drawnWidth(where, aspect);
            return {
                placement: where,
                ...copy,
                drawn: { width: drawn, height: drawn / aspect },
            };
        } catch {
            // A missing image costs the popover its picture, never the build.
            return undefined;
        }
    },
);
