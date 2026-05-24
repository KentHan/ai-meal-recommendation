# Cube Orbit During Auto-Resolve + Step Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user drag-to-orbit the Chris cube while auto-resolve plays, and show a live `STEP n / N` counter underneath the cube during solve.

**Architecture:** Two near-independent changes in `features/chris/`. Feature A removes the `state.isProcessing` early-return on `pointerdown` and moves the tap-suppression gate to `pointerup`, so camera orbit (yaw/pitch state) and layer rotation (temp pivot Group) — already disjoint state — both run during resolve. Feature B adds an optional `onStep(i, total)` callback to `playMoves`, drives a 3-state status caption (`idle` / `scrambling` / `solving`) via a new `setStatus` helper, and wires it into `startSelection` / `closeModal` / the error path.

**Tech Stack:** Vanilla ES modules, Three.js (CDN global `window.THREE`), Cubejs Kociemba solver (CDN global `window.Cube`), Tailwind CDN utility classes. No build step, no test framework — verification is via `/verify-frontend` + manual browser walk (per `AGENTS.md`). Local server: `python3 -m http.server 8000`, page at `http://localhost:8000/`.

**Spec:** [docs/superpowers/specs/2026-05-24-cube-orbit-and-step-counter-design.md](../specs/2026-05-24-cube-orbit-and-step-counter-design.md)

---

## File Structure

All changes live in `features/chris/`:

- **Modify** [features/chris/cube3d.js](../../../features/chris/cube3d.js) — `playMoves` gains optional 3rd-arg `onStep` callback. Single function signature change; loop body wraps `await rotateLayer` and invokes `onStep?.(i + 1, moves.length)` after each move.
- **Modify** [features/chris/index.js](../../../features/chris/index.js) — Template's status `<p>` gets a `data-el="status"` hook. New inline `setStatus(kind, current, total)` helper. `startSelection` / `closeModal` / catch wire status transitions. Pointer handlers move the `state.isProcessing` gate from `pointerdown` to `pointerup`.
- **Modify (conditional)** [features/chris/style.css](../../../features/chris/style.css) — Only if verification surfaces vertical reflow when the status caption text changes width: add `[data-el="status"] { min-height: 1.25rem; }`.

No new files. No new modules. No tests directory (project convention).

---

## Pre-flight

- [ ] **Step 1: Start local server (if not already running)**

Run:
```bash
cd /Users/kent/src/ai-meal-recommendation && python3 -m http.server 8000
```

Leave running in background. Verify `http://localhost:8000/` loads in a browser and the Chris toggle (`🧊 Chris`) shows the cube without errors.

- [ ] **Step 2: Confirm clean working tree**

Run:
```bash
git status
```

Expected: no staged/unstaged changes in `features/chris/`. (Untracked files in other paths are fine.)

---

## Task 1: Allow camera orbit during auto-resolve

**Files:**
- Modify: [features/chris/index.js:211-246](../../../features/chris/index.js#L211-L246) (pointer handlers)

This task is independent of the step counter and can be verified on its own.

- [ ] **Step 1: Remove `isProcessing` early-return from `pointerdown`**

In `features/chris/index.js`, find the `pointerdown` handler (currently around line 211):

```js
els.cubeWrap.addEventListener('pointerdown', (e) => {
    if (state.isProcessing) return;
    pointerDownAt = performance.now();
    pdX = lastX = e.clientX;
    pdY = lastY = e.clientY;
    totalDragDistance = 0;
    dragging = true;
    els.cubeWrap.classList.add('dragging');
    els.cubeWrap.setPointerCapture(e.pointerId);
});
```

Replace with (one line removed):

```js
els.cubeWrap.addEventListener('pointerdown', (e) => {
    pointerDownAt = performance.now();
    pdX = lastX = e.clientX;
    pdY = lastY = e.clientY;
    totalDragDistance = 0;
    dragging = true;
    els.cubeWrap.classList.add('dragging');
    els.cubeWrap.setPointerCapture(e.pointerId);
});
```

- [ ] **Step 2: Add `!state.isProcessing` to `pointerup` tap branch**

Find the `pointerup` handler (currently around line 236) and locate the tap-trigger line:

```js
if (dist < TAP_DISTANCE_PX && elapsed < TAP_DURATION_MS) {
    startSelection();
}
```

Replace with:

```js
if (!state.isProcessing && dist < TAP_DISTANCE_PX && elapsed < TAP_DURATION_MS) {
    startSelection();
}
```

- [ ] **Step 3: Verify in browser — orbit works during scramble + solve**

Open `http://localhost:8000/` in a browser, click the `🧊 Chris` toggle. Then:

1. Tap the cube → scramble starts.
2. While scrambling, drag the cube → camera should orbit. Scramble continues uninterrupted.
3. After 3-second pause, solve begins. Drag again → camera orbits during solve too.
4. After result modal appears, dismiss it. Idle auto-rotation should NOT resume (because user dragged — existing `userTookOverCamera` rule).

Expected: drag works at any phase, scramble/solve animation does not stutter, no console errors.

- [ ] **Step 4: Verify in browser — tap during resolve does NOT trigger second selection**

1. Reset progress (top-right button).
2. Tap the cube → scramble starts.
3. While scrambling, tap the cube again (quick tap, no drag).
4. Expected: nothing happens — scramble continues, no new scramble queued, no double-spin. Console: no errors.

- [ ] **Step 5: Commit**

```bash
git add features/chris/index.js
git commit -m "feat(chris): allow camera orbit during auto-resolve"
```

---

## Task 2: Extend `playMoves` with optional `onStep` callback

**Files:**
- Modify: [features/chris/cube3d.js:116-120](../../../features/chris/cube3d.js#L116-L120) (`playMoves` function)

This change is backward-compatible — existing callers that omit `onStep` get current behavior.

- [ ] **Step 1: Update `playMoves` signature and loop body**

In `features/chris/cube3d.js`, find:

```js
async function playMoves(moves, msPerMove) {
    for (const m of moves) {
        await rotateLayer(m.axis, m.layer, m.angle, msPerMove);
    }
}
```

Replace with:

```js
async function playMoves(moves, msPerMove, onStep) {
    for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        await rotateLayer(m.axis, m.layer, m.angle, msPerMove);
        onStep?.(i + 1, moves.length);
    }
}
```

`i + 1` is intentional: after the first move resolves, `onStep` reports `(1, N)` — matches "1-indexed step counter" in the spec.

- [ ] **Step 2: Verify in browser — no regression**

Reload `http://localhost:8000/`, switch to Chris, tap the cube. Scramble + solve should still play exactly as before (no counter UI exists yet — that's Task 4). Watch console for errors. Expected: animation unchanged, no errors.

- [ ] **Step 3: Commit**

```bash
git add features/chris/cube3d.js
git commit -m "feat(chris): add optional onStep callback to playMoves"
```

---

## Task 3: Add status caption hook and `setStatus` helper

**Files:**
- Modify: [features/chris/index.js:23](../../../features/chris/index.js#L23) (template `<p>`)
- Modify: [features/chris/index.js:50-57](../../../features/chris/index.js#L50-L57) (`els` lookup block)
- Modify: [features/chris/index.js](../../../features/chris/index.js) (add `setStatus` helper inside `mount`)

This task wires up the surface but does not change runtime behavior yet — no caller invokes `setStatus`. Caption keeps its initial idle text and bounce class.

- [ ] **Step 1: Add `data-el="status"` to template caption**

In `features/chris/index.js`, find in the `TEMPLATE` string (currently line 23):

```html
<p class="text-center text-gray-600 text-xs font-bold animate-bounce">點擊方塊啟動引擎！</p>
```

Replace with:

```html
<p data-el="status" class="text-center text-gray-600 text-xs font-bold animate-bounce">點擊方塊啟動引擎！</p>
```

- [ ] **Step 2: Add `status` to `els` lookup**

Find the `els` block (currently around lines 50-57):

```js
const els = {
    statusList:      rootEl.querySelector('[data-el="statusList"]'),
    cubeWrap:        rootEl.querySelector('[data-el="cubeWrap"]'),
    cubeCanvas:      rootEl.querySelector('[data-el="cubeCanvas"]'),
    modal:           rootEl.querySelector('[data-el="modal"]'),
    modalColorStrip: rootEl.querySelector('[data-el="modalColorStrip"]'),
    resultText:      rootEl.querySelector('[data-el="resultText"]'),
};
```

Add a `status` entry (placed after `cubeCanvas` for grouping with cube-area elements):

```js
const els = {
    statusList:      rootEl.querySelector('[data-el="statusList"]'),
    cubeWrap:        rootEl.querySelector('[data-el="cubeWrap"]'),
    cubeCanvas:      rootEl.querySelector('[data-el="cubeCanvas"]'),
    status:          rootEl.querySelector('[data-el="status"]'),
    modal:           rootEl.querySelector('[data-el="modal"]'),
    modalColorStrip: rootEl.querySelector('[data-el="modalColorStrip"]'),
    resultText:      rootEl.querySelector('[data-el="resultText"]'),
};
```

- [ ] **Step 3: Add `setStatus` helper inside `mount`**

Add this helper function inside `mount`, after the `renderList` function definition (around line 120, after `renderList`'s closing brace) and before the timing constants (`const SCRAMBLE_LENGTH = 22;` around line 122):

```js
function setStatus(kind, current, total) {
    if (kind === 'idle') {
        els.status.textContent = '點擊方塊啟動引擎！';
    } else if (kind === 'scrambling') {
        els.status.textContent = '打亂中...';
    } else if (kind === 'solving') {
        els.status.textContent = `STEP ${current} / ${total}`;
    }
    els.status.classList.toggle('animate-bounce', kind === 'idle');
}
```

- [ ] **Step 4: Verify in browser — no regression**

Reload page. Chris caption should still read `點擊方塊啟動引擎！` and bounce (no new behavior). No console errors. Tapping cube still plays scramble + solve normally.

- [ ] **Step 5: Commit**

```bash
git add features/chris/index.js
git commit -m "feat(chris): add status caption hook and setStatus helper"
```

---

## Task 4: Wire `setStatus` into `startSelection`, `closeModal`, and error path

**Files:**
- Modify: [features/chris/index.js:128-150](../../../features/chris/index.js#L128-L150) (`startSelection`)
- Modify: [features/chris/index.js:170-172](../../../features/chris/index.js#L170-L172) (`closeModal`)

- [ ] **Step 1: Update `startSelection` to drive status transitions**

Find the current `startSelection` function:

```js
async function startSelection() {
    if (state.isProcessing || state.availableIndices.length === 0) return;
    state.isProcessing = true;
    cube.setIdleSpin(false);  // pause idle so it doesn't fight the solve animation
    playSound('tick');

    try {
        const scramble = randomScramble(SCRAMBLE_LENGTH);
        await cube.playMoves(scramble, SCRAMBLE_MS_PER);

        await new Promise(r => setTimeout(r, POST_SCRAMBLE_PAUSE_MS));

        const solution = solveAfterScramble(scramble);
        await cube.playMoves(solution, SOLVE_MS_PER);

        await new Promise(r => setTimeout(r, POST_SOLVE_PAUSE_MS));
        if (!userTookOverCamera) cube.setIdleSpin(true);  // resume idle unless user dragged
        finalizeSelection();
    } catch (err) {
        console.error('cube selection failed:', err);
        state.isProcessing = false;
    }
}
```

Replace with:

```js
async function startSelection() {
    if (state.isProcessing || state.availableIndices.length === 0) return;
    state.isProcessing = true;
    cube.setIdleSpin(false);  // pause idle so it doesn't fight the solve animation
    playSound('tick');

    try {
        setStatus('scrambling');
        const scramble = randomScramble(SCRAMBLE_LENGTH);
        await cube.playMoves(scramble, SCRAMBLE_MS_PER);

        await new Promise(r => setTimeout(r, POST_SCRAMBLE_PAUSE_MS));

        const solution = solveAfterScramble(scramble);
        setStatus('solving', 0, solution.length);
        await cube.playMoves(solution, SOLVE_MS_PER, (i, total) => setStatus('solving', i, total));

        await new Promise(r => setTimeout(r, POST_SOLVE_PAUSE_MS));
        if (!userTookOverCamera) cube.setIdleSpin(true);  // resume idle unless user dragged
        finalizeSelection();
    } catch (err) {
        console.error('cube selection failed:', err);
        state.isProcessing = false;
        setStatus('idle');
    }
}
```

Three additions:
1. `setStatus('scrambling')` immediately after entering the try block.
2. `setStatus('solving', 0, solution.length)` before solve playback (shows `STEP 0 / N`).
3. `onStep` callback passed to `playMoves`: `(i, total) => setStatus('solving', i, total)`.
4. `setStatus('idle')` in catch so caption doesn't get stuck if solver throws.

- [ ] **Step 2: Update `closeModal` to reset status to idle**

Find:

```js
function closeModal() {
    els.modal.classList.add('hidden');
}
```

Replace with:

```js
function closeModal() {
    els.modal.classList.add('hidden');
    setStatus('idle');
}
```

- [ ] **Step 3: Verify in browser — full state lifecycle**

Reload page. With Chris active:

1. Initial: caption reads `點擊方塊啟動引擎！` and bounces.
2. Tap cube → caption immediately changes to `打亂中...` (no bounce).
3. Scramble + 3s pause: caption stays at `打亂中...`.
4. Solve starts: caption changes to `STEP 0 / 21` (number after `/` varies — that's the solution length).
5. Per solve move: caption ticks `STEP 1 / 21`, `STEP 2 / 21`, ..., `STEP 21 / 21`. Each tick aligned with a cube layer rotation.
6. 400ms pause + modal opens: modal covers the caption (full-screen overlay).
7. Tap "準備開動" to close modal: caption returns to `點擊方塊啟動引擎！` and bounces.
8. Console: no errors.

- [ ] **Step 4: Verify in browser — error path resets status**

This is a soft check — we can't easily force the solver to throw without code modification. Quick check: if the page reload was clean and no errors fired, the catch path isn't exercised. Skip unless you want to manually inject a throw for testing (not required).

- [ ] **Step 5: Commit**

```bash
git add features/chris/index.js
git commit -m "feat(chris): show STEP n/N counter and scramble status during auto-resolve"
```

---

## Task 5: Conditional CSS reflow fix

**Files:**
- Modify (conditional): [features/chris/style.css](../../../features/chris/style.css)

The status caption changes width as it cycles through `點擊方塊啟動引擎！` → `打亂中...` → `STEP 21 / 21`. Because it's `text-center`, horizontal width changes don't move sibling elements, but if the rendered line-box height differs between strings (e.g., one wraps, one doesn't on a narrow viewport), vertical layout could reflow.

- [ ] **Step 1: Observe whether the status caption reflows the layout**

Reload `http://localhost:8000/` with Chris active. Tap the cube and watch the area directly below the cube during scramble → solve transitions. Look for:

- The cube or surrounding elements shifting vertically when caption text changes.
- The caption wrapping to two lines at any point on the default mobile viewport (375 px wide).

If nothing moves and the caption stays single-line throughout: **skip steps 2-4 and stop here. Task done with no changes.**

If you see a shift or wrap, proceed to step 2.

- [ ] **Step 2: Add `min-height` rule to status caption**

Append to `features/chris/style.css`:

```css
[data-el="status"] {
    min-height: 1.25rem;
}
```

`1.25rem` matches the line-height of Tailwind's `text-xs` (which is `0.75rem` with default `leading-1.6667` ≈ `1.25rem`). Reserves a single line's worth of vertical space regardless of text content.

- [ ] **Step 3: Verify in browser — reflow fixed**

Reload. Re-run the tap → scramble → solve cycle. Confirm the layout no longer shifts when the caption text changes.

- [ ] **Step 4: Commit (only if Step 2 was performed)**

```bash
git add features/chris/style.css
git commit -m "fix(chris): reserve status caption height to prevent layout reflow"
```

---

## Task 6: Full `/verify-frontend` walkthrough

**Files:** None.

Final end-to-end verification covering all 9 scenarios from the spec's Verification section. This is a no-commit check.

- [ ] **Step 1: Confirm the local server is still running on port 8000**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/
```

Expected output: `200`

- [ ] **Step 2: Run the `/verify-frontend` skill**

Invoke the skill, navigating to `http://localhost:8000/`, and walk through these scenarios:

1. **Idle:** caption shows `點擊方塊啟動引擎！` and is bouncing.
2. **Tap → scramble:** caption immediately becomes `打亂中...` (no bounce).
3. **Solve starts:** caption shows `STEP 0 / N`, then ticks `STEP 1 / N`, ..., `STEP N / N`. Number increments in lockstep with cube layer rotations (~320ms apart).
4. **Drag during scramble:** camera orbits while scramble continues. Counter not yet showing (still `打亂中...`).
5. **Drag during solve:** camera orbits while solve continues and counter still ticks.
6. **Tap during auto-resolve:** no second selection fires — caption uninterrupted, no double scramble.
7. **Solve completes:** caption stays at `STEP N / N` through the 400ms post-solve pause and while the result modal is open.
8. **Modal closes:** caption returns to `點擊方塊啟動引擎！` and bounces.
9. **After drag during resolve:** idle auto-rotation does not resume after modal closes (cube stays still at user's chosen angle).

- [ ] **Step 3: Check console for errors**

Use the Playwright `browser_console_messages` tool. Expected: no errors related to Chris feature. (Unrelated CDN warnings from other features are OK.)

- [ ] **Step 4: If any scenario fails, do NOT mark complete**

Stop, diagnose, fix the underlying issue, recommit, re-run this task. Common gotchas:
- Caption stuck on `打亂中...` → check `setStatus('solving', ...)` ordering or the catch path.
- Counter doesn't tick → check `onStep` callback is passed to the solve `playMoves` call (not the scramble one).
- Drag during resolve doesn't orbit → check `pointerdown` no longer early-returns.
- Tap during resolve fires second selection → check `!state.isProcessing` guard on `pointerup` tap branch.

- [ ] **Step 5: No commit (verification only)**

This task makes no file changes. Nothing to commit.

---

## Done

When all tasks above are checked, both spec requirements are implemented:

1. ✅ User can orbit the camera during scramble and solve.
2. ✅ Live `STEP n / N` counter below the cube ticks in sync with each solve move; `打亂中...` shows during scramble; idle hint bounces when no resolve is in flight.
