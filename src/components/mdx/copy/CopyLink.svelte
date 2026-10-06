<script lang="ts">
    /**
     * A link to a place on this page, for a heading's `§ 5.4` or a figure's
     * `Fig. 2`, that copies the place's address rather than going there.
     * Without scripting it is a plain link and goes there.
     *
     * The machine answers a copy with a receipt: `data-receipt` is `shown`
     * for a moment and a half, then `leaving` while it unresolves, then
     * `idle`. receipt.scss draws the box and the word from that attribute,
     * and a screen reader hears "Link copied".
     */
    type Receipt = "idle" | "shown" | "leaving";

    let {
        href,
        label,
        placement = "beside",
    }: {
        href: `#${string}`;
        label: string;
        /** Where COPIED goes: beside the box, or under its right corner. */
        placement?: "beside" | "below";
    } = $props();

    const HOLD_MS = 1500;

    let receipt: Receipt = $state("idle");
    let mounted = $state(false);
    let word: HTMLElement | undefined = $state();
    let hold: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        mounted = true;
        return () => clearTimeout(hold);
    });

    /* Leaving lasts as long as the word takes to unresolve, which is
       whatever receipt.scss says, or no time at all under reduced motion. */
    $effect(() => {
        if (receipt !== "leaving" || !word) return;
        const running = word.getAnimations();
        Promise.all(running.map((animation) => animation.finished)).then(
            () => {
                if (receipt === "leaving") receipt = "idle";
            },
            () => {},
        );
    });

    async function copy(event: MouseEvent) {
        // A reader opening the link elsewhere still gets the link.
        if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
        if (event.shiftKey || event.altKey) return;
        event.preventDefault();

        const address = new URL(href, location.href);
        history.replaceState(history.state, "", address);
        try {
            await navigator.clipboard.writeText(address.href);
        } catch {
            // Nothing was copied, so the link does what a link does.
            location.hash = href;
            return;
        }

        clearTimeout(hold);
        receipt = "shown";
        hold = setTimeout(() => (receipt = "leaving"), HOLD_MS);
    }
</script>

<a {href} class="copy-link" data-receipt={receipt} onclick={copy}>{label}</a
>{#if mounted}<span
        bind:this={word}
        class="receipt-word"
        data-placement={placement}
        aria-hidden="true">copied</span
    ><span class="said" role="status"
        >{receipt === "shown" ? "Link copied" : ""}</span
    >{/if}
