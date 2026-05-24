# Chris Feature: 3D Rubik's Cube Solve Animation

**Date:** 2026-05-24
**Feature:** `features/chris/` (replaces 2D 3×3 grid mechanic)

## Goal

Replace the current 2D 3×3 grid "spinner" inside the Chris breakfast picker with a real-looking 3D Rubik's cube. Every click scrambles the cube into a random state and then plays the fastest-solve animation back to the solved state. When the animation finishes, the existing modal pops up with the picked meal.

## Non-goals

- The cube state is **not** linked to the meal pick — animation is pure visual, picking is the existing `availableIndices` random.
- No multi-size cubes (always 3×3×3).
- No solver tuning UI, no scramble length UI — fixed defaults.
- Emma feature, Shower feature, and shared modules are not touched.

## User-visible behavior

### Idle
- Cube sits in solved state, slowly auto-rotating around Y axis (≈ 8 sec per full revolution).
- "點魔方啟動引擎！" caption bobs underneath (same as today).
- Status pills + reset button above the cube (same as today).

### Tap the cube → animation
1. **Scramble** (~2 sec): 22 random face rotations played at 80 ms each.
2. **Solve** (~6–7 sec): Kociemba two-phase solution (~18–22 moves) played at 320 ms each with cubic-ease. No pause between scramble and solve — they flow directly.
3. **Modal** (~400 ms after final solve move): a short beat lets the user register "SOLVED", then the existing modal appears with the randomly picked meal. Closing the modal returns to Idle (cube remains in solved state).

### Drag the cube → rotate camera
- Pointer drag orbits the camera around the cube (yaw + pitch, no zoom, no pan).
- Pitch clamped to roughly ±75° to prevent flipping under the cube.
- Once the user drags, idle auto-rotation stops permanently for that session (the user's chosen angle is preserved).

### Tap vs Drag disambiguation
A pointerup is treated as a **tap** (and triggers the animation) only when:
- Total distance moved since pointerdown < 8 px **and**
- Duration < 250 ms

Anything else is a drag and does not start the animation.

### Interaction lockout
While `isProcessing` (scramble or solve playing):
- Tap is ignored.
- Drag is ignored (camera stays put).

This mirrors the current 2D implementation's lockout.

## Rendering

- **Three.js** loaded via UMD CDN tag in `index.html`, alongside the Tailwind CDN tag.
- **Scene:** one `Group` (`cubeRoot`) holding 27 cubie `Mesh`es.
- **Cubies:** `BoxGeometry(0.94, 0.94, 0.94)` positioned at integer coords in `[-1, 0, 1]³`. Each cubie has 6 `MeshStandardMaterial`s — outward faces get sticker colors, inward faces are near-black.
- **Lighting:** one `AmbientLight` (intensity 0.55) + one main `DirectionalLight` (0.95) at (5, 8, 6) + one fill `DirectionalLight` (0.3) from (-5, -3, -4).
- **Camera:** `PerspectiveCamera`, FOV 40°, orbited around origin at radius ≈ 7.2.
- **Renderer:** `WebGLRenderer({ antialias: true, alpha: true })`, `setPixelRatio(devicePixelRatio)`.
- **Resize:** a `ResizeObserver` on the cube container syncs renderer bitmap + camera aspect to the container's actual size on every layout change. Initial resize fires inside `requestAnimationFrame` so the container's `aspect-ratio` has laid out first.

### Colors

Standard Western Rubik scheme, mapped to the existing chris `PALETTE`:

| Face | Color |
|------|-------|
| Right (+x) | `#DC2626` red |
| Left  (-x) | `#EA580C` orange |
| Top   (+y) | `#F1F5F9` white |
| Bottom (-y)| `#CA8A04` yellow |
| Front (+z) | `#16A34A` green |
| Back  (-z) | `#2563EB` blue |
| Inner faces | `#0a0a0a` near-black |

## Solve algorithm

- **Kociemba two-phase**, via a third-party JS library loaded by CDN script.
- Candidate libraries (final choice deferred to implementation): `cubejs` (ldez), `min2phase.js`. Picking criteria: stable CDN bundle, < ~2 MB asset budget, simple "state → move list" API.
- Solver runs synchronously after scramble finishes (typically returns in < 100 ms for randomly-scrambled cubes). If solver init has a one-time table-building cost, run it lazily on first user interaction (not at page load), so initial paint stays fast.

### Move representation

A move is `{ axis: 'x' | 'y' | 'z', layer: -1 | 0 | 1, angle: ±π/2 }`. The internal `rotateLayer(axis, layer, angle, durationMs)` engine handles the animation:

1. Create a temporary `Group` (`pivot`), attach all cubies in the chosen layer to it.
2. Animate `pivot.rotation[axis]` from 0 to `angle` over `durationMs` with cubic ease-in-out.
3. On completion, detach cubies back to `cubeRoot` (preserving their new world transforms), discard the pivot.

The solver library's standard URFDLB notation is translated to `{axis, layer, angle}` once when the solution is returned; the rendering layer never sees notation strings.

## Layout (within Chris feature)

Same vertical stack as today, only the middle changes:

```
┌──────────────────────────────┐
│  CUBE BREAKFAST              │   ← title (unchanged)
│  兒子專屬機械魔方             │   ← subtitle (unchanged)
├──────────────────────────────┤
│  今日選單      [ 重置進度 ]   │   ← header row (unchanged)
│  [pill] [pill] [pill] ...    │   ← status pills (unchanged)
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │                        │  │
│  │      3D CUBE CANVAS    │  │   ← NEW (replaces .cube-grid)
│  │      aspect-ratio 1/1  │  │
│  │                        │  │
│  └────────────────────────┘  │
├──────────────────────────────┤
│  點魔方啟動引擎！             │   ← caption (unchanged)
└──────────────────────────────┘
```

CSS changes in `features/chris/style.css`:
- `.cube-container` keeps the dark inner box, border, radius, shadow, but its `width`/`height` become a max-width 100% with `aspect-ratio: 1 / 1`. Padding around the canvas remains.
- The inner `.cube-grid` and `.cube-cell` rules are deleted.
- New: `.cube-container canvas { display: block; touch-action: none; }`.
- New: `.cube-container.dragging { cursor: grabbing; }` / default `cursor: grab` so the affordance flips during drag.

The result modal markup and styles are unchanged.

## File structure

Maintains the "feature self-contained" contract from AGENTS.md.

```
features/chris/
├── index.js       — feature entry point (mount, state, modal, status pills)
├── cube3d.js      — Three.js scene, cubie management, rotateLayer, scramble, solve
├── solver.js      — wraps Kociemba lib; in: cube state, out: move list
└── style.css      — feature CSS (updated)
```

- **`index.js`** keeps the existing `mount(rootEl)` contract. Inside `mount`:
  - Build the HTML template (same as today, except `.cube-grid` is now `<canvas data-el="cubeCanvas">`).
  - `import` `cube3d.js` and `solver.js`; create the cube instance once, attach to the canvas.
  - Wire `cubeCanvas` pointer events for tap/drag.
  - Pick meal + show modal logic stays identical (uses `state.availableIndices`).
- **`cube3d.js`** default-exports a factory `createCube(canvas)` returning `{ scramble(moves), solve(moves), setIdle(bool), onUserDrag(cb), dispose() }`.
- **`solver.js`** default-exports `solve(state) → moves[]` and `scrambleSequence(length) → moves[]`. Hides the third-party lib's notation.
- **`index.html`** adds `<script>` tags for Three.js + Kociemba lib (CDN, no build step).

## Animation tuning constants

Centralized at the top of `cube3d.js`:

```js
const SCRAMBLE_MOVES   = 22;
const SCRAMBLE_MS_PER  = 80;
const SOLVE_MS_PER     = 320;
const IDLE_YAW_PER_SEC = 0.04;  // ~ 8 sec / revolution
```

## Error handling

- **Three.js or solver CDN fails to load:** `mount()` checks `typeof THREE === 'undefined'` (and the equivalent for the solver lib) before constructing the cube. If either is missing, the cube container renders a single error message (`"魔方載入失敗，請重新整理"`) instead. The rest of `app.js`'s mount loop must keep working so other features still load.
- **Solver returns no solution** (should never happen for valid scrambled states, but defensive): replay the scramble in reverse as a fallback. Console warn.
- **Tap during animation:** silently ignored (no visual flicker).

## Testing / verification

No test framework added (per AGENTS.md). Verification is manual + `/verify-frontend`:

1. Page loads with no console errors.
2. Cube renders centered, square, non-stretched at multiple viewport widths (320, 414, 768, 1024).
3. Single tap on cube → scramble + solve animation plays, modal appears at end with one of the 5 meal names.
4. Drag inside cube → camera orbits, no animation triggers.
5. Tap during animation → no double-trigger.
6. Close modal → cube remains solved, idle rotation suppressed if user previously dragged.
7. Reset button → status pills restore, no impact on cube animation state.
8. Emma feature still works (cross-feature regression check).

## Out of scope (explicitly deferred)

- OrbitControls library — hand-rolled pointer math is enough for yaw + pitch only.
- Cube physics / momentum on drag release.
- Solving "from current state of last scramble" without intermediate reset — each click is a fresh full cycle.
- Solver precomputation worker — initial lazy load is acceptable for this app's traffic.
- Accessibility: 3D canvas has no keyboard fallback or screen-reader announcement; the family-app context doesn't require it. If revisited, add a "press space to spin" handler and `aria-live` for the result.
