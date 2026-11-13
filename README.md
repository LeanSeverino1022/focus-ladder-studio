# Quiet Studio — personal one-week trial

A small, private focus tool: two areas (Career, Family / Personal), one commitment each, one current step at a time. Plain HTML, CSS and JavaScript. No accounts, backend, sync, analytics or build step.

## Run it

```sh
./start.sh
```

Then open exactly **http://127.0.0.1:4747** and stop with `Ctrl+C`.

Needs only `python3` (preinstalled on macOS). If port 4747 is busy, the script stops instead of picking another port, because a different address would hide your saved data.

## Your data: read this once

- Everything is saved **in this browser only** (localStorage). There is no sync.
- Data is tied to the **exact address and browser**. `http://127.0.0.1:4747` and `http://localhost:4747` are different places, as are Chrome and Safari, a private window, or another computer or phone. If your data seems to be missing, you are probably at a different address or in a different browser. Always use the same address and browser.
- Clearing site data or browsing history for this address deletes it. Safari may also clear storage for sites you haven't visited in about a week; Chrome or Firefox are safer for a trial.
- **Back up regularly:** footer → **Data & backup** → **Download backup (JSON)**. The same dialog restores a backup. You see what the file contains and must confirm before anything is replaced.
- The app starts empty. Sample data is optional (Data & backup → Sample data and reset) and is never loaded for you.
- Before any "replace everything" action (restore, sample, erase), one safety copy of your current data is kept as **Previous data** in the same dialog.
- If saving fails (storage full or blocked), a red message stays at the top until saving works again. If saved data is unreadable, it is left untouched and you can download it.

## Daily use

- **Create commitment** in either area, or just one. An empty area is fine.
- **Edit ladder** to add, edit, reorder (↑ ↓) and remove steps. Reordering never changes your current step.
- Open a step to see Why, Done when, Next action and Note, and to choose it as your focus on purpose.
- **Complete this step** moves to the next open step; **Undo completion** reverses it. **Mark unfinished** reopens a step without changing focus.
- Removing a step offers **Undo**. Removing your *current* step asks first and leaves no step selected until you choose one.
- Parked ideas are per area and can be removed (with Undo).

## Files

`index.html`, `style.css`, `app.js`, `start.sh`. Nothing else is needed.

## Known limitations

- One device and one browser profile; no sync, no multi-user.
- Two tabs are last-writer-wins (a change in another tab is picked up when you aren't in a dialog).
- Undo for removals and completions lasts until reload; it is not saved.
- Only one "previous data" safety copy is kept.
- Backups are plain, unencrypted JSON.
