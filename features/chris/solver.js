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
    // Build the Kociemba lookup tables. Synchronous, ~1-2 seconds on first call.
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
    // cubejs has its own scramble generator that avoids redundant adjacent moves.
    // Note: Cube.scramble() internally calls solve(), which requires the
    // Kociemba lookup tables — so initSolver() must run first.
    if (typeof Cube.scramble === 'function') {
        ensureSolverInit();
        return parseSequence(Cube.scramble(length));
    }
    // Fallback: generate manually, avoiding consecutive same-face moves.
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
// the resulting state. Uses Kociemba two-phase. ~18-22 moves typically.
export function solveAfterScramble(scrambleMoves) {
    ensureSolverInit();
    const Cube = window.Cube;
    const cube = new Cube();
    const notation = movesToNotation(scrambleMoves);
    cube.move(notation);
    const solutionStr = cube.solve();
    return parseSequence(solutionStr);
}

// Inverse of parseSequence — used to feed our scramble moves back into cubejs.
function movesToNotation(moves) {
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
        const quarterTurns = Math.round(m.angle / (Math.PI / 2));
        const absTurns = Math.abs(quarterTurns);
        const signedDir = Math.sign(quarterTurns) * info.sign;
        if (absTurns === 2) return info.face + '2';
        return info.face + (signedDir === -1 ? "'" : '');
    }).join(' ');
}
