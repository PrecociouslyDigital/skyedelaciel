export type LinkKind = "internal" | "doi" | "wikipedia" | "external";

/** Minimal CSL-JSON shape for the fields we populate. */
export interface CslData {
    type: string;
    id: string;
    URL: string;
    title?: string;
    "container-title"?: string;
    author?: { family?: string; given?: string }[];
    issued?: { "date-parts": number[][] };
    accessed?: { "date-parts": number[][] };
}

export interface LinkEntry {
    csl: CslData;
    kind: LinkKind;
    summary?: string;
    imageUrl?: string;
}
