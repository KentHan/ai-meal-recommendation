import { MEALS } from '../../shared/data.js';
import { getAudioCtx } from '../../shared/audio.js';

const PALETTE = ["#DC2626", "#16A34A", "#2563EB", "#CA8A04", "#EA580C"];
const DEFAULT_CELL_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#EA580C', '#CA8A04', '#F1F5F9', '#DC2626', '#2563EB', '#16A34A'];

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
    <div class="cube-container mb-6" data-el="cubeTrigger">
        <div data-el="cubeGrid" class="cube-grid cursor-pointer">
            <div class="cube-cell" style="background-color: #DC2626"></div>
            <div class="cube-cell" style="background-color: #2563EB"></div>
            <div class="cube-cell" style="background-color: #16A34A"></div>
            <div class="cube-cell" style="background-color: #EA580C"></div>
            <div class="cube-cell" style="background-color: #CA8A04"></div>
            <div class="cube-cell" style="background-color: #F1F5F9"></div>
            <div class="cube-cell" style="background-color: #DC2626"></div>
            <div class="cube-cell" style="background-color: #2563EB"></div>
            <div class="cube-cell" style="background-color: #16A34A"></div>
        </div>
    </div>
    <p class="text-center text-gray-600 text-xs font-bold animate-bounce">點擊方塊啟動引擎！</p>
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

        const els = {
            statusList: rootEl.querySelector('[data-el="statusList"]'),
            cubeTrigger: rootEl.querySelector('[data-el="cubeTrigger"]'),
            cubeGrid: rootEl.querySelector('[data-el="cubeGrid"]'),
            modal: rootEl.querySelector('[data-el="modal"]'),
            modalColorStrip: rootEl.querySelector('[data-el="modalColorStrip"]'),
            resultText: rootEl.querySelector('[data-el="resultText"]'),
        };
        const cells = els.cubeGrid.querySelectorAll('.cube-cell');

        const state = {
            breakfastItems: MEALS.chris.map((text, i) => ({ text, color: PALETTE[i % PALETTE.length] })),
            availableIndices: MEALS.chris.map((_, i) => i),
            isProcessing: false,
        };

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

        function moveCube() {
            const isRow = Math.random() > 0.5;
            const index = Math.floor(Math.random() * 3);
            const direction = Math.random() > 0.5 ? 1 : -1;

            const cellElements = [];
            if (isRow) {
                for (let i = 0; i < 3; i++) cellElements.push(cells[index * 3 + i]);
            } else {
                for (let i = 0; i < 3; i++) cellElements.push(cells[index + i * 3]);
            }

            playSound('tick');

            cellElements.forEach(el => {
                const moveVal = direction * 105;
                el.style.transform = isRow ? `translateX(${moveVal}%)` : `translateY(${moveVal}%)`;
            });

            setTimeout(() => {
                cellElements.forEach(el => {
                    el.style.transition = 'none';
                    el.style.transform = 'translate(0,0)';
                    const randomItemIdx = Math.floor(Math.random() * state.breakfastItems.length);
                    el.style.backgroundColor = state.breakfastItems[randomItemIdx].color;
                    setTimeout(() => el.style.transition = 'transform 0.18s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s', 10);
                });
            }, 180);
        }

        function startSelection() {
            if (state.isProcessing || state.availableIndices.length === 0) return;
            state.isProcessing = true;

            let count = 0;
            const maxMoves = 18;
            const interval = setInterval(() => {
                moveCube();
                count++;
                if (count >= maxMoves) {
                    clearInterval(interval);
                    setTimeout(finalizeSelection, 400);
                }
            }, 220);
        }

        function finalizeSelection() {
            const luckyIdx = Math.floor(Math.random() * state.availableIndices.length);
            const itemIdx = state.availableIndices[luckyIdx];
            const result = state.breakfastItems[itemIdx];

            cells.forEach((cell, i) => {
                cell.style.backgroundColor = result.color;
                cell.style.boxShadow = `inset 0 0 20px rgba(0,0,0,0.5), 0 0 15px ${result.color}44`;
                if (i === 4) cell.innerText = result.text;
            });

            state.availableIndices.splice(luckyIdx, 1);

            setTimeout(() => {
                showResult(result);
                renderList();
                state.isProcessing = false;
            }, 700);
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
            cells.forEach((cell, i) => {
                cell.style.backgroundColor = DEFAULT_CELL_COLORS[i];
                cell.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)';
                cell.innerText = "";
            });
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

        els.cubeTrigger.addEventListener('click', startSelection);
        rootEl.querySelector('[data-action="reset"]').addEventListener('click', resetOptions);
        rootEl.querySelector('[data-action="closeModal"]').addEventListener('click', closeModal);

        renderList();
    }
};
