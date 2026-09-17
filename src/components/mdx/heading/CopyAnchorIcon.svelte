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

<style lang="scss">
    @use "../../../layouts/prelude/motion";

    .copy-anchor {
        /* The transition has to follow `all: unset`, which would otherwise
           reset it along with everything else the button inherited. */
        all: unset;
        @include motion.snap(opacity);
        cursor: pointer;
        opacity: 0;
        margin-left: 0.3em;
        font-family: var(--font-prose);
        font-size: 0.75em;
        color: var(--color-muted);
    }

    .copy-anchor:hover {
        color: var(--color-accent);
    }

    /* Kept here rather than in Heading.astro, next to the `all: unset` that
       would otherwise undo it: Svelte scopes both rules with the same class,
       so this one wins on source order. An outside rule on `.copy-anchor`
       carries less specificity and loses to `all` without saying so. */
    @media print {
        .copy-anchor {
            display: none;
        }
    }
</style>
