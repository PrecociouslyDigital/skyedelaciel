//@ts-expect-error
import type { AstroComponentFactory } from "astro/runtime/server/render/astro/factory";

import H1 from "./heading/H1.astro";
import H2 from "./heading/H2.astro";
import H3 from "./heading/H3.astro";
import H4 from "./heading/H4.astro";
import H5 from "./heading/H5.astro";
import H6 from "./heading/H6.astro";
import Link from "./links/Link.astro";
import Sidenote from "./Sidenote.astro";
import Term from "./Term.astro";
import Statement from "./Statement.astro";
import Figure from "./figures/Figure.astro";
import CodeFigure from "./figures/CodeFigure.astro";
import TableFigure from "./figures/TableFigure.astro";
import type { Written } from "./written";

/**
 * Global MDX component overrides, passed to <Content /> in the dynamic route:
 * the elements markdown renders, and every component a remark plugin writes.
 */
export const mdxComponents = {
    h1: H1,
    h2: H2,
    h3: H3,
    h4: H4,
    h5: H5,
    h6: H6,
    a: Link,
    Sidenote,
    Figure,
    TableFigure,
    CodeFigure,
    Term,
    Statement,
} satisfies Record<
    "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "a" | keyof Written,
    AstroComponentFactory
>;
