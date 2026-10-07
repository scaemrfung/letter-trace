# Letter Trace

iPad page for tracing upper and lower case letters with a finger or Apple Pencil.

## Live page

After GitHub Pages is turned on, students open:

https://scaemrfung.github.io/letter-trace/

## Turn on hosting

The site file is already on the main branch. Pages still needs one setting:

1. Open Settings, then Pages.
2. Build and deployment: Deploy from a branch.
3. Branch: main, folder: / (root).
4. Save.

The address above starts working a minute or two later. In Safari on the iPad, tap Share, then Add to Home Screen.

## Stroke order and tracing check

- Each letter shows numbered start dots (1, 2, 3...) and arrows for the order and direction of each line, in manuscript (ball-and-stick) style.
- **Show me** animates the strokes in order. **1 2 3 Numbers** hides or shows the numbers and arrows (the setting is remembered).
- **I traced it** only saves the green dot when at least 85% of the ink is on the letter and at least 80% of the letter (75% of every stroke) is traced. Otherwise the child sees "Try again, stay on the line!", with off-line ink marked in red and missed parts in orange. Order and direction only give a friendly tip.
- The thresholds are in `TRACE_RULES` at the top of the script in `index.html`.
- `tracekit.js` has the stroke data, drawing, animation and accuracy check, so a numbers page or a spelling-words page can reuse it (`TraceKit.compose("cat")` lays out a whole word).
