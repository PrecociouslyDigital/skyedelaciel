import type { AstroComponentFactory } from "astro/runtime/server/render/astro/factory";

import H1 from "./heading/H1.astro";
import H2 from "./heading/H2.astro";
import H3 from "./heading/H3.astro";
import H4 from "./heading/H4.astro";
import H5 from "./heading/H5.astro";
import H6 from "./heading/H6.astro";
import Link from "./links/Link.astro";

/** Global MDX component overrides, passed to <Content /> in the dynamic route. */
export const mdxComponents: Record<string, AstroComponentFactory> = {
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    h6: H6,
    a: Link,
};
