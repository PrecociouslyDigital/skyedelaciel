<script lang="ts">
    import { receipt as receiptOf } from "./receipt.svelte";

    /**
     * Copies the code of its figure exactly as written; the stylesheet draws
     * the line numbers, so they are not in the text. It renders only once its
     * script has loaded, since it does nothing without one. A copy is
     * answered with a receipt (see receipt.svelte.ts), which has nothing to
     * play as it leaves.
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
    ><span class="said" role="status"
        >{receipt.state === "shown" ? "Code copied" : ""}</span
    >{/if}
