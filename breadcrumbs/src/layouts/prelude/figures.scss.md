# figures.scss

## 2026-10-06

Keyed on `.figure`, `.table-figure` and `.caption`, never on bare `figure`
or `img`, so Tumblr's `{Body}` images and tables keep their own layout.

`.table-scroll` has `padding-block-end: 4px` because the last row's brush
stroke straddles the table's foot, and an `overflow-x: auto` box clips in
both directions.

The receipt for a figure stands `--receipt-reach` (0.6rem) outside it, so
copying never moves the plate. receipt.scss reads the same variable to put
COPIED under the box's corner.
