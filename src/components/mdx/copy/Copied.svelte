<script lang="ts">
    import type { Placement, ReceiptOf } from "./receipt.svelte";

    /**
     * A receipt's word, COPIED, and what a screen reader hears instead. It
     * follows its control directly, since receipt.scss selects it as the
     * control's next sibling.
     */
    let {
        receipt,
        placement,
        heard,
    }: { receipt: ReceiptOf; placement: Placement; heard: string } = $props();
</script>

<span
    {@attach receipt.word}
    class="receipt-word"
    data-placement={placement}
    aria-hidden="true">copied</span
><span class="said" role="status">{receipt.state === "shown" ? heard : ""}</span
>
