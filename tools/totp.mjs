// @ts-check
/**
 * The six-digit code an authenticator app shows for a secret, as RFC 6238
 * defines it: an HMAC-SHA1 of how many 30-second steps have passed since the
 * epoch, cut down to six digits.
 */

import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * The bytes of a base32 secret, written as sites show it: in either case,
 * spaced out or not, padded or not.
 * @param {string} text
 */
export function base32(text) {
    const bits = [...text.toUpperCase().replace(/[\s=]/g, "")]
        .map((char) => {
            const value = ALPHABET.indexOf(char);
            if (value < 0) throw new Error(`"${char}" is not base32.`);
            return value.toString(2).padStart(5, "0");
        })
        .join("");
    return Buffer.from(
        (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
    );
}

/**
 * @param {string} secret base32
 * @param {number} [now] milliseconds since the epoch
 */
export function totp(secret, now = Date.now()) {
    const step = Buffer.alloc(8);
    step.writeBigUInt64BE(BigInt(Math.floor(now / 30_000)));
    const mac = createHmac("sha1", base32(secret)).update(step).digest();
    const offset = mac.readUInt8(mac.length - 1) & 0xf;
    const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
    return String(code).padStart(6, "0");
}
