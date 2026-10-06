# receipt.scss

## 2026-10-06 — placement of COPIED

On wide screens COPIED sits beside the heading's box, as the specimen had
it. The plan's narrow placement was below-left, but that lands on an h1's
vine (`h1.heading::after`), so on narrow screens the word stands over the
box's top-right corner instead, in the heading's top margin, which is always
empty. Figures use `data-placement="below"`, under the right-hand corner.

A long heading that fills the measure on a wide screen puts COPIED out past
the text column, into the frame's inset. The specimen accepted this, and so
does this file.

The box is the `.receipt-box`'s `::before`, drawn just outside it, so that
drawing it never reflows anything.
