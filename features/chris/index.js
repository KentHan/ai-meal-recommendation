import { MEALS } from '../../shared/data.js';
import { getAudioCtx } from '../../shared/audio.js';
import { createCube } from './cube3d.js';
import { randomScramble, solveAfterScramble } from './solver.js';

const PALETTE = ["#DC2626", "#16A34A", "#2563EB", "#CA8A04", "#EA580C"];

const TEMPLATE = `
    <div class="text-center mb-8">
        <h1 class="text-3xl sm:text-4xl font-black italic tracking-tighter text-blue-500 mb-1">CUBE BREAKFAST</h1>
        <p class="text-gray-500 text-sm font-bold uppercase tracking-widest">兒子專屬機械魔方</p>
    </div>
    <div class="mb-8 w-full max-w-sm">
        <div class="flex justify-between items-end mb-3 px-1">
            <h2 class="text-lg font-black text-white border-b-2 border-blue-500">今日選單</h2>
            <button data-action="reset" class="text-[10px] font-bold text-gray-400 border border-gray-700 px-2 py-1 rounded hover:bg-gray-800 transition">重置進度</button>
        </div>
        <div data-el="statusList" class="flex flex-wrap gap-2 justify-center"></div>
    </div>
    <div class="cube-container mb-6" data-el="cubeWrap">
        <canvas data-el="cubeCanvas"></canvas>
    </div>
    <p data-el="status" class="text-center text-gray-600 text-xs font-bold animate-bounce">點擊方塊啟動引擎！</p>
    <div data-el="modal" class="fixed inset-0 bg-black/95 flex items-center justify-center z-50 hidden p-6 backdrop-blur-md">
        <div class="bg-gray-900 border-2 border-blue-500 p-8 rounded-2xl text-center max-w-sm w-full shadow-[0_0_50px_rgba(59,130,246,0.3)]">
            <div data-el="modalColorStrip" class="h-2 w-16 mx-auto rounded-full mb-6"></div>
            <p class="text-gray-400 font-bold mb-2 tracking-widest text-xs uppercase">Target Acquired</p>
            <h3 data-el="resultText" class="text-4xl font-black mb-8 text-white tracking-tight"></h3>
            <button data-action="closeModal" class="w-full bg-blue-600 text-white font-black py-4 rounded-xl hover:bg-blue-500 transition text-lg shadow-lg">準備開動</button>
        </div>
    </div>
`;

export default {
    id: 'chris',
    label: 'Chris',
    emoji: '🧊',
    mount(rootEl) {
        rootEl.innerHTML = TEMPLATE;

        // Guard against CDN load failure — don't crash app.js's mount loop.
        if (typeof window.THREE === 'undefined' || typeof window.Cube === 'undefined') {
            const wrap = rootEl.querySelector('[data-el="cubeWrap"]');
            if (wrap) {
                wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:#888;font-size:14px;font-weight:700;text-align:center;padding:20px">魔方載入失敗，<br>請重新整理</div>';
            }
            return;
        }

        const els = {
            statusList:      rootEl.querySelector('[data-el="statusList"]'),
            cubeWrap:        rootEl.querySelector('[data-el="cubeWrap"]'),
            cubeCanvas:      rootEl.querySelector('[data-el="cubeCanvas"]'),
            status:          rootEl.querySelector('[data-el="status"]'),
            modal:           rootEl.querySelector('[data-el="modal"]'),
            modalColorStrip: rootEl.querySelector('[data-el="modalColorStrip"]'),
            resultText:      rootEl.querySelector('[data-el="resultText"]'),
        };

        const state = {
            breakfastItems: MEALS.chris.map((text, i) => ({ text, color: PALETTE[i % PALETTE.length] })),
            availableIndices: MEALS.chris.map((_, i) => i),
            isProcessing: false,
        };

        // Three.js cube (will throw if THREE missing — graceful fallback added in Task 7).
        const cube = createCube(els.cubeCanvas);

        function playSound(type) {
            const ctx = getAudioCtx();
            const startTime = ctx.currentTime;

            if (type === 'tick') {
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'square';
                osc1.frequency.setValueAtTime(120, startTime);
                osc1.frequency.linearRampToValueAtTime(40, startTime + 0.08);
                gain1.gain.setValueAtTime(0.08, startTime);
                gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(startTime);
                osc1.stop(startTime + 0.08);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'triangle';
                osc2.frequency.setValueAtTime(800, startTime);
                gain2.gain.setValueAtTime(0.02, startTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(startTime);
                osc2.stop(startTime + 0.04);
            } else if (type === 'win') {
                [440, 554, 659, 880].forEach((freq, i) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, startTime + i * 0.08);
                    gain.gain.setValueAtTime(0.1, startTime + i * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.01, startTime + i * 0.08 + 0.3);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(startTime + i * 0.08);
                    osc.stop(startTime + i * 0.08 + 0.4);
                });
            }
        }

        function renderList() {
            els.statusList.innerHTML = '';
            state.breakfastItems.forEach((item, idx) => {
                const isRemoved = !state.availableIndices.includes(idx);
                const span = document.createElement('div');
                span.className = `option-tag px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 ${isRemoved ? 'removed bg-gray-800/20 border-gray-800 text-gray-600' : 'bg-gray-800 border-gray-700 text-white'}`;
                span.innerHTML = `<div class="w-2 h-2 rounded-full shadow-[0_0_5px_rgba(255,255,255,0.2)]" style="background-color: ${item.color}"></div>${item.text}`;
                els.statusList.appendChild(span);
            });
        }

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

        const SCRAMBLE_LENGTH = 15;
        const SCRAMBLE_MS_PER = 80;
        const POST_SCRAMBLE_PAUSE_MS = 3000;
        const SOLVE_MS_PER    = 320;
        const POST_SOLVE_PAUSE_MS = 400;

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

        function finalizeSelection() {
            const luckyIdx = Math.floor(Math.random() * state.availableIndices.length);
            const itemIdx = state.availableIndices[luckyIdx];
            const result = state.breakfastItems[itemIdx];
            state.availableIndices.splice(luckyIdx, 1);
            showResult(result);
            renderList();
            state.isProcessing = false;
        }

        function showResult(item) {
            els.resultText.innerText = item.text;
            els.modalColorStrip.style.backgroundColor = item.color;
            els.modal.classList.remove('hidden');
            playSound('win');
            createConfetti(item.color);
        }

        function closeModal() {
            els.modal.classList.add('hidden');
            setStatus('idle');
        }

        function resetOptions() {
            state.availableIndices = state.breakfastItems.map((_, i) => i);
            renderList();
            closeModal();
        }

        function createConfetti(color) {
            for (let i = 0; i < 50; i++) {
                const conf = document.createElement('div');
                conf.className = 'confetti';
                conf.style.left = '50vw';
                conf.style.top = '50vh';
                conf.style.backgroundColor = color;
                conf.style.borderRadius = '2px';
                document.body.appendChild(conf);
                const angle = Math.random() * Math.PI * 2;
                const dist = 100 + Math.random() * 250;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;
                conf.animate([
                    { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
                    { transform: `translate(${tx}px, ${ty}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }
                ], { duration: 1200 + Math.random() * 800, easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' }).onfinish = () => conf.remove();
            }
        }

        // Tap vs drag disambiguation.
        const TAP_DISTANCE_PX = 8;
        const TAP_DURATION_MS = 250;
        let pointerDownAt = 0;
        let pdX = 0, pdY = 0;
        let lastX = 0, lastY = 0;
        let dragging = false;
        let totalDragDistance = 0;
        // Once the user drags, idle auto-rotation stops for the session (their angle is preserved).
        let userTookOverCamera = false;

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
                userTookOverCamera = true;
                cube.setIdleSpin(false);
                cube.orbitCamera(dx, dy);
            }
        });

        els.cubeWrap.addEventListener('pointerup', (e) => {
            if (!dragging) return;
            const elapsed = performance.now() - pointerDownAt;
            const dist = Math.hypot(e.clientX - pdX, e.clientY - pdY);
            dragging = false;
            els.cubeWrap.classList.remove('dragging');
            els.cubeWrap.releasePointerCapture(e.pointerId);
            if (!state.isProcessing && dist < TAP_DISTANCE_PX && elapsed < TAP_DURATION_MS) {
                startSelection();
            }
        });
        rootEl.querySelector('[data-action="reset"]').addEventListener('click', resetOptions);
        rootEl.querySelector('[data-action="closeModal"]').addEventListener('click', closeModal);

        renderList();
    }
};
