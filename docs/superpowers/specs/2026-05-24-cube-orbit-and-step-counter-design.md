# Chris Cube: Orbit During Auto-Resolve + Step Counter

**Date:** 2026-05-24
**Feature:** `features/chris/` (incremental update on the existing 3D cube)

## Goal

Two small enhancements to the existing scramble + solve animation:

1. **Camera orbit stays available during auto-resolve.** Today the pointer handler is gated on `state.isProcessing`, so the user is locked out of dragging the camera while scramble/solve plays. Lift the gate so drag-to-orbit works throughout; only the *tap → start new selection* path is suppressed while a resolve is in flight.
2. **Live step counter below the cube during solve.** A status caption underneath the cube shows `STEP n / N` ticking up in lockstep with each solve move animation.

## Non-goals

- Scramble moves are **not** counted. The counter only reflects solve progress.
- No layout reshuffle: the status caption reuses the existing `點擊方塊啟動引擎！` slot.
- No solver/animation timing changes (`SCRAMBLE_MS_PER`, `SOLVE_MS_PER`, pauses untouched).
- No new dependencies, no new files (changes confined to `cube3d.js`, `index.js`, `style.css`).
- Emma feature, Shower feature, shared modules: not touched.

## User-visible behavior

### Status caption (below the cube)

A single text slot under the cube has three states. Only one is visible at any time.

| State | Text | Animation |
|-------|------|-----------|
| `idle` | `點擊方塊啟動引擎！` | `animate-bounce` (current behavior) |
| `scrambling` | `打亂中...` | none (static) |
| `solving` | `STEP {current} / {total}` | none |

Transitions during one tap → auto-resolve cycle:

1. Pre-tap: **idle**.
2. Tap triggers `startSelection()`: switch to **scrambling** immediately.
3. Scramble finishes, 3 sec post-scramble pause: still **scrambling** (caption unchanged through the pause).
4. Kociemba solution computed: switch to **solving** with `STEP 0 / N` (N = solution length).
5. For each solve move: after the move's `rotateLayer` resolves, caption updates to `STEP i / N` (`i` is 1-indexed). The number jumps in 1:1 sync with the cube animation — no separate tween.
6. Solve completes, 400 ms post-solve pause: caption stays at `STEP N / N`.
7. Result modal opens (covers the whole screen via `fixed inset-0`, so caption is occluded but its text is unchanged).
8. User taps "準備開動" → `closeModal()` runs: switch back to **idle**.

### Camera orbit during auto-resolve

Drag-to-orbit behaves the same as today, with no new gating:

- Drag begins at any time, including during scramble or solve.
- Pitch clamp (±~75°), drag-distance threshold (8 px), and `userTookOverCamera` flag all behave as today.
- A drag started during auto-resolve also sets `userTookOverCamera = true`, so post-resolve idle auto-rotation stays disabled (consistent with the existing rule: once the user has touched the camera, idle spin doesn't come back for the session).
- Layer rotation animation is unaffected. Camera orbit changes `camYaw / camPitch` and `camera.position`; layer rotation animates a temporary pivot Group's local rotation. They write to disjoint state and compose cleanly inside the per-frame `renderer.render`.

### Tap suppression during auto-resolve

A pointerup that meets the tap criteria (`dist < 8 px && elapsed < 250 ms`) is treated as a tap **only when `!state.isProcessing`**. While auto-resolve is in flight, a tap is silently ignored — it does not start a second selection. (Today a tap during this window can't even register because `pointerdown` early-returns; after this change, `pointerdown` is allowed but `pointerup` enforces the gate.)

## Implementation

Three files. All changes are additive or replace-in-place — no module split, no new files.

### `features/chris/cube3d.js`

Add an optional per-move callback to `playMoves`:

```js
async function playMoves(moves, msPerMove, onStep) {
    for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        await rotateLayer(m.axis, m.layer, m.angle, msPerMove);
        onStep?.(i + 1, moves.length);
    }
}
```

`onStep` fires *after* each layer rotation resolves — so the counter increments at the exact moment the cubies snap into their new integer positions. Callers that don't pass `onStep` (e.g., the scramble playback) get current behavior.

### `features/chris/index.js`

**Template change:** give the existing caption a `data-el="status"` hook so its text and bounce class can be driven by state:

```html
<p data-el="status" class="text-center text-gray-600 text-xs font-bold animate-bounce">點擊方塊啟動引擎！</p>
```

**New helper inside `mount`:**

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

**`startSelection()` rewritten flow:**

```js
async function startSelection() {
    if (state.isProcessing || state.availableIndices.length === 0) return;
    state.isProcessing = true;
    cube.setIdleSpin(false);
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
        if (!userTookOverCamera) cube.setIdleSpin(true);
        finalizeSelection();
    } catch (err) {
        console.error('cube selection failed:', err);
        state.isProcessing = false;
        setStatus('idle');
    }
}
```

**`closeModal()` adds one line:**

```js
function closeModal() {
    els.modal.classList.add('hidden');
    setStatus('idle');
}
```

**Pointer handlers:**

- `pointerdown`: remove `if (state.isProcessing) return;`. Always begin tracking.
- `pointermove`: unchanged. Drag → `orbitCamera`, set `userTookOverCamera = true`, stop idle spin. Runs whether or not auto-resolve is in flight.
- `pointerup`: change the tap-triggers-`startSelection` branch to also require `!state.isProcessing`:

```js
if (!state.isProcessing && dist < TAP_DISTANCE_PX && elapsed < TAP_DURATION_MS) {
    startSelection();
}
```

`els.status` is added to the existing `els` lookup block.

### `features/chris/style.css`

No structural CSS needed — the caption keeps its current Tailwind utility classes. Only adjustment: ensure the status caption has a stable height so the layout doesn't reflow when the text length changes between `打亂中...` and `STEP 21 / 21`. If the current Tailwind classes already give it a fixed line-box height (`text-xs` + default leading), no CSS change is required. If a reflow is observed during `/verify-frontend`, add a minimum height on the status element in `style.css`:

```css
[data-el="status"] {
    min-height: 1.25rem;
}
```

(Apply only if verification shows reflow; otherwise leave CSS untouched.)

## Risks & edge cases

- **Drag begins during scramble, continues into solve.** No conflict: pointer capture is per-pointerId, orbit/layer rotation are disjoint state. The user sees the cube scrambling/solving from whatever angle they're dragging it to.
- **User taps during auto-resolve.** `pointerdown` no longer blocks, but `pointerup`'s tap branch checks `!state.isProcessing`, so no second selection fires. The pointerdown→pointerup cycle is a harmless no-op (no orbit if distance < 8 px).
- **Solver throws.** The `catch` block now also calls `setStatus('idle')` so the caption doesn't get stuck on `打亂中...`.
- **Counter & cube go out of sync.** Impossible by construction — `onStep` fires synchronously inside the `playMoves` loop, after `await rotateLayer` resolves.
- **`userTookOverCamera` set during auto-resolve.** Intended. Once the user has taken the camera, idle spin doesn't auto-resume — same rule as today.
- **Status caption layout shift.** Caption width changes (`打亂中...` ~36 px vs `STEP 21 / 21` ~64 px). It is `text-center`, so width changes don't move surrounding elements; only the line height matters. See `style.css` note above.

## Verification

Run `/verify-frontend` (or manual browser walk at `http://localhost:8000/`) and check:

1. **Idle:** caption shows `點擊方塊啟動引擎！` and bounces.
2. **Tap → scramble:** caption immediately switches to `打亂中...` (no bounce).
3. **Solve starts:** caption shows `STEP 0 / N`, then ticks `STEP 1 / N`, `STEP 2 / N`, ... in lockstep with the cube's layer rotations.
4. **During scramble:** drag the cube — camera orbits, scramble continues uninterrupted.
5. **During solve:** drag the cube — camera orbits, solve continues, counter still ticks.
6. **During auto-resolve:** tap (without dragging) — no new selection fires, no double scramble.
7. **Solve completes:** caption stays at `STEP N / N` through the 400 ms pause and while the modal is open.
8. **Modal closes:** caption returns to `點擊方塊啟動引擎！` bouncing.
9. **After drag during resolve:** idle auto-rotation does not resume after the modal closes (cube stays still at user's angle).
