import type { CslData } from "./types";
import { cslData, cslName } from "./types";

/**
 * Registrars answer with "CSL-ish" JSON — the right shape, but not quite
 * CSL's vocabulary. Rather than hand-listing which fields to strip, this
 * module reads the legal field names off `cslData` and `cslName`, so an
 * unrecognised field is dropped instead of failing the strict schema.
 */

/**
 * A lookup table keyed by whatever a registrar happened to send. A plain
 * object answers `toString` with a method off `Object.prototype` — neither the
 * entry we asked for nor the `undefined` that the `??` fallbacks below rely
 * on — so every table read with a registrar's string is a Map.
 */
const table = <V>(entries: Record<string, V>): ReadonlyMap<string, V> =>
    new Map(Object.entries(entries));

/** Work types as the registrars spell them, mapped onto CSL's vocabulary. */
const WORK_TYPES = table<CslData["type"]>({
    "journal-article": "article-journal",
    "proceedings-article": "paper-conference",
    "book-chapter": "chapter",
    "book-part": "chapter",
    "book-section": "chapter",
    "posted-content": "article",
    preprint: "article",
    "journal-issue": "periodical",
    "journal-volume": "periodical",
    journal: "periodical",
    monograph: "book",
    "edited-book": "book",
    "reference-book": "book",
    dissertation: "thesis",
    "peer-review": "review",
    "report-component": "report",
    component: "document",
    other: "document",
});

/** The schema CSL gives each field it knows, by name. */
const FIELD_SCHEMAS = table(cslData.shape);

/** Whether the schema will take this value for this field. */
const accepts = (field: string, value: unknown): boolean =>
    FIELD_SCHEMAS.get(field)?.safeParse(value).success ?? false;

/** The fields that take a list of names, according to the schema. */
const CONTRIBUTOR_FIELDS = new Set(
    [...FIELD_SCHEMAS.keys()].filter((field) =>
        accepts(field, [{ family: "x" }]),
    ),
);

/**
 * Keep one field if the schema will have it. A registrar that sends a scalar
 * as a single-element array — `title: ["…"]` — gets unwrapped rather than
 * dropped; anything the schema still refuses is given up on.
 */
function coerce(field: string, value: unknown): unknown {
    if (accepts(field, value)) return value;
    const [first] = Array.isArray(value) ? value : [];
    return first !== undefined && accepts(field, first) ? first : undefined;
}

/** Strip a name down to the fields CSL knows, keeping an organisation's. */
const toCslName = (raw: unknown): unknown => {
    if (typeof raw !== "object" || raw === null) return undefined;
    const source = raw as Record<string, unknown>;
    const name = Object.fromEntries(
        Object.keys(cslName.shape)
            .filter((field) => field in source)
            .map((field) => [field, source[field]]),
    );
    // Crossref names a corporate author with `name` where CSL uses `literal`.
    if (!("literal" in name) && typeof source.name === "string")
        name.literal = source.name;
    return Object.keys(name).length > 0 ? name : undefined;
};

/**
 * Crossref sends abstracts as JATS XML; citeproc and the popover want text.
 *
 * Provisional: to be replaced by the shared HTML pipeline. See the breadcrumb.
 */
export const jatsToText = (jats: string): string =>
    jats
        .replace(/<[^>]*>/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, code: string) =>
            String.fromCodePoint(Number(code)),
        )
        .replace(/\s+/g, " ")
        // The <jats:title>Abstract</jats:title> heading, now flattened to its
        // own word. `\b` is what keeps "Abstraction is…" from losing its first
        // three letters to the same rule.
        .replace(/^\s*Abstract\b[:.]?\s*/i, "")
        .trim();

/** Normalise a registrar's answer into CSL-JSON, or throw if it still won't parse. */
export function toCsl(raw: unknown, url: string): CslData {
    if (typeof raw !== "object" || raw === null)
        throw new Error(`not a metadata object: ${url}`);
    const source = raw as Record<string, unknown>;

    const item: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(source)) {
        if (value === undefined || value === null) continue;

        const cleaned = CONTRIBUTOR_FIELDS.has(field)
            ? (Array.isArray(value) ? value : [value])
                  .map(toCslName)
                  .filter((name) => name !== undefined)
            : value;

        const kept = coerce(field, cleaned);
        if (kept !== undefined) item[field] = kept;
    }

    const type = typeof source.type === "string" ? source.type : "";
    item.type = WORK_TYPES.get(type) ?? coerce("type", type) ?? "document";

    // CSL requires an id; the registrars do not supply one consistently.
    item.id ??= typeof source.DOI === "string" ? source.DOI : url;
    // The author's URL wins over Crossref's own dx.doi.org alias.
    item.URL = url;

    // Read back from `item`: `coerce` unwraps an abstract the registrar sent
    // as a single-element array, and that copy is the one that gets rendered.
    if (typeof item.abstract === "string") {
        const abstract = jatsToText(item.abstract);
        if (abstract) item.abstract = abstract;
        else delete item.abstract;
    }

    return cslData.parse(item);
}
