import { SHOWER_PEOPLE } from '../../shared/data.js';
import { getAudioCtx } from '../../shared/audio.js';

const CONFIG = {
    cols: 4,
    levels: 14,
    width: 360,
    height: 420,
    avatarY: 24,
    avatarR: 20,
    bottomPad: 24,
};

const TEMPLATE = `
    <div class="shower-container">
        <h1 class="shower-title">🛁 洗澡爬格子</h1>
        <p class="shower-subtitle">把頭像拖到下方 1 / 2 / 3 / 4 起跑點～</p>

        <div data-el="interactive">
            <div class="shower-pool" data-el="pool"></div>
            <div class="shower-slots" data-el="slots"></div>
        </div>
        <svg data-el="ladder" id="showerLadder" viewBox="0 0 360 420" xmlns="http://www.w3.org/2000/svg"></svg>

        <button data-el="startBtn" class="shower-start-btn" disabled>還缺 4 個就位</button>

        <div data-el="resultCard" class="shower-result-card hidden"></div>
    </div>
`;

export default {
    id: 'shower',
    label: '洗澡',
    emoji: '🛁',
    mount(rootEl) {
        rootEl.innerHTML = TEMPLATE;

        const els = {
            interactive: rootEl.querySelector('[data-el="interactive"]'),
            pool: rootEl.querySelector('[data-el="pool"]'),
            slots: rootEl.querySelector('[data-el="slots"]'),
            ladder: rootEl.querySelector('[data-el="ladder"]'),
            startBtn: rootEl.querySelector('[data-el="startBtn"]'),
            resultCard: rootEl.querySelector('[data-el="resultCard"]'),
        };

        let geom = null;
        const state = {
            rungs: [],
            isRunning: false,
            hasPlayed: false,
            avatarEls: [],
            pool: [0, 1, 2, 3],
            slots: [null, null, null, null],
            drag: null,
        };

        function computeGeom() {
            const colSpacing = CONFIG.width / CONFIG.cols;
            const colXs = [];
            for (let i = 0; i < CONFIG.cols; i++) {
                colXs.push(colSpacing / 2 + i * colSpacing);
            }
            const lineTopY = CONFIG.avatarY;
            const lineBottomY = CONFIG.height - CONFIG.bottomPad;
            const rungSpacing = (lineBottomY - lineTopY) / (CONFIG.levels + 1);
            const rungYs = [];
            for (let i = 0; i < CONFIG.levels; i++) {
                rungYs.push(lineTopY + (i + 1) * rungSpacing);
            }
            geom = { colXs, rungYs, lineTopY, lineBottomY };
        }

        function generateRungs() {
            const rungs = [];
            const numGaps = CONFIG.cols - 1;
            for (let l = 0; l < CONFIG.levels; l++) {
                const row = new Array(numGaps).fill(false);
                for (let g = 0; g < numGaps; g++) {
                    if (g > 0 && row[g - 1]) continue;
                    if (Math.random() < 0.5) row[g] = true;
                }
                rungs.push(row);
            }
            state.rungs = rungs;
        }

        function drawLadder(withAvatars = false) {
            const { colXs, rungYs, lineTopY, lineBottomY } = geom;
            const parts = [];
            colXs.forEach(x => {
                parts.push(`<line x1="${x}" y1="${lineTopY}" x2="${x}" y2="${lineBottomY}" stroke="#7dd3fc" stroke-width="4" stroke-linecap="round"/>`);
            });
            state.rungs.forEach((row, l) => {
                row.forEach((on, g) => {
                    if (on) {
                        const y = rungYs[l];
                        parts.push(`<line x1="${colXs[g]}" y1="${y}" x2="${colXs[g+1]}" y2="${y}" stroke="#7dd3fc" stroke-width="4" stroke-linecap="round"/>`);
                    }
                });
            });
            if (withAvatars) {
                parts.push('<defs><clipPath id="showerCircleClip" clipPathUnits="objectBoundingBox"><circle cx="0.5" cy="0.5" r="0.5"/></clipPath></defs>');
                for (let i = 0; i < CONFIG.cols; i++) {
                    const personIdx = state.slots[i];
                    if (personIdx === null) continue;
                    const p = SHOWER_PEOPLE[personIdx];
                    const x = colXs[i];
                    const y = CONFIG.avatarY;
                    const r = CONFIG.avatarR;
                    parts.push(`<g class="shower-avatar" data-idx="${i}">
                        <image href="${p.image}" x="${x-r}" y="${y-r}" width="${2*r}" height="${2*r}" preserveAspectRatio="xMidYMid slice" clip-path="url(#showerCircleClip)"/>
                        <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="white" stroke-width="3"/>
                    </g>`);
                }
            }
            els.ladder.innerHTML = parts.join('');
            state.avatarEls = els.ladder.querySelectorAll('.shower-avatar');
        }

        function renderPool() {
            if (state.pool.length === 0) {
                els.pool.innerHTML = '<div class="shower-pool-empty">全員就位 ✨</div>';
                return;
            }
            els.pool.innerHTML = state.pool.map(idx => {
                const p = SHOWER_PEOPLE[idx];
                return `
                    <div class="shower-piece" data-person-idx="${idx}">
                        <div class="shower-piece-avatar" style="background-color:${p.color}"><img src="${p.image}" alt="${p.name}" draggable="false"></div>
                        <div class="shower-piece-name">${p.name}</div>
                    </div>
                `;
            }).join('');
        }

        function renderSlots() {
            els.slots.innerHTML = state.slots.map((personIdx, slotIdx) => {
                const num = slotIdx + 1;
                if (personIdx === null) {
                    return `
                        <div class="shower-slot" data-slot="${slotIdx}">
                            <div class="shower-slot-num">${num}</div>
                            <div class="shower-slot-hint">拖人來</div>
                        </div>
                    `;
                }
                const p = SHOWER_PEOPLE[personIdx];
                return `
                    <div class="shower-slot filled" data-slot="${slotIdx}">
                        <div class="shower-slot-num">${num}</div>
                        <div class="shower-piece" data-person-idx="${personIdx}" data-from-slot="${slotIdx}">
                            <div class="shower-piece-avatar" style="background-color:${p.color}"><img src="${p.image}" alt="${p.name}" draggable="false"></div>
                            <div class="shower-piece-name">${p.name}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function allPlaced() {
            return state.slots.every(s => s !== null);
        }

        function updateStartBtn() {
            if (state.isRunning) return;
            if (state.hasPlayed) {
                els.startBtn.disabled = false;
                els.startBtn.innerText = '重置 🔄';
            } else if (allPlaced()) {
                els.startBtn.disabled = false;
                els.startBtn.innerText = '開始爬格子！🚿';
            } else {
                const need = state.slots.filter(s => s === null).length;
                els.startBtn.disabled = true;
                els.startBtn.innerText = `還缺 ${need} 個就位`;
            }
        }

        function clearResults() {
            els.resultCard.classList.add('hidden');
        }

        function buttonAction() {
            if (state.isRunning) return;
            if (state.hasPlayed) {
                reset();
            } else {
                start();
            }
        }

        function reset() {
            state.pool = [0, 1, 2, 3];
            state.slots = [null, null, null, null];
            state.hasPlayed = false;
            clearResults();
            generateRungs();
            drawLadder();
            renderPool();
            renderSlots();
            updateStartBtn();
        }

        function handleDrop(personIdx, fromSlot, target) {
            if (!target) return;
            if (target.type === 'slot') {
                const tIdx = target.idx;
                const existing = state.slots[tIdx];
                if (existing === personIdx) return;
                if (fromSlot === -1) {
                    const i = state.pool.indexOf(personIdx);
                    if (i >= 0) state.pool.splice(i, 1);
                } else {
                    state.slots[fromSlot] = null;
                }
                if (existing !== null) {
                    if (fromSlot !== -1) {
                        state.slots[fromSlot] = existing;
                    } else {
                        state.pool.push(existing);
                    }
                }
                state.slots[tIdx] = personIdx;
            } else if (target.type === 'pool') {
                if (fromSlot === -1) return;
                state.slots[fromSlot] = null;
                state.pool.push(personIdx);
            }
        }

        function onPointerDown(e) {
            if (state.isRunning) return;
            const piece = e.target.closest('.shower-piece');
            if (!piece) return;
            e.preventDefault();

            const personIdx = parseInt(piece.dataset.personIdx);
            const fromSlot = piece.dataset.fromSlot !== undefined ? parseInt(piece.dataset.fromSlot) : -1;
            const rect = piece.getBoundingClientRect();
            const isTouch = e.pointerType === 'touch';
            const ghostTransform = isTouch ? 'translate(-50%, -120%) scale(1.15)' : 'translate(-50%, -50%) scale(1.1)';

            const ghost = piece.cloneNode(true);
            ghost.classList.add('shower-drag-ghost');
            ghost.style.left = (rect.left + rect.width / 2) + 'px';
            ghost.style.top = (rect.top + rect.height / 2) + 'px';
            ghost.style.transform = ghostTransform;
            ghost.style.opacity = '0.92';
            ghost.style.filter = 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))';
            document.body.appendChild(ghost);

            piece.classList.add('dragging');

            try { piece.setPointerCapture(e.pointerId); } catch (err) {}

            state.drag = { personIdx, fromSlot, ghost, pieceEl: piece, pointerId: e.pointerId, ghostTransform };

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
        }

        function onPointerMove(e) {
            if (!state.drag) return;
            if (e.pointerId !== undefined && e.pointerId !== state.drag.pointerId) return;
            e.preventDefault();

            const ghost = state.drag.ghost;
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';

            document.querySelectorAll('.shower-slot.drag-over, .shower-pool.drag-over').forEach(el => el.classList.remove('drag-over'));
            const elAt = document.elementFromPoint(e.clientX, e.clientY);
            if (elAt) {
                const slot = elAt.closest('.shower-slot');
                const pool = elAt.closest('.shower-pool');
                if (slot) slot.classList.add('drag-over');
                else if (pool && state.drag.fromSlot !== -1) pool.classList.add('drag-over');
            }
        }

        function onPointerUp(e) {
            if (!state.drag) return;
            if (e.pointerId !== undefined && e.pointerId !== state.drag.pointerId) return;

            const { personIdx, fromSlot, ghost, pieceEl } = state.drag;
            ghost.remove();
            pieceEl.classList.remove('dragging');
            document.querySelectorAll('.shower-slot.drag-over, .shower-pool.drag-over').forEach(el => el.classList.remove('drag-over'));

            const elAt = document.elementFromPoint(e.clientX, e.clientY);
            let target = null;
            if (elAt) {
                const slot = elAt.closest('.shower-slot');
                const pool = elAt.closest('.shower-pool');
                if (slot) target = { type: 'slot', idx: parseInt(slot.dataset.slot) };
                else if (pool) target = { type: 'pool' };
            }

            handleDrop(personIdx, fromSlot, target);

            state.drag = null;
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerUp);

            if (state.hasPlayed) {
                state.hasPlayed = false;
                drawLadder();
            }
            renderPool();
            renderSlots();
            clearResults();
            updateStartBtn();
        }

        function tracePath(startCol) {
            const { colXs, rungYs, lineBottomY } = geom;
            const pts = [{ x: colXs[startCol], y: CONFIG.avatarY }];
            let col = startCol;
            for (let l = 0; l < CONFIG.levels; l++) {
                const y = rungYs[l];
                if (col > 0 && state.rungs[l][col - 1]) {
                    pts.push({ x: colXs[col], y });
                    col -= 1;
                    pts.push({ x: colXs[col], y });
                } else if (col < CONFIG.cols - 1 && state.rungs[l][col]) {
                    pts.push({ x: colXs[col], y });
                    col += 1;
                    pts.push({ x: colXs[col], y });
                }
            }
            pts.push({ x: colXs[col], y: lineBottomY });
            return { points: pts, finalCol: col };
        }

        function animateAvatar(el, points, totalDur) {
            const image = el.querySelector('image');
            const circle = el.querySelector('circle');
            const r = CONFIG.avatarR;
            const setPos = (x, y) => {
                image.setAttribute('x', x - r);
                image.setAttribute('y', y - r);
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
            };

            let totalLen = 0;
            const segLens = [];
            for (let i = 1; i < points.length; i++) {
                const dx = points[i].x - points[i-1].x;
                const dy = points[i].y - points[i-1].y;
                const len = Math.sqrt(dx*dx + dy*dy) || 0.001;
                segLens.push(len);
                totalLen += len;
            }
            const cum = [0];
            segLens.forEach(l => cum.push(cum[cum.length-1] + (l/totalLen) * totalDur));

            return new Promise(resolve => {
                const startTime = performance.now();
                function frame(now) {
                    const elapsed = now - startTime;
                    if (elapsed >= totalDur) {
                        const last = points[points.length-1];
                        setPos(last.x, last.y);
                        return resolve();
                    }
                    let segIdx = 0;
                    for (let i = 1; i < cum.length; i++) {
                        if (elapsed < cum[i]) { segIdx = i - 1; break; }
                    }
                    const t = (elapsed - cum[segIdx]) / (cum[segIdx+1] - cum[segIdx]);
                    const from = points[segIdx];
                    const to = points[segIdx + 1];
                    setPos(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
                    requestAnimationFrame(frame);
                }
                requestAnimationFrame(frame);
            });
        }

        function playTick() {
            const ctx = getAudioCtx();
            const t = ctx.currentTime;
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(900 + Math.random() * 400, t);
            g.gain.setValueAtTime(0.04, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
            osc.connect(g); g.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.12);
        }

        function playSplash() {
            const ctx = getAudioCtx();
            const t0 = ctx.currentTime;
            [523, 659, 784, 1047].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                const startTime = t0 + i * 0.09;
                osc.frequency.setValueAtTime(freq, startTime);
                g.gain.setValueAtTime(0.12, startTime);
                g.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
                osc.connect(g); g.connect(ctx.destination);
                osc.start(startTime); osc.stop(startTime + 0.45);
            });
        }

        async function start() {
            if (state.isRunning || !allPlaced()) return;
            state.isRunning = true;
            getAudioCtx();

            clearResults();

            els.startBtn.disabled = true;
            els.startBtn.innerText = '爬格子中...🫧';

            drawLadder(true);
            els.slots.querySelectorAll('.shower-piece').forEach(p => {
                p.style.visibility = 'hidden';
            });

            await new Promise(r => setTimeout(r, 60));

            const results = [];
            const totalDur = 3200;
            const animPromises = [];
            for (let i = 0; i < CONFIG.cols; i++) {
                const personIdx = state.slots[i];
                const person = SHOWER_PEOPLE[personIdx];
                const trace = tracePath(i);
                results.push({ person, finalCol: trace.finalCol });
                animPromises.push(animateAvatar(state.avatarEls[i], trace.points, totalDur));
            }

            const tickTimer = setInterval(playTick, 180);
            await Promise.all(animPromises);
            clearInterval(tickTimer);

            showResults(results);
            playSplash();

            els.slots.querySelectorAll('.shower-piece').forEach(p => {
                p.style.visibility = 'visible';
            });

            state.isRunning = false;
            state.hasPlayed = true;
            updateStartBtn();
        }

        function showResults(results) {
            const ranked = [...results].sort((a, b) => a.finalCol - b.finalCol);
            els.resultCard.innerHTML = `<div class="shower-result-title">🎉 洗澡順序公布！</div>` +
                ranked.map((r, idx) => `
                    <div class="shower-result-row rank-${idx+1}">
                        <div class="shower-rank-num">${idx+1}</div>
                        <div class="shower-result-avatar" style="background-color:${r.person.color}"><img src="${r.person.image}" alt="${r.person.name}"></div>
                        <div class="shower-result-name">${r.person.name}</div>
                    </div>
                `).join('');
            els.resultCard.classList.remove('hidden');
        }

        els.interactive.addEventListener('pointerdown', onPointerDown);
        els.startBtn.addEventListener('click', buttonAction);

        computeGeom();
        generateRungs();
        drawLadder();
        renderPool();
        renderSlots();
        updateStartBtn();
    }
};
