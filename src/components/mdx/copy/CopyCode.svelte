<script lang="ts">
    import Copied from "./Copied.svelte";
    import { receipt as receiptOf } from "./receipt.svelte";

    /**
     * Copies the code of its figure exactly as written; the stylesheet draws
     * the line numbers, so they are not in the text. It renders only once its
     * script has loaded, since it does nothing without one. A copy is
     * answered with a receipt (see receipt.svelte.ts), whose COPIED stands
     * over the figure's corner, beside the button, not at the foot of a long
     * block.
     */
    let mounted = $state(false);
    let button: HTMLButtonElement | undefined = $state();
    const receipt = receiptOf();

    $effect(() => {
        mounted = true;
    });

    async function copy() {
        const code = button!
            .closest(".code-figure")!
            .querySelector("pre code")!;
        await navigator.clipboard.writeText(code.textContent ?? "");
        receipt.show();
    }
</script>

{#if mounted}<button
        bind:this={button}
        type="button"
        class="copy-code"
        data-receipt={receipt.state}
        onclick={copy}>Copy</button
    ><Copied {receipt} placement="above" heard="Code copied" />{/if}
