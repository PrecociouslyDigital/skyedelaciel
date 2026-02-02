<script lang="ts">
    /** The heading's slug, used to build the full anchor URL. */
    let { slug }: { slug: string } = $props();

    let copied = $state(false);

    async function copyAnchor() {
        const url = `${window.location.origin}${window.location.pathname}#${slug}`;
        await navigator.clipboard.writeText(url);
        copied = true;
        setTimeout(() => (copied = false), 1500);
    }
</script>

<button
    class="copy-anchor"
    onclick={copyAnchor}
    aria-label="Copy link to heading"
>
    {copied ? "Copied!" : "#"}
</button>

<style>
    .copy-anchor {
        all: unset;
        cursor: pointer;
        opacity: 0;
        margin-left: 0.3em;
        font-family: sans-serif;
        font-size: 0.75em;
        color: var(--color-muted);
        transition: opacity 0.15s;
    }
</style>
