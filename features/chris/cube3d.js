// Three.js scene + cubie management + face rotation primitive.
// Expects window.THREE to be loaded.

const COLORS = {
    right:  0xEF4444,  // +x  red    (Tailwind red-500)
    left:   0xF97316,  // -x  orange (orange-500)
    top:    0xFFFFFF,  // +y  white  (pure white)
    bottom: 0xFACC15,  // -y  yellow (yellow-400)
    front:  0x22C55E,  // +z  green  (green-500)
    back:   0x3B82F6,  // -z  blue   (blue-500)
    inner:  0x0a0a0a,
};

const IDLE_YAW_PER_SEC = 0.04;          // ~ 8 sec / revolution
const CAMERA_RADIUS    = 10;
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

    function orbitCamera(dxPx, dyPx) {
        camYaw   -= dxPx * 0.01;
        camPitch += dyPx * 0.01;
        // Clamp pitch to ~75° so user can't fly under/over the cube.
        camPitch = Math.max(-1.3, Math.min(1.3, camPitch));
        updateCamera();
    }

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

    // Returns the 9 cubies whose `axis` coordinate is approximately `layer`.
    function getLayer(axis, layer) {
        return cubies.filter(c => Math.round(c.position[axis]) === layer);
    }

    // Animate a face rotation. `axis` ∈ {'x','y','z'}, `layer` ∈ {-1,0,1}, `angle` in radians.
    // Uses a temporary Group as pivot; THREE.attach preserves world transforms on reparent.
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
                    // Snap to integer positions to prevent float drift after many rotations.
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

    async function playMoves(moves, msPerMove, onStep) {
        for (let i = 0; i < moves.length; i++) {
            const m = moves[i];
            await rotateLayer(m.axis, m.layer, m.angle, msPerMove);
            onStep?.(i + 1, moves.length);
        }
    }

    function resize() {
        const parent = canvas.parentElement;
        const r = parent.getBoundingClientRect();
        const w = Math.max(1, Math.floor(r.width));
        const h = Math.max(1, Math.floor(r.height));
        renderer.setSize(w, h, true);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    // Observe the parent — its size changes with layout, the canvas's only changes when we set it.
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);
    requestAnimationFrame(resize);

    let idleSpin = true;
    let lastFrameTs = performance.now();
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

    return {
        resize,
        setIdleSpin(on) { idleSpin = !!on; },
        rotateLayer,
        playMoves,
        orbitCamera,
    };
}
