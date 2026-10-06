<script lang="ts">
    /**
     * Copies the code of its listing exactly as written; the stylesheet draws
     * the line numbers, so they are not in the text. It renders only once its
     * script has loaded, since it does nothing without one.
     */
    const HOLD_MS = 1500;

    let mounted = $state(false);
    let copied = $state(false);
    let button: HTMLButtonElement | undefined = $state();
    let hold: ReturnType<typeof setTimeout> | undefined;

    $effect(() => {
        mounted = true;
        return () => clearTimeout(hold);
    });

    async function copy() {
        const code = button!.closest(".listing")!.querySelector("pre code")!;
        await navigator.clipboard.writeText(code.textContent ?? "");
        clearTimeout(hold);
        copied = true;
        hold = setTimeout(() => (copied = false), HOLD_MS);
    }
</script>

{#if mounted}<button
        bind:this={button}
        type="button"
        class="copy-code"
        data-copied={copied || undefined}
        onclick={copy}>Copy</button
    ><span class="said" role="status">{copied ? "Code copied" : ""}</span>{/if}
