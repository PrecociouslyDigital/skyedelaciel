/**
 * The receipt the machine gives for a copy: `shown` for HOLD_MS, then
 * `leaving` while whatever it leaves through plays out, then `idle`. A
 * component sets it on its control as `data-receipt`, which the stylesheets
 * draw from.
 */
export type Receipt = "idle" | "shown" | "leaving";

/** How long a receipt is shown before it leaves: a moment and a half. */
export const HOLD_MS = 1500;

/** How long a leaving receipt takes to unresolve, as receipt.scss's `$leave`. */
export const LEAVE_MS = 260;

/**
 * A receipt, for a component to call while it is set up. `show()` starts it
 * over. It is idle again once every animation `leaving()` returns has
 * finished, which under reduced motion, or for a receipt with nothing to play,
 * is at once.
 */
export function receipt(leaving: () => Animation[] = () => []) {
    let state: Receipt = $state("idle");
    let hold: ReturnType<typeof setTimeout> | undefined;

    $effect(() => () => clearTimeout(hold));

    $effect(() => {
        if (state !== "leaving") return;
        Promise.all(leaving().map((animation) => animation.finished)).then(
            () => {
                if (state === "leaving") state = "idle";
            },
            () => {},
        );
    });

    return {
        get state() {
            return state;
        },
        show() {
            clearTimeout(hold);
            state = "shown";
            hold = setTimeout(() => (state = "leaving"), HOLD_MS);
        },
    };
}
