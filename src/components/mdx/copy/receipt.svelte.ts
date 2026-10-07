/**
 * The receipt the machine gives for a copy: `shown` for HOLD_MS, then
 * `leaving` while its word unresolves, then `idle`. A component sets it on
 * its control as `data-receipt`, which the stylesheets draw from, and writes
 * the word with Copied.svelte.
 */
export type Receipt = "idle" | "shown" | "leaving";

/** Where COPIED goes, relative to the `.receipt-box`: see receipt.scss. */
export type Placement = "beside" | "above" | "below";

/** How long a receipt is shown before it leaves: a moment and a half. */
export const HOLD_MS = 1500;

/** How long a leaving receipt takes to unresolve, as receipt.scss's `$leave`. */
export const LEAVE_MS = 260;

/**
 * A receipt, for a component to call while it is set up. `show()` starts it
 * over. `word` attaches the word it leaves through; it is idle again once the
 * word's animations have finished, which under reduced motion is at once.
 */
export function receipt() {
    let state: Receipt = $state("idle");
    let word: Element | undefined;
    let hold: ReturnType<typeof setTimeout> | undefined;

    $effect(() => () => clearTimeout(hold));

    $effect(() => {
        if (state !== "leaving") return;
        const leaving = word?.getAnimations() ?? [];
        Promise.all(leaving.map((animation) => animation.finished)).then(
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
        word(element: Element) {
            word = element;
            return () => (word = undefined);
        },
    };
}

export type ReceiptOf = ReturnType<typeof receipt>;
