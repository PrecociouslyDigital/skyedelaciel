<script lang="ts">
    import { receipt as receiptOf } from "./receipt.svelte";

    /**
     * A link to a place on this page, for a heading's `§ 5.4` or a figure's
     * `Fig. 2`, that copies the place's address rather than going there.
     * Without scripting it is a plain link and goes there.
     *
     * The machine answers a copy with a receipt (see receipt.svelte.ts),
     * which leaves as its word unresolves. receipt.scss draws the box and the
     * word from `data-receipt`, and a screen reader hears "Link copied".
     */

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

    let mounted = $state(false);
    let word: HTMLElement | undefined = $state();
    const receipt = receiptOf(() => word?.getAnimations() ?? []);

    $effect(() => {
        mounted = true;
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

        receipt.show();
    }
</script>

<a {href} class="copy-link" data-receipt={receipt.state} onclick={copy}
    >{label}</a
>{#if mounted}<span
        bind:this={word}
        class="receipt-word"
        data-placement={placement}
        aria-hidden="true">copied</span
    ><span class="said" role="status"
        >{receipt.state === "shown" ? "Link copied" : ""}</span
    >{/if}
