<script lang="ts">
    // Only runs client-side; SSR renders unchecked checkbox
    $effect.pre(() => {
        //Hack: clear previous hack to prevent FOUC
        delete document.querySelector("html")!.dataset.themeChecked;
        const toggle = document.getElementById(
            "theme-toggle",
        ) as HTMLInputElement;
        toggle.checked = JSON.parse(
            localStorage.getItem("theme-override") ?? "false",
        );
        toggle.addEventListener("change", () => {
            localStorage.setItem(
                "theme-override",
                JSON.stringify(toggle.checked),
            );
        });
    });
</script>

<label class="theme-toggle" aria-label="Toggle color scheme">
    <input type="checkbox" id="theme-toggle" />
    <span class="toggle-icon" aria-hidden="true"></span>
</label>

<style lang="scss">
    @use "../layouts/prelude/breakpoints";
    .theme-toggle {
        cursor: pointer;
        display: flex;
        align-items: center;
        margin-left: auto;
    }

    input {
        position: absolute;
        opacity: 0;
        width: 0;
        height: 0;
    }

    /* A square rather than a disc: the seal, the frame and the manuscript grid
       are all boxes, and this is the smallest of them. */
    .toggle-icon {
        box-sizing: border-box;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 2px;
        border: 1.5px solid var(--color-text);
        background: linear-gradient(
            135deg,
            var(--color-text) 50%,
            transparent 50%
        );
        transition: transform 0.2s ease;
    }

    input:checked + .toggle-icon {
        transform: rotate(180deg);
    }

    input:focus-visible + .toggle-icon {
        outline: 2px solid var(--color-accent);
        outline-offset: 2px;
    }

    @include breakpoints.wide-sidebar {
        .theme-toggle {
            margin-left: 0;
            margin-top: 1rem;
        }
    }
</style>
