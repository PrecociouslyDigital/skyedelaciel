import { describe, expect, test } from "vitest";
import { totp } from "../../tools/totp.mjs";

/** RFC 6238's SHA-1 key, the ASCII "12345678901234567890", in base32. */
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

/**
 * RFC 6238, Appendix B, SHA-1: seconds since the epoch, and the last six of
 * the eight digits it lists, since a six-digit code is the same number cut
 * shorter.
 */
const VECTORS = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
] as const;

describe("totp", () => {
    test.each(VECTORS)("at %is is %s", (seconds, code) => {
        expect(totp(SECRET, seconds * 1000)).toBe(code);
    });

    test("reads a secret however it is written", () => {
        const spaced = SECRET.toLowerCase().replace(/.{4}/g, "$& ");
        for (const [seconds] of VECTORS) {
            expect(totp(spaced, seconds * 1000)).toBe(
                totp(SECRET, seconds * 1000),
            );
        }
    });

    test("holds a code for its whole 30-second step", () => {
        expect(totp(SECRET, 60_000)).toBe(totp(SECRET, 89_999));
        expect(totp(SECRET, 60_000)).not.toBe(totp(SECRET, 90_000));
    });
});
