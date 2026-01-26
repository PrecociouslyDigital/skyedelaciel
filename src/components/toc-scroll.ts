/**
 * Progressive enhancement for TOC: auto-expand sections as user scrolls.
 * Without JS, sections remain collapsed but manually expandable.
 */

const observer = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                expandTocSection(entry.target.id);
            }
        }
    },
    // Trigger when heading is in upper portion of viewport
    { rootMargin: "0% 0px -95% 0px" }
);

// Observe all headings in the article
document
    .querySelectorAll("article :is(h1,h2,h3)[id]")
    .forEach((h) => observer.observe(h));

function expandTocSection(slug: string) {
    const toc = document.querySelector(".toc-sidebar");
    if (!toc) return;

    const link = toc.querySelector(`a[href="#${slug}"]`);
    if (!link) return;

    // Clear previous highlight
    toc.querySelector("a[data-current]")?.removeAttribute("data-current");

    // Highlight current link
    link.setAttribute("data-current", "");

    // Close all sections first
    toc.querySelectorAll("details[open]").forEach((d) =>
        d.removeAttribute("open")
    );

    // Open only ancestors of the current link
    let el = link.parentElement;
    while (el && el !== toc) {
        if (el.tagName === "DETAILS") {
            el.setAttribute("open", "");
        }
        el = el.parentElement;
    }
}
