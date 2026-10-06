import { describe, expect, test } from "vitest";
import { everythingElse, isIn, type Piece } from "~/content/sections";
import { chance } from "~/layouts/prelude/chance.mjs";

const SECTIONS = ["fiction", "nonfiction", "fiction/novellas"];
const DAY = 24 * 60 * 60 * 1000;

/** A shelf of pieces across a few sections, and a section page's links. */
function shelf(seed: number) {
    const r = chance(seed);
    const pick = <T>(xs: T[]) => xs[r.integer(xs.length)]!;
    const pieces: Piece[] = Array.from({ length: 20 }, (_, n) => ({
        id: `${pick([...SECTIONS, "loose"])}/piece-${n}`,
        data: {
            published: new Date(Date.UTC(2026, 0, 1) + r.integer(30) * DAY),
        },
    }));
    const linked = pieces.filter(() => r.odds(0.4)).map(({ id }) => id);
    // Each written one of the ways a link can be, among links that name
    // nothing on the shelf.
    const links = linked
        .map((id) => pick([`/${id}`, `/${id}/`, `/${id}#part`, `/${id}?ref=1`]))
        .concat(["https://example.com/elsewhere", "#featured", "/missing"]);
    return { section: pick(SECTIONS), pieces, links, linked: new Set(linked) };
}

describe("everythingElse", () => {
    for (let seed = 0; seed < 200; seed++) {
        const { section, pieces, links, linked } = shelf(seed);
        const rest = everythingElse(section, links, pieces).map(({ id }) => id);
        const own = pieces
            .filter((piece) => isIn(section, piece.id))
            .map(({ id }) => id);

        test(`seed ${seed}: the linked and the rest are the section, once each`, () => {
            expect(rest.filter((id) => linked.has(id))).toEqual([]);
            expect(
                [...own.filter((id) => linked.has(id)), ...rest].sort(),
            ).toEqual(own.toSorted());
        });

        test(`seed ${seed}: the rest are latest first`, () => {
            const times = everythingElse(section, links, pieces).map(
                ({ data }) => data.published.getTime(),
            );
            expect(times).toEqual(times.toSorted((a, b) => b - a));
        });
    }
});
