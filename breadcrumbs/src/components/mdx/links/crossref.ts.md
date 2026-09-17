# crossref.ts

## 2026-09-16 — the allowlist is read off the schema, not written down

Every metadata registrar answers with "CSL-ish" JSON: the right idea, a
different vocabulary each. Crossref says `journal-article` where CSL says
`article-journal`, omits `id`, wraps scalars in single-element arrays, and
hangs `ORCID` / `affiliation` / `authenticated-orcid` / `role` / `sequence`
off every author. DataCite answers the same request with `copyright`, which is
not a CSL field at all.

The obvious shape is a denylist — delete the fields we know are wrong. That is
what needs revisiting every time a registrar adds a field, and the failure is
silent in the worst direction: `cslData.strict()` rejects the whole item, so
one unexpected key blanks a popover and a bibliography entry. This is exactly
how the original bug behaved.

So the legal field names are read off `cslData.shape` and `cslName.shape`
instead. An unrecognised field cannot fail the build because it is never
copied, and the allowlist cannot drift from the schema because there is only
one of them. `CONTRIBUTOR_FIELDS` is derived the same way — the fields that
accept a list of names are found by asking the schema, not by listing them.

`coerce` leans on the same idea for Crossref's single-element arrays: keep a
value if the schema takes it, otherwise retry the array's first element,
otherwise drop the field. No list of "fields that arrive wrapped" to maintain.

`toCsl` parses its own output through `cslData` before returning, so a caller
receives a valid item or an exception and never a half-normalised one. The
strict schema stays what makes an arbitrary third-party response safe to
trust — the transcription's whole justification, per `types.ts.md`.

Two smaller decisions. Crossref sends its own `URL` as the legacy
`http://dx.doi.org/…` alias; the address the author linked wins, because that
is what the reader clicks and what the bibliography prints. And `jatsToText`
is provisional: Crossref abstracts are JATS XML, and flattening them to text
is a placeholder for the shared HTML pipeline, which will sanitise and keep
the markup instead. citeproc must keep receiving text either way.

Not used: `@citation-js/plugin-doi`, which is already in `package.json` and
referenced nowhere. It does its own fetching with its own error model, costing
control of the "failures are never cached" rule, and it decorates output with
a `_graph` property that `.strict()` rejects — so it needs a cleaning pass
anyway, at which point it buys nothing for its weight.

## 2026-09-16 — the tables are Maps, because the keys are someone else's

Reading the allowlist off the schema closed the "unrecognised field" hole but
left a smaller one open underneath it: both lookups were plain objects indexed
by a registrar's string. `WORK_TYPES["toString"]` is
`Function.prototype.toString` — not the work type asked for, and not the
`undefined` that `?? coerce(…) ?? "document"` needs in order to fall through,
so the documented catch-all never ran. `cslData.shape["constructor"]` is the
`Object` constructor, which has no `.safeParse`, so `accepts` threw outright.

Neither broke a build — `resolveRemote` catches and the link becomes
`unresolved` — which is the point: this is the silent blanking the module
exists to prevent, arriving by a different door. `table()` names the rule once
and both tables use it; a Map has no prototype to inherit an answer from.

Two things the same pass fixed, both about the abstract:

The JATS heading was stripped with `/^\s*Abstract\s*/i`, which has no word
boundary, so "Abstraction is the key idea" became "ion is the key idea". `\b`
is the fix. "Abstract algebra" is still a false positive and can't be told
from a heading by prefix-matching alone — that goes away with the real parser,
not with a better regex.

And the flattening read `source.abstract` while the field it wrote was
`item.abstract`. Those differ exactly when `coerce` unwrapped an abstract the
registrar sent as `["<jats:p>…"]`, in which case raw JATS reached the popover
and citeproc untouched. Reading back from `item` is the fix, and it is the
general shape: once a value has been through `coerce`, `item` is the copy that
matters and `source` is history.
