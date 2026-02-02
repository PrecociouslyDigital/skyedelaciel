export type { Data as CslData } from "csl-json";

export type LinkKind = "internal" | "doi" | "wikipedia" | "external";

export interface LinkEntry {
    csl: import("csl-json").Data;
    kind: LinkKind;
    summary?: string;
    imageUrl?: string;
}

