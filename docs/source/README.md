# Project documentation sources

The sources of [`docs/ANM-Shop-Project-Documentation.pdf`](../ANM-Shop-Project-Documentation.pdf).
The chapters are HTML written in JavaScript, and the diagrams are SVG drawn by small helpers.
Headless Chrome prints them to an A4 PDF. Nothing needs installing beyond Node and Chrome
(or Edge).

## Build

From the project root:

```bash
node docs/source/build.js
```

This writes `docs/source/doc.html` (git-ignored) and replaces
`docs/ANM-Shop-Project-Documentation.pdf`. Chrome or Edge is found in the usual places on
Windows, macOS and Linux; set `CHROME_PATH` to use another one. If the PDF wasn't written, the
script says so and exits with an error.

The pages use Segoe UI (Windows). On other systems Arial or another sans-serif is used
instead, which can move page breaks, so build the published PDF on Windows or check it
carefully.

## Files

| File | What it holds |
| --- | --- |
| `build.js` | Cover, table of contents, and the order the parts are printed in |
| `content1.js` | Parts 1–6: overview, stack, high-level design, user and API workflows, low-level design |
| `content2.js` | Parts 7–14: API reference, data models, security, rate limits, frontend, operations, history, limitations |
| `diagrams.js` | Every figure, built with `lib.js` (Figure 3.1 is `hld.svg`) |
| `lib.js` | Helpers for sequence diagrams, flowcharts and data-model boxes |
| `style.css` | A4 print styles, page footer, tables, cards |
| `chrome.js` | Finds Chrome or Edge |
| `review.js` | Prints groups of parts separately and reports their page counts (after a build) |

## Updating it

1. Edit the text in `content1.js` / `content2.js`, or a figure in `diagrams.js`. Take every
   fact from the code; the README's "Known limitations" section and the PDF's Part 14 should
   agree.
2. For a new edition, update the cover in `build.js` (edition and date), the scope note in
   Part 1, the history table in Part 13 and the closing line of Part 14.
3. Build, then open the PDF and look at the changed pages: a part that continues on the same
   page as the one before it (`flowOn` in `build.js`) can leave its "PART N" label stranded at
   the bottom of a page when the text above grows. `node docs/source/review.js` shows how many
   pages each part takes.
4. Commit the PDF together with the source changes.
