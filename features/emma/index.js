import { MEALS } from '../../shared/data.js';
import { getAudioCtx } from '../../shared/audio.js';

const TEMPLATE = `
    <div class="main-wrapper">
        <div class="max-w-6xl w-full flex flex-col lg:flex-row gap-6 items-start justify-center">

            <div class="panel-card p-5 md:p-10 flex flex-col items-center">
                <h1 class="text-2xl md:text-4xl font-bold text-pink-400 mb-1 tracking-widest text-center" style="font-family: 'ZCOOL KuaiLe', sans-serif;">🐾 喵喵早餐輪盤 🐾</h1>
                <p class="text-pink-300 mb-8 text-sm md:text-base font-medium text-center">今天想吃哪一個呢？喵～</p>

                <div class="canvas-container mb-6 sm:mb-10">
                    <div class="pointer-container">
                        <svg viewBox="0 0 100 100" class="cat-pointer">
                            <circle cx="50" cy="50" r="40" fill="white" stroke="#ffb3c1" stroke-width="3"/>
                            <path d="M25 25 L15 5 L40 15 Z" fill="white" stroke="#ffb3c1" stroke-width="2"/>
                            <path d="M75 25 L85 5 L60 15 Z" fill="white" stroke="#ffb3c1" stroke-width="2"/>
                            <circle cx="35" cy="45" r="3" fill="#555"/>
                            <circle cx="65" cy="45" r="3" fill="#555"/>
                            <path d="M45 55 Q50 60 55 55" fill="none" stroke="#ffb3c1" stroke-width="2"/>
                            <path d="M50 85 L40 100 L60 100 Z" fill="#ff9aaf" />
                        </svg>
                    </div>
                    <canvas id="emmaWheelCanvas" data-el="wheelCanvas" width="800" height="800"></canvas>
                </div>

                <button data-el="spinBtn" class="cute-button text-white font-black py-4 px-12 md:py-5 md:px-16 rounded-full text-xl md:text-3xl mb-2 tracking-wider w-full sm:w-auto">
                    開始旋轉！
                </button>
            </div>

            <div class="w-full lg:w-2/5 flex flex-col gap-4">
                <div class="panel-card p-6">
                    <h2 class="text-xl font-bold text-pink-500 mb-4 flex items-center gap-2">
                        <span class="bg-pink-100 p-2 rounded-full text-sm">🍳</span> 選項名單
                    </h2>
                    <ul data-el="activeList" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 mb-6"></ul>

                    <div class="h-0.5 bg-pink-50 rounded-full mb-6"></div>

                    <h2 class="text-lg font-bold text-gray-300 mb-3 flex items-center gap-2">
                        <span class="grayscale text-sm">😸</span> 已經轉到了
                    </h2>
                    <ul data-el="removedList" class="space-y-2"></ul>
                </div>
            </div>
        </div>
    </div>

    <div data-el="modal" class="fixed inset-0 bg-pink-200/40 backdrop-blur-sm hidden flex items-center justify-center z-50 p-6">
        <div class="bg-white rounded-[32px] p-8 max-w-sm w-full text-center shadow-2xl border-4 border-pink-100 scale-in">
            <canvas data-el="modalCatCanvas" width="150" height="150" class="mx-auto mb-2"></canvas>
            <h3 class="text-xl font-bold text-pink-400 mb-1">喵！決定了！</h3>
            <p data-el="modalMsg" class="text-2xl text-gray-700 font-black mb-6"></p>
            <div class="flex flex-col gap-3">
                <button data-action="confirm" class="bg-pink-400 text-white font-bold py-4 rounded-2xl hover:bg-pink-500 transition shadow-lg active:scale-95">
                    太棒了，就吃這個！
                </button>
                <button data-action="close" class="bg-gray-100 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-200 transition active:scale-95">
                    喵～想再轉一次
                </button>
            </div>
        </div>
    </div>
`;

function drawCat(ctx, x, y, size, breakfastType) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#ffdee7";
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.ellipse(0, 0, size, size*0.8, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-size*0.6, -size*0.5); ctx.lineTo(-size*0.8, -size); ctx.lineTo(-size*0.2, -size*0.7);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(size*0.6, -size*0.5); ctx.lineTo(size*0.8, -size); ctx.lineTo(size*0.2, -size*0.7);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#444";
    ctx.beginPath(); ctx.arc(-size*0.3, -size*0.1, size*0.08, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(size*0.3, -size*0.1, size*0.08, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = "#ffcad4";
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(-size*0.5, size*0.1, size*0.15, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(size*0.5, size*0.1, size*0.15, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = "#ff9aaf";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0.1, size*0.1, 0, Math.PI); ctx.stroke();

    ctx.font = `${size}px serif`;
    ctx.textAlign = "center";
    let icon = "🥯";
    if(breakfastType === "鮪魚蛋吐司") icon = "🥪";
    if(breakfastType === "肉鬆蛋吐司") icon = "🍞";
    if(breakfastType === "穀片") icon = "🥣";
    if(breakfastType === "葡萄乾吐司") icon = "🍇";
    if(breakfastType === "地瓜") icon = "🍠";
    if(breakfastType === "小叮噹蛋糕") icon = "🎂";

    if(breakfastType) ctx.fillText(icon, 0, size * 0.8);

    ctx.restore();
}

export default {
    id: 'emma',
    label: 'Emma',
    emoji: '🐱',
    mount(rootEl) {
        rootEl.innerHTML = TEMPLATE;

        const els = {
            wheelCanvas: rootEl.querySelector('[data-el="wheelCanvas"]'),
            spinBtn: rootEl.querySelector('[data-el="spinBtn"]'),
            activeList: rootEl.querySelector('[data-el="activeList"]'),
            removedList: rootEl.querySelector('[data-el="removedList"]'),
            modal: rootEl.querySelector('[data-el="modal"]'),
            modalMsg: rootEl.querySelector('[data-el="modalMsg"]'),
            modalCatCanvas: rootEl.querySelector('[data-el="modalCatCanvas"]'),
        };
        const wheelCtx = els.wheelCanvas.getContext('2d');

        const state = {
            options: [...MEALS.emma],
            removedOptions: [],
            currentRotation: 0,
            isSpinning: false,
            selectedIndex: -1,
        };

        const meowAudio = new Audio('features/emma/assets/cat-meow.mp3');
        meowAudio.preload = 'auto';
        meowAudio.volume = 0.5;

        function playSfx(freq, type, dur) {
            try {
                const ctx = getAudioCtx();
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                g.gain.setValueAtTime(0.05, ctx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(); osc.stop(ctx.currentTime + dur);
            } catch(e) {}
        }

        function playMeow() {
            try {
                meowAudio.currentTime = 0;
                meowAudio.play();
            } catch(e) {}
        }

        function drawWheel() {
            const size = els.wheelCanvas.width;
            const center = size / 2;
            const radius = center - 40;
            wheelCtx.clearRect(0, 0, size, size);

            if (state.options.length === 0) {
                wheelCtx.fillStyle = "#ffdee7";
                wheelCtx.beginPath(); wheelCtx.arc(center, center, radius, 0, Math.PI*2); wheelCtx.fill();
                wheelCtx.fillStyle = "#ff9aaf";
                wheelCtx.font = "bold 40px sans-serif";
                wheelCtx.textAlign = "center";
                wheelCtx.fillText("請復原喵喵～", center, center);
                return;
            }

            const arcSize = (Math.PI * 2) / state.options.length;
            state.options.forEach((opt, i) => {
                const angle = i * arcSize;
                wheelCtx.fillStyle = i % 2 === 0 ? "#ffffff" : "#fff0f3";
                wheelCtx.beginPath();
                wheelCtx.moveTo(center, center);
                wheelCtx.arc(center, center, radius, angle, angle + arcSize);
                wheelCtx.fill();
                wheelCtx.strokeStyle = "#ffdee7";
                wheelCtx.lineWidth = 4;
                wheelCtx.stroke();

                wheelCtx.save();
                wheelCtx.translate(center, center);
                wheelCtx.rotate(angle + arcSize / 2);
                drawCat(wheelCtx, radius * 0.65, 0, 40, opt);
                wheelCtx.rotate(Math.PI / 2);
                wheelCtx.fillStyle = "#ff8fa3";
                wheelCtx.font = state.options.length > 8 ? "bold 24px sans-serif" : "bold 28px sans-serif";
                wheelCtx.textAlign = "center";
                wheelCtx.fillText(opt, 0, -radius * 0.35);
                wheelCtx.restore();
            });

            wheelCtx.fillStyle = "white";
            wheelCtx.beginPath(); wheelCtx.arc(center, center, 80, 0, Math.PI*2); wheelCtx.fill();
            wheelCtx.strokeStyle = "#ffdee7";
            wheelCtx.lineWidth = 6;
            wheelCtx.stroke();
            drawCat(wheelCtx, center, center, 45, "");
        }

        function spin() {
            if (state.isSpinning || state.options.length === 0) return;
            getAudioCtx();

            state.isSpinning = true;
            const duration = 4000;
            const extraSpins = 8 + Math.random() * 5;
            const totalRotation = extraSpins * 360 + Math.random() * 360;

            state.currentRotation += totalRotation;
            els.wheelCanvas.style.transform = `rotate(${state.currentRotation}deg)`;

            let ticks = 0;
            const interval = setInterval(() => {
                if(!state.isSpinning) return;
                playSfx(600 + (ticks % 5 * 100), 'sine', 0.1);
                ticks++;
            }, 150);

            setTimeout(() => {
                clearInterval(interval);
                state.isSpinning = false;
                const actual = (state.currentRotation % 360);
                const arc = 360 / state.options.length;
                const adjusted = (360 - actual + 270) % 360;
                state.selectedIndex = Math.floor(adjusted / arc) % state.options.length;

                playMeow();
                showResult(state.options[state.selectedIndex]);
            }, duration);
        }

        function showResult(item) {
            els.modalMsg.innerText = item;
            const mCtx = els.modalCatCanvas.getContext('2d');
            mCtx.clearRect(0, 0, 150, 150);
            drawCat(mCtx, 75, 75, 50, item);
            els.modal.classList.remove('hidden');
        }

        function closeModal() {
            els.modal.classList.add('hidden');
        }

        function confirmRemoval() {
            if (state.selectedIndex !== -1) {
                state.removedOptions.push(state.options.splice(state.selectedIndex, 1)[0]);
                state.selectedIndex = -1;
                drawWheel();
                updateLists();
                closeModal();
            }
        }

        function restoreItem(index) {
            state.options.push(state.removedOptions.splice(index, 1)[0]);
            drawWheel();
            updateLists();
        }

        function updateLists() {
            els.activeList.innerHTML = state.options.map(item =>
                `<li class="list-item flex items-center gap-3 p-3 rounded-2xl shadow-sm">
                    <span class="text-2xl">🐱</span>
                    <span class="font-bold text-gray-600 text-base">${item}</span>
                </li>`
            ).join('');

            els.removedList.innerHTML = state.removedOptions.map((item, index) =>
                `<li class="flex justify-between items-center bg-white/50 p-2 px-4 rounded-xl text-gray-300">
                    <span class="line-through text-sm">${item}</span>
                    <button data-restore-index="${index}" class="text-xs bg-pink-50 text-pink-400 px-3 py-1 rounded-full border border-pink-100 active:bg-pink-100">復原</button>
                </li>`
            ).join('');

            els.removedList.querySelectorAll('[data-restore-index]').forEach(btn => {
                btn.addEventListener('click', () => restoreItem(Number(btn.dataset.restoreIndex)));
            });
        }

        els.spinBtn.addEventListener('click', spin);
        rootEl.querySelector('[data-action="confirm"]').addEventListener('click', confirmRemoval);
        rootEl.querySelector('[data-action="close"]').addEventListener('click', closeModal);

        drawWheel();
        updateLists();
    }
};
