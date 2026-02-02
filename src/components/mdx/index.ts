import type { AstroComponentFactory } from "astro/runtime/server/render/astro/factory";

/** Global MDX component overrides, passed to <Content /> in the dynamic route. */
export const mdxComponents: Record<string, AstroComponentFactory> = {};
