# Chris 3D Rubik's Cube Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chris feature's 2D 3×3 grid spinner with a Three.js 3D Rubik's cube that scrambles randomly and plays a Kociemba two-phase solve animation on tap.

**Architecture:** Three modules inside `features/chris/`: `cube3d.js` owns the Three.js scene, cubie management, and face-rotation primitive; `solver.js` wraps the Kociemba lib and translates its move notation; `index.js` keeps the mount contract, builds the HTML template, picks the meal, manages the modal, and orchestrates pointer events on the canvas. Three.js and the Kociemba solver load via CDN `<script>` tags in `index.html` (same pattern as Tailwind), so no build step.

**Tech Stack:** Vanilla ES modules, Three.js r160 (UMD CDN), `cubejs` (Kociemba two-phase, UMD CDN), Tailwind CDN (already present). No test framework — verification is `python3 -m http.server 8000` + manual browser walk + `/verify-frontend` Playwright skill.

**Project verification convention:** This project does NOT use a test framework (per AGENTS.md). Each task's "verify" step uses a running `python3 -m http.server 8000` and manual browser inspection. The `/verify-frontend` Playwright skill runs at the end as a regression check. If the local dev server is not already running, the first task starts it; later tasks assume it stays up.

---

## Files Touched

**Create:**
- `features/chris/cube3d.js` — Three.js scene + cubie + rotateLayer + camera orbit
- `features/chris/solver.js` — scramble generator + Kociemba solver wrapper, move notation translation

**Modify:**
- `index.html` — add 3 CDN `<script>` tags (Three.js, cubejs lib + solver)
- `features/chris/index.js` — swap template to canvas, replace 2D animation with cube3d/solver calls, add tap/drag pointer handling
- `features/chris/style.css` — drop `.cube-grid`/`.cube-cell` rules, add `.cube-container canvas` + `cursor: grab` rules, switch `.cube-container` to `aspect-ratio: 1/1`

**Leave alone:** all other features, all shared modules, all root assets, `app.js`.

---

## Task 1: Wire CDN scripts and verify lib globals

**Files:**
- Modify: `index.html` (head, after Tailwind line)

- [ ] **Step 1: Start the local dev server (background)**

From the project root:

```bash
python3 -m http.server 8000
```

Leave this running for the rest of the implementation. All later "verify" steps assume `http://localhost:8000/` is reachable.

- [ ] **Step 2: Add CDN script tags to `index.html`**

Edit `index.html`. After the Tailwind `<script>` line (line 7) and before the first `<link>`, insert three new `<script>` tags:

```html
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cubejs@1.3.3/lib/cube.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/cubejs@1.3.3/lib/solve.js"></script>
    <link rel="stylesheet" href="shared/style.css">
```

- [ ] **Step 3: Verify both globals are present**

Open `http://localhost:8000/` in a browser. Open DevTools console. Type:

```js
typeof THREE
typeof Cube
```

Expected output:
```
'object'
'function'
```

If `Cube` is `'undefined'`, the cubejs CDN URL is wrong. Try `https://cdn.jsdelivr.net/npm/cubejs@1.3.3/lib/cube.js` in a browser tab — it must return JS, not a 404 page. If still broken, fall back to `https://unpkg.com/cubejs@1.3.3/lib/cube.js`. Same for `solve.js`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(chris): load Three.js and cubejs solver via CDN"
```

---

## Task 2: Replace 2D grid template with canvas + scaffold cube3d.js

**Files:**
- Create: `features/chris/cube3d.js`
- Modify: `features/chris/index.js` (TEMPLATE constant, mount body)
- Modify: `features/chris/style.css` (cube container + canvas rules)

- [ ] **Step 1: Create `features/chris/cube3d.js` with a minimal createCube factory**

Write the entire file:

```js
// Three.js scene + cubie management + face rotation primitive.
// Expects window.THREE to be loaded.

const COLORS = {
    right:  0xDC2626,  // +x  red
    left:   0xEA580C,  // -x  orange
    top:    0xF1F5F9,  // +y  white
    bottom: 0xCA8A04,  // -y  yellow
    front:  0x16A34A,  // +z  green
    back:   0x2563EB,  // -z  blue
    inner:  0x0a0a0a,
};

const IDLE_YAW_PER_SEC = 0.04;          // ~ 8 sec / revolution
const CAMERA_RADIUS    = 7.2;
const CAMERA_FOV       = 40;

export function createCube(canvas) {
    const THREE = window.THREE;
    if (!THREE) throw new Error('THREE not loaded');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);

    // camera orbit state
    let camYaw = -0.6;
    let camPitch = 0.55;
    function updateCamera() {
        const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
        const cy = Math.cos(camYaw),   sy = Math.sin(camYaw);
        camera.position.set(CAMERA_RADIUS * cp * sy, CAMERA_RADIUS * sp, CAMERA_RADIUS * cp * cy);
        camera.lookAt(0, 0, 0);
    }
    updateCamera();

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.95);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, -3, -4);
    scene.add(fillLight);

    const cubeRoot = new THREE.Group();
    const cubies = [];
    const geom = new THREE.BoxGeometry(0.94, 0.94, 0.94);

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const mats = [
                    new THREE.MeshStandardMaterial({ color: x ===  1 ? COLORS.right  : COLORS.inner, roughness: 0.55 }),
                    new THREE.MeshStandardMaterial({ color: x === -1 ? COLORS.left   : COLORS.inner, roughness: 0.55 }),
                    new THREE.MeshStandardMaterial({ color: y ===  1 ? COLORS.top    : COLORS.inner, roughness: 0.55 }),
                    new THREE.MeshStandardMaterial({ color: y === -1 ? COLORS.bottom : COLORS.inner, roughness: 0.55 }),
                    new THREE.MeshStandardMaterial({ color: z ===  1 ? COLORS.front  : COLORS.inner, roughness: 0.55 }),
                    new THREE.MeshStandardMaterial({ color: z === -1 ? COLORS.back   : COLORS.inner, roughness: 0.55 }),
                ];
                const mesh = new THREE.Mesh(geom, mats);
                mesh.position.set(x, y, z);
                cubeRoot.add(mesh);
                cubies.push(mesh);
            }
        }
    }
    scene.add(cubeRoot);

    function resize() {
        const r = canvas.getBoundingClientRect();
        const w = Math.max(1, Math.floor(r.width));
        const h = Math.max(1, Math.floor(r.height));
        renderer.setSize(w, h, true);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    // First resize after layout; ResizeObserver in later task.
    requestAnimationFrame(resize);

    function renderOnce() {
        renderer.render(scene, camera);
    }
    renderOnce();

    return {
        renderOnce,
        resize,
        // more methods added in later tasks
    };
}
```

- [ ] **Step 2: Update `features/chris/style.css`**

Replace the `.cube-container`, `.cube-grid`, and `.cube-cell` rule blocks. Find this section in the current file (around lines 21-55):

```css
.cube-container {
    width: min(300px, calc(100vw - 2.5rem));
    height: min(300px, calc(100vw - 2.5rem));
    padding: 12px;
    background: #1a1a1a;
    border: 4px solid #333;
    border-radius: 16px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.8);
    overflow: hidden;
    position: relative;
}
.cube-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 10px;
    width: 100%;
    height: 100%;
    position: relative;
}
.cube-cell {
    background-color: #333;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    font-weight: 900;
    color: #000;
    text-align: center;
    transition: transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s;
    position: relative;
    box-shadow: inset 0 0 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.1);
}
```

Replace with:

```css
.cube-container {
    width: min(300px, calc(100vw - 2.5rem));
    aspect-ratio: 1 / 1;
    background: #1a1a1a;
    border: 4px solid #333;
    border-radius: 16px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.8);
    overflow: hidden;
    position: relative;
    cursor: grab;
}
.cube-container.dragging { cursor: grabbing; }
.cube-container canvas {
    display: block;
    touch-action: none;
}
```

- [ ] **Step 3: Swap the cube template in `features/chris/index.js`**

In `features/chris/index.js`, find the `TEMPLATE` constant. Replace the `.cube-container` block (currently lines 19-31):

```html
    <div class="cube-container mb-6" data-el="cubeTrigger">
        <div data-el="cubeGrid" class="cube-grid cursor-pointer">
            <div class="cube-cell" style="background-color: #DC2626"></div>
            ...nine cells total...
        </div>
    </div>
```

With:

```html
    <div class="cube-container mb-6" data-el="cubeWrap">
        <canvas data-el="cubeCanvas"></canvas>
    </div>
```

Then strip the now-unused parts of `mount()`. In the `els` object (around lines 50-57), remove `cubeTrigger` and `cubeGrid`; add `cubeWrap` and `cubeCanvas`. Replace the `cells` const, `state` (keep `breakfastItems`/`availableIndices`/`isProcessing`), and all of `moveCube`, `startSelection`, `finalizeSelection`, `closeModal`'s cube reset block, and `DEFAULT_CELL_COLORS`. We replace them in the next tasks — for now, leave a placeholder `startSelection` so the click still does *something*.

Replace the `mount()` body so it becomes:

```js
    mount(rootEl) {
        rootEl.innerHTML = TEMPLATE;

        const els = {
            statusList: rootEl.querySelector('[data-el="statusList"]'),
            cubeWrap:   rootEl.querySelector('[data-el="cubeWrap"]'),
            cubeCanvas: rootEl.querySelector('[data-el="cubeCanvas"]'),
            modal:           rootEl.querySelector('[data-el="modal"]'),
            modalColorStrip: rootEl.querySelector('[data-el="modalColorStrip"]'),
            resultText:      rootEl.querySelector('[data-el="resultText"]'),
        };

        const state = {
            breakfastItems: MEALS.chris.map((text, i) => ({ text, color: PALETTE[i % PALETTE.length] })),
            availableIndices: MEALS.chris.map((_, i) => i),
            isProcessing: false,
        };

        // Three.js cube (will throw if THREE missing — error handling task adds graceful fallback)
        const cube = createCube(els.cubeCanvas);

        function playSound(type) {
            // unchanged from existing implementation — copy the existing body
        }

        function renderList() {
            // unchanged — copy the existing body
        }

        function startSelection() {
            // placeholder — replaced in Task 6 to drive the cube
            if (state.isProcessing || state.availableIndices.length === 0) return;
            console.log('cube tap (placeholder)');
        }

        function finalizeSelection() { /* replaced in Task 6 */ }
        function showResult(item) { /* unchanged — copy existing */ }
        function closeModal() {
            els.modal.classList.add('hidden');
        }
        function resetOptions() {
            state.availableIndices = state.breakfastItems.map((_, i) => i);
            renderList();
            closeModal();
        }
        function createConfetti(color) {
            // unchanged — copy existing
        }

        els.cubeWrap.addEventListener('click', startSelection);  // temporary — replaced by pointer logic in Task 5
        rootEl.querySelector('[data-action="reset"]').addEventListener('click', resetOptions);
        rootEl.querySelector('[data-action="closeModal"]').addEventListener('click', closeModal);

        renderList();
    }
```

Also add the import at the top:

```js
import { createCube } from './cube3d.js';
```

Keep the existing `PALETTE` constant. Delete the `DEFAULT_CELL_COLORS` constant.

- [ ] **Step 4: Verify in the browser**

Reload `http://localhost:8000/`. Make sure Chris tab is selected. Expected:
- A 3D Rubik's cube renders inside the dark container, centered, square, not stretched.
- All six face colors visible when you mentally rotate (only 3 visible at this moment; that's fine).
- Browser console: no errors.
- Click the cube → console logs `cube tap (placeholder)`.

If the cube looks stretched, the resize timing is off — the existing `requestAnimationFrame(resize)` should handle it but verify by resizing the browser window: cube must stay square.

- [ ] **Step 5: Commit**

```bash
git add features/chris/cube3d.js features/chris/index.js features/chris/style.css
git commit -m "feat(chris): render static 3D cube via Three.js in canvas"
```

---

## Task 3: Add ResizeObserver + idle auto-rotation render loop

**Files:**
- Modify: `features/chris/cube3d.js`

- [ ] **Step 1: Add a render loop with idle yaw spin and a ResizeObserver in `cube3d.js`**

Inside `createCube`, after the `requestAnimationFrame(resize)` line, add a render loop and observer. Also expose `setIdleSpin(bool)`. The full additions:

Add state variables near the top of the factory body (after `updateCamera()`):

```js
    let idleSpin = true;
    let lastFrameTs = performance.now();
```

Replace the single `renderOnce()` + `requestAnimationFrame(resize)` block with:

```js
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    requestAnimationFrame(resize);

    function loop(now) {
        const dt = (now - lastFrameTs) / 1000;
        lastFrameTs = now;
        if (idleSpin) {
            camYaw += IDLE_YAW_PER_SEC * dt;
            updateCamera();
        }
        renderer.render(scene, camera);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
```

Update the returned API:

```js
    return {
        resize,
        setIdleSpin(on) { idleSpin = !!on; },
    };
```

Delete the old `renderOnce` from the return object.

- [ ] **Step 2: Verify in the browser**

Reload `http://localhost:8000/`. Expected:
- Cube slowly rotates around vertical axis (one revolution ~ every 8 seconds; intentionally slow).
- Resize the browser window → cube stays square, never stretched.
- Console: still no errors.

- [ ] **Step 3: Commit**

```bash
git add features/chris/cube3d.js
git commit -m "feat(chris): add idle auto-rotation and ResizeObserver to cube"
```

---

## Task 4: Implement rotateLayer face-rotation primitive

**Files:**
- Modify: `features/chris/cube3d.js`

- [ ] **Step 1: Add `rotateLayer` and `playMoves` to `cube3d.js`**

Inside `createCube`, after the lights block and before the `loop` definition, add:

```js
    // Pick all cubies whose `axis` coord ≈ `layer`, pivot them around the axis.
    // Three.js Group.attach / cubeRoot.attach preserve world transform during reparent.
    function getLayer(axis, layer) {
        return cubies.filter(c => Math.round(c.position[axis]) === layer);
    }

    function rotateLayer(axis, layer, angle, durationMs) {
        return new Promise(resolve => {
            const group = getLayer(axis, layer);
            const pivot = new THREE.Group();
            scene.add(pivot);
            group.forEach(c => pivot.attach(c));

            const start = performance.now();
            function tick() {
                const t = Math.min(1, (performance.now() - start) / durationMs);
                // cubic ease-in-out
                const eased = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
                pivot.rotation[axis] = angle * eased;
                if (t < 1) requestAnimationFrame(tick);
                else {
                    group.forEach(c => cubeRoot.attach(c));
                    scene.remove(pivot);
                    // Snap cubie positions to integer coords to prevent float drift.
                    group.forEach(c => {
                        c.position.x = Math.round(c.position.x);
                        c.position.y = Math.round(c.position.y);
                        c.position.z = Math.round(c.position.z);
                    });
                    resolve();
                }
            }
            tick();
        });
    }

    async function playMoves(moves, msPerMove) {
        for (const m of moves) {
            await rotateLayer(m.axis, m.layer, m.angle, msPerMove);
        }
    }
```

Add `playMoves` and `rotateLayer` to the returned API (rotateLayer only for diagnostic use):

```js
    return {
        resize,
        setIdleSpin(on) { idleSpin = !!on; },
        playMoves,
        rotateLayer,
    };
```

- [ ] **Step 2: Verify rotateLayer with a console call**

Reload `http://localhost:8000/`. In DevTools, type:

```js
// Cube isn't exposed globally yet — call it via the chris feature's internals.
// Easier: use the menu button to temporarily wire it. Instead, paste this into console
// to drive a manual test using a fresh canvas:
```

Actually for a clean verify, do this — temporarily expose the cube on `window` in `index.js`. Edit the `mount()` body, after `const cube = createCube(els.cubeCanvas);`, add:

```js
        window.__cube = cube;  // DEBUG: remove in Task 5
```

Reload, then in DevTools:

```js
window.__cube.setIdleSpin(false);
await window.__cube.rotateLayer('y', 1, Math.PI / 2, 400);
await window.__cube.rotateLayer('y', 1, -Math.PI / 2, 400);
```

Expected:
- Top layer (white face) rotates 90° clockwise smoothly over 400ms, then back. Cube ends in its original solved orientation.
- After both rotations, the cube looks identical to the start — no leftover skew or floating cubies.

Try a few more axes:

```js
await window.__cube.rotateLayer('x', 1, Math.PI / 2, 400);  // R
await window.__cube.rotateLayer('z', 1, Math.PI / 2, 400);  // F
await window.__cube.rotateLayer('z', 1, -Math.PI / 2, 400); // F'
await window.__cube.rotateLayer('x', 1, -Math.PI / 2, 400); // R'
```

Each move should rotate the correct layer cleanly. After undoing in reverse, cube returns to solved state.

- [ ] **Step 3: Remove the debug global**

Delete the `window.__cube = cube;` line from `index.js`.

- [ ] **Step 4: Commit**

```bash
git add features/chris/cube3d.js
git commit -m "feat(chris): add rotateLayer face-rotation primitive"
```

---

## Task 5: Tap vs drag pointer handling + camera orbit

**Files:**
- Modify: `features/chris/cube3d.js` (add `orbitCamera`, stop-idle helpers)
- Modify: `features/chris/index.js` (pointer events on cubeWrap)

- [ ] **Step 1: Expose `orbitCamera` from `cube3d.js`**

Inside `createCube`, after `updateCamera()`'s first call, add:

```js
    function orbitCamera(dxPx, dyPx) {
        camYaw   -= dxPx * 0.01;
        camPitch += dyPx * 0.01;
        // clamp pitch to ~75° so user can't fly under/over the cube
        camPitch = Math.max(-1.3, Math.min(1.3, camPitch));
        updateCamera();
    }
```

Add `orbitCamera` to the returned API.

- [ ] **Step 2: Replace the temporary click handler in `index.js` with pointer events**

In `mount()`, delete the line `els.cubeWrap.addEventListener('click', startSelection);` and replace with a pointer block:

```js
        // Tap vs drag disambiguation.
        const TAP_DISTANCE_PX = 8;
        const TAP_DURATION_MS = 250;
        let pointerDownAt = 0;
        let pdX = 0, pdY = 0;
        let lastX = 0, lastY = 0;
        let dragging = false;
        let totalDragDistance = 0;

        els.cubeWrap.addEventListener('pointerdown', (e) => {
            pointerDownAt = performance.now();
            pdX = lastX = e.clientX;
            pdY = lastY = e.clientY;
            totalDragDistance = 0;
            dragging = true;
            els.cubeWrap.classList.add('dragging');
            els.cubeWrap.setPointerCapture(e.pointerId);
        });

        els.cubeWrap.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            const dx = e.clientX - lastX;
            const dy = e.clientY - lastY;
            totalDragDistance += Math.hypot(dx, dy);
            lastX = e.clientX;
            lastY = e.clientY;
            if (totalDragDistance > TAP_DISTANCE_PX) {
                cube.setIdleSpin(false);   // user took control of the camera
                cube.orbitCamera(dx, dy);
            }
        });

        els.cubeWrap.addEventListener('pointerup', (e) => {
            const elapsed = performance.now() - pointerDownAt;
            const dist = Math.hypot(e.clientX - pdX, e.clientY - pdY);
            dragging = false;
            els.cubeWrap.classList.remove('dragging');
            els.cubeWrap.releasePointerCapture(e.pointerId);
            if (dist < TAP_DISTANCE_PX && elapsed < TAP_DURATION_MS) {
                startSelection();
            }
        });
```

- [ ] **Step 3: Verify tap and drag both work and are distinct**

Reload `http://localhost:8000/`. Expected:

1. **Tap test:** Quick click on the cube. Console logs `cube tap (placeholder)`. Idle rotation continues.
2. **Drag test:** Click + hold + drag across the cube. Camera orbits smoothly (yaw with horizontal, pitch with vertical). After releasing, idle rotation has stopped. No console log (drag is not a tap).
3. **Pitch clamp test:** Drag down a lot. Camera should never flip past ~vertical (you don't see the cube from "underneath the floor").
4. **No accidental tap during drag:** Even a tiny drag (>8px) should NOT log the placeholder tap.
5. **Cursor changes:** Cursor is `grab` over cube, `grabbing` while pressed.

- [ ] **Step 4: Commit**

```bash
git add features/chris/cube3d.js features/chris/index.js
git commit -m "feat(chris): tap/drag disambiguation with camera orbit on drag"
```

---

## Task 6: Wire solver + scramble + meal-pick into startSelection

**Files:**
- Create: `features/chris/solver.js`
- Modify: `features/chris/index.js` (replace placeholder `startSelection`, `finalizeSelection`, `closeModal`)

- [ ] **Step 1: Create `features/chris/solver.js`**

This module wraps the cubejs library, generates scrambles, runs Kociemba, and translates the move notation into `{axis, layer, angle}`. Write the entire file:

```js
// Wraps the cubejs (Kociemba two-phase) library.
// Expects window.Cube to be loaded.
//
// cubejs uses Singmaster notation: U R F D L B, each optionally followed by
// ' (counterclockwise) or 2 (180°). Faces map to axes/layers:
//   U → +y layer, D → -y layer, R → +x layer, L → -x layer, F → +z layer, B → -z layer
// Direction sign convention matches Three.js right-hand rule for the face's outward normal.

const FACE_TO_MOVE = {
    U: { axis: 'y', layer:  1, sign: -1 },
    D: { axis: 'y', layer: -1, sign:  1 },
    R: { axis: 'x', layer:  1, sign: -1 },
    L: { axis: 'x', layer: -1, sign:  1 },
    F: { axis: 'z', layer:  1, sign: -1 },
    B: { axis: 'z', layer: -1, sign:  1 },
};

let solverInitialized = false;
function ensureSolverInit() {
    if (solverInitialized) return;
    if (!window.Cube) throw new Error('Cube (cubejs) not loaded');
    // Build the Kociemba lookup tables. Synchronous, ~1-2 seconds first call.
    window.Cube.initSolver();
    solverInitialized = true;
}

// Convert a notation string like "R U2 F' D R'" into a move list.
export function parseSequence(sequenceStr) {
    return sequenceStr.trim().split(/\s+/).filter(Boolean).map(token => {
        const face = token[0];
        const mod = token.slice(1); // '', "'", or "2"
        const base = FACE_TO_MOVE[face];
        if (!base) throw new Error('Unknown move: ' + token);
        const turns = mod === '2' ? 2 : 1;
        const dir = mod === "'" ? -1 : 1;
        const angle = base.sign * dir * turns * (Math.PI / 2);
        return { axis: base.axis, layer: base.layer, angle };
    });
}

export function randomScramble(length = 22) {
    const Cube = window.Cube;
    if (!Cube) throw new Error('Cube (cubejs) not loaded');
    // cubejs has its own random scramble generator that avoids redundant adjacent moves.
    // Falls back to manual if absent.
    if (typeof Cube.scramble === 'function') {
        return parseSequence(Cube.scramble(length));
    }
    const faces = ['U', 'D', 'R', 'L', 'F', 'B'];
    const mods = ['', "'", '2'];
    const tokens = [];
    let lastFace = '';
    for (let i = 0; i < length; i++) {
        let face;
        do { face = faces[Math.floor(Math.random() * faces.length)]; }
        while (face === lastFace);
        lastFace = face;
        tokens.push(face + mods[Math.floor(Math.random() * mods.length)]);
    }
    return parseSequence(tokens.join(' '));
}

// Given the scramble moves we just played, return the move list that solves
// the resulting state. Uses Kociemba two-phase. Returns ~18-22 moves typically.
export function solveAfterScramble(scrambleMoves) {
    ensureSolverInit();
    const Cube = window.Cube;
    const cube = new Cube();
    // Replay scramble on a fresh logical cube to get its state, then solve.
    // We use the original sequence string by reversing our parsed moves to notation.
    const notation = movesToNotation(scrambleMoves);
    cube.move(notation);
    const solutionStr = cube.solve();
    return parseSequence(solutionStr);
}

function movesToNotation(moves) {
    // Inverse mapping {axis, layer} → face character.
    const FACE_FROM = {
        'y/1':  { face: 'U', sign: -1 },
        'y/-1': { face: 'D', sign:  1 },
        'x/1':  { face: 'R', sign: -1 },
        'x/-1': { face: 'L', sign:  1 },
        'z/1':  { face: 'F', sign: -1 },
        'z/-1': { face: 'B', sign:  1 },
    };
    return moves.map(m => {
        const key = `${m.axis}/${m.layer}`;
        const info = FACE_FROM[key];
        if (!info) throw new Error('Cannot map move to notation: ' + key);
        // Recover (turns, direction) from angle.
        const quarterTurns = Math.round(m.angle / (Math.PI / 2));  // ±1, ±2
        const absTurns = Math.abs(quarterTurns);
        const signedDir = Math.sign(quarterTurns) * info.sign;  // +1 = clockwise, -1 = ccw
        if (absTurns === 2) return info.face + '2';
        return info.face + (signedDir === -1 ? "'" : '');
    }).join(' ');
}
```

- [ ] **Step 2: Replace the placeholder `startSelection` and `finalizeSelection` in `index.js`**

Add the solver import at the top:

```js
import { randomScramble, solveAfterScramble } from './solver.js';
```

Replace the placeholder `startSelection` and `finalizeSelection` with:

```js
        const SCRAMBLE_LENGTH = 22;
        const SCRAMBLE_MS_PER = 80;
        const SOLVE_MS_PER    = 320;
        const POST_SOLVE_PAUSE_MS = 400;

        async function startSelection() {
            if (state.isProcessing || state.availableIndices.length === 0) return;
            state.isProcessing = true;
            playSound('tick');

            const scramble = randomScramble(SCRAMBLE_LENGTH);
            await cube.playMoves(scramble, SCRAMBLE_MS_PER);

            const solution = solveAfterScramble(scramble);
            await cube.playMoves(solution, SOLVE_MS_PER);

            await new Promise(r => setTimeout(r, POST_SOLVE_PAUSE_MS));
            finalizeSelection();
        }

        function finalizeSelection() {
            const luckyIdx = Math.floor(Math.random() * state.availableIndices.length);
            const itemIdx = state.availableIndices[luckyIdx];
            const result = state.breakfastItems[itemIdx];
            state.availableIndices.splice(luckyIdx, 1);
            showResult(result);
            renderList();
            state.isProcessing = false;
        }
```

Also keep `playSound`, `renderList`, `showResult`, `createConfetti`, `resetOptions` — they're all unchanged from the original 2D implementation.

Update `closeModal` (the cube reset block from the old implementation is no longer needed):

```js
        function closeModal() {
            els.modal.classList.add('hidden');
        }
```

- [ ] **Step 3: Verify end-to-end in the browser**

Reload `http://localhost:8000/`. Make sure Chris tab is selected. Expected:

1. Cube renders idle, slowly rotating.
2. Tap cube once. Sequence:
   - First tap triggers a ~1-2 second delay (solver initializing — `Cube.initSolver()`). Subsequent taps are immediate.
   - Cube scrambles quickly (~2 seconds, lots of fast face turns).
   - Cube smoothly solves back to fully-solved state (~6-7 seconds).
   - ~400ms beat, then modal pops up showing one of the 5 chris meals (e.g. "貝果").
3. Click "準備開動" → modal closes. Cube stays solved, idle rotation resumes (unless user had dragged earlier).
4. Tap again → another scramble + solve. The picked meal pill in the status list above shows strike-through after each pick.
5. After 5 picks (the menu is exhausted), additional taps don't trigger anything (`availableIndices.length === 0` guard).
6. Click "重置進度" → all pills restore, picks can resume.

If the solver throws "Unknown move" or "Cannot map move", the move notation mapping in `solver.js` has a bug — print the raw `Cube.scramble()` or `cube.solve()` output and compare against the `FACE_TO_MOVE` table.

If the cube ends up in a non-solved state after the solve animation, the axis/layer/sign mapping in `FACE_TO_MOVE` is wrong for the failing face. Test each face individually:

```js
import { parseSequence } from './features/chris/solver.js';
// In DevTools paste this to test one face at a time:
const ms = parseSequence("R R R R");  // Should be a no-op for that face.
// Then call cube.playMoves(ms, 200) and confirm cube returns to start.
```

- [ ] **Step 4: Commit**

```bash
git add features/chris/solver.js features/chris/index.js
git commit -m "feat(chris): wire Kociemba solver to scramble+solve animation"
```

---

## Task 7: Graceful error fallback when CDN libs fail

**Files:**
- Modify: `features/chris/index.js` (guard in mount)

- [ ] **Step 1: Add a guard at the top of `mount()`**

Right after `rootEl.innerHTML = TEMPLATE;`, before the `els` object, add:

```js
        // Guard against CDN load failure — don't crash app.js's mount loop.
        if (typeof window.THREE === 'undefined' || typeof window.Cube === 'undefined') {
            const wrap = rootEl.querySelector('[data-el="cubeWrap"]');
            if (wrap) {
                wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#888;font-size:14px;font-weight:700;text-align:center;padding:20px">魔方載入失敗，<br>請重新整理</div>';
            }
            return;
        }
```

- [ ] **Step 2: Verify the fallback path renders correctly**

Temporarily break one of the CDN URLs to simulate a failed load. Edit `index.html` and change the cubejs `<script>` src to something obviously wrong, e.g.:

```html
    <script src="https://cdn.jsdelivr.net/npm/cubejs@1.3.3/lib/BROKEN-cube.js"></script>
```

Reload `http://localhost:8000/`. Expected:
- Inside the dark cube container, the message "魔方載入失敗，請重新整理" appears.
- Console shows a 404 for the broken script.
- No JavaScript errors thrown by `chris/index.js`.
- Emma tab still works (switch to it and confirm).

Revert the URL back to the correct one.

- [ ] **Step 3: Commit**

```bash
git add features/chris/index.js
git commit -m "feat(chris): graceful fallback when Three.js or solver CDN fails"
```

---

## Task 8: Cross-feature regression + final verification

**Files:** none modified — verification only

- [ ] **Step 1: Walk the full Chris flow**

Reload `http://localhost:8000/` with Chris tab selected. Test in order:

1. **Idle:** cube slowly rotates, "點魔方啟動引擎！" bobs.
2. **First pick:** tap cube → scramble → solve → modal. Modal shows one of the 5 meals. Close modal.
3. **Status pill:** the picked meal pill is now strike-through.
4. **Subsequent picks:** repeat until all 5 are picked. The 6th tap does nothing (silent guard).
5. **Reset:** click "重置進度" → pills restore.
6. **Drag camera:** drag inside cube → camera orbits, idle rotation stops permanently.
7. **Tap after drag:** tap still triggers the animation (camera stays where user placed it).
8. **Modal while animation playing:** tapping during scramble or solve does nothing (no second animation queued).

- [ ] **Step 2: Cross-feature smoke test**

Click "🐱 Emma" toggle. Confirm Emma feature still works (her existing UI loads, no console errors).
Click "🚿 Shower" toggle. Confirm Shower feature still works.
Click back to "🧊 Chris". Confirm cube is still in its previous state and responsive.

- [ ] **Step 3: Run `/verify-frontend` Playwright walk**

Trigger the verify-frontend skill from Claude Code:

```
/verify-frontend
```

When prompted, target `http://localhost:8000/` (the project's AGENTS.md notes that the skill's default `file://` URL does NOT work — ES modules require http).

Expected: no console errors, all three features render, screenshots show the 3D cube in chris feature.

- [ ] **Step 4: Final commit (only if not already clean)**

```bash
git status
```

If clean, done. If there are stray debug `console.log`s or commented-out code left over from earlier tasks, remove them and commit:

```bash
git add -p
git commit -m "chore(chris): clean up after 3D cube migration"
```

---

## Done

All tasks complete. The chris feature now uses a real 3D Three.js Rubik's cube that scrambles randomly and plays a Kociemba-optimal solve animation on each tap. Meal-pick logic and modal behavior are unchanged. Drag-to-rotate camera lets the kid inspect the cube from any angle.
