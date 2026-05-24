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
        const parent = canvas.parentElement;
        const r = parent.getBoundingClientRect();
        const w = Math.max(1, Math.floor(r.width));
        const h = Math.max(1, Math.floor(r.height));
        renderer.setSize(w, h, true);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }

    // First resize after layout; ResizeObserver added in later task.
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
