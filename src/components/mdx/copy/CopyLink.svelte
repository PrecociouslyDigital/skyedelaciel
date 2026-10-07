<script lang="ts">
    import Copied from "./Copied.svelte";
    import { receipt as receiptOf, type Placement } from "./receipt.svelte";

    /**
     * A link to a place on this page, for a heading's `§ 5.4` or a figure's
     * `Fig. 2`, that copies the place's address rather than going there.
     * Without scripting it is a plain link and goes there.
     *
     * The machine answers a copy with a receipt (see receipt.svelte.ts), and
     * a screen reader hears "Link copied".
     */

    let {
        href,
        label,
        placement = "beside",
    }: {
        href: `#${string}`;
        label: string;
        placement?: Placement;
    } = $props();

    let mounted = $state(false);
    const receipt = receiptOf();

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
>{#if mounted}<Copied {receipt} {placement} heard="Link copied" />{/if}
