import { MEALS } from '../../shared/data.js';
import { getAudioCtx } from '../../shared/audio.js';

const ASSET_BASE = 'features/blackpink/assets';

const MEMBERS = [
    { id: 'jisoo',  label: 'Jisoo',  img: `${ASSET_BASE}/jisoo.jpg` },
    { id: 'jennie', label: 'Jennie', img: `${ASSET_BASE}/jennie.jpg` },
    { id: 'rose',   label: 'Rosé',   img: `${ASSET_BASE}/rose.jpg` },
    { id: 'lisa',   label: 'Lisa',   img: `${ASSET_BASE}/lisa.jpg` },
    { id: 'rora',   label: 'Rora',   img: `${ASSET_BASE}/rora.jpg` },
    { id: 'ruka',   label: 'Ruka',   img: `${ASSET_BASE}/ruka.jpg` },
    { id: 'shuhua', label: 'Shuhua', img: `${ASSET_BASE}/shuhua.jpg` },
    { id: 'yuqi',   label: 'Yuqi',   img: `${ASSET_BASE}/yuqi.jpg` },
];

const KUROMI_IMG = `${ASSET_BASE}/kuromi.png`;
const SLOT_COUNT = 8;

const TEMPLATE = `
    <div class="main-wrapper bp-wrap">
        <div class="bp-layout max-w-6xl w-full flex flex-col lg:flex-row gap-6 items-start justify-center">

            <div class="bp-panel panel-card p-5 md:p-10 flex flex-col items-center">
                <h1 class="bp-title text-2xl md:text-4xl font-black mb-1 tracking-widest text-center">🖤 BLACKPINK 翻牌早餐 🖤</h1>
                <p class="bp-subtitle mb-6 text-sm md:text-base font-medium text-center">點兩下翻出今天的早餐～</p>

                <div class="bp-card-grid" data-el="grid">
                    ${Array.from({ length: SLOT_COUNT }, (_, i) => `
                        <div class="bp-card" data-slot="${i}" data-state="idle">
                            <div class="bp-card-inner">
                                <div class="bp-card-face bp-card-back">
                                    <img src="${KUROMI_IMG}" alt="Kuromi" draggable="false" />
                                </div>
                                <div class="bp-card-face bp-card-front">
                                    <img data-el="member-img-${i}" src="" alt="" draggable="false" />
                                    <div class="bp-meal-label" data-el="meal-${i}">—</div>
                                </div>
                                <div class="bp-empty-overlay">全部吃光了</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <aside class="bp-sidebar panel-card p-6 w-full lg:w-2/5">
                <h2 class="bp-sidebar-title text-xl font-black mb-2 flex items-center gap-2">
                    <span>🍳</span> 剩餘 <span data-el="deckCount">0</span> 個
                </h2>
                <p class="bp-sidebar-hint text-sm mb-6">每張卡牌會在你「就吃這個」之後抽下一個。</p>

                <div class="bp-divider"></div>

                <h2 class="bp-sidebar-title text-lg font-black mb-3 flex items-center gap-2 mt-4">
                    <span>🥄</span> 已經吃過
                </h2>
                <ul data-el="removedList" class="space-y-2"></ul>
            </aside>
        </div>
    </div>

    <div data-el="modal" class="bp-modal hidden fixed inset-0 z-50 flex items-center justify-center p-6">
        <div class="bp-modal-backdrop"></div>
        <div class="bp-modal-card">
            <img data-el="modalImg" alt="" class="bp-modal-img" />
            <p data-el="modalMember" class="bp-modal-member"></p>
            <p data-el="modalMeal" class="bp-modal-meal"></p>
            <div class="bp-modal-actions">
                <button data-action="confirm" class="bp-modal-btn bp-modal-btn-primary">就吃這個！</button>
                <button data-action="redraw"  class="bp-modal-btn bp-modal-btn-secondary">再抽一次</button>
            </div>
        </div>
    </div>
`;

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
    } catch (e) {}
}

export default {
    id: 'blackpink',
    label: 'Blackpink',
    emoji: '🖤',
    mount(rootEl) {
        rootEl.innerHTML = TEMPLATE;

        const els = {
            grid: rootEl.querySelector('[data-el="grid"]'),
            deckCount: rootEl.querySelector('[data-el="deckCount"]'),
            removedList: rootEl.querySelector('[data-el="removedList"]'),
            modal: rootEl.querySelector('[data-el="modal"]'),
            modalImg: rootEl.querySelector('[data-el="modalImg"]'),
            modalMember: rootEl.querySelector('[data-el="modalMember"]'),
            modalMeal: rootEl.querySelector('[data-el="modalMeal"]'),
            cards: Array.from(rootEl.querySelectorAll('.bp-card')),
        };

        const state = {
            deck: [],
            removed: [],
            slots: Array.from({ length: SLOT_COUNT }, () => ({ member: MEMBERS[0].id, breakfast: null, flip: 'idle' })),
            liftedIdx: -1,
            flippedIdx: -1,
            busy: false,
        };

        function shuffledMemberIds() {
            const pool = MEMBERS.map(m => m.id);
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            return pool;
        }

        function shuffleInit() {
            state.deck = [...MEALS.emma];
            state.removed = [];
            const memberOrder = shuffledMemberIds();
            state.slots.forEach((s, i) => {
                s.member = memberOrder[i];
                drawInto(i, /*silent*/ true);
                s.flip = 'idle';
            });
            state.liftedIdx = -1;
            state.flippedIdx = -1;
            state.busy = false;
        }

        function drawInto(slotIdx) {
            if (state.deck.length === 0) {
                state.slots[slotIdx].breakfast = null;
                state.slots[slotIdx].flip = 'empty';
                return;
            }
            const i = Math.floor(Math.random() * state.deck.length);
            state.slots[slotIdx].breakfast = state.deck.splice(i, 1)[0];
            state.slots[slotIdx].flip = 'idle';
        }

        function renderCards() {
            state.slots.forEach((slot, i) => {
                const cardEl = els.cards[i];
                cardEl.dataset.state = slot.flip;
                const mealEl = cardEl.querySelector(`[data-el="meal-${i}"]`);
                mealEl.textContent = slot.breakfast ?? '—';
                const member = MEMBERS.find(m => m.id === slot.member);
                const imgEl = cardEl.querySelector(`[data-el="member-img-${i}"]`);
                if (member && imgEl && imgEl.getAttribute('src') !== member.img) {
                    imgEl.src = member.img;
                    imgEl.alt = member.label;
                }
            });
        }

        function renderSidebar() {
            els.deckCount.textContent = String(state.deck.length);
            els.removedList.innerHTML = state.removed.map((item, idx) => `
                <li class="bp-removed-item flex justify-between items-center">
                    <span class="bp-removed-text line-through">${item}</span>
                    <button data-restore-index="${idx}" class="bp-restore-btn">復原</button>
                </li>
            `).join('');
            els.removedList.querySelectorAll('[data-restore-index]').forEach(btn => {
                btn.addEventListener('click', () => restoreItem(Number(btn.dataset.restoreIndex)));
            });
        }

        function render() {
            renderCards();
            renderSidebar();
        }

        function onCardClick(slotIdx) {
            if (state.busy) return;
            if (state.flippedIdx !== -1) return;
            const slot = state.slots[slotIdx];
            if (slot.flip === 'empty') return;

            if (slot.flip === 'idle') {
                if (state.liftedIdx !== -1 && state.liftedIdx !== slotIdx) {
                    state.slots[state.liftedIdx].flip = 'idle';
                }
                slot.flip = 'lifted';
                state.liftedIdx = slotIdx;
                playSfx(640, 'sine', 0.08);
                renderCards();
                return;
            }

            if (slot.flip === 'lifted') {
                state.busy = true;
                slot.flip = 'flipped';
                state.flippedIdx = slotIdx;
                playSfx(880, 'triangle', 0.18);
                renderCards();
                setTimeout(() => openModal(slotIdx), 560);
            }
        }

        function openModal(slotIdx) {
            const slot = state.slots[slotIdx];
            const member = MEMBERS.find(m => m.id === slot.member);
            els.modalImg.src = member.img;
            els.modalImg.alt = member.label;
            els.modalMember.textContent = member.label;
            els.modalMeal.textContent = slot.breakfast ?? '';
            els.modal.classList.remove('hidden');
        }

        function closeModal() {
            els.modal.classList.add('hidden');
            state.busy = false;
        }

        function confirmPick() {
            if (state.flippedIdx === -1) return;
            const idx = state.flippedIdx;
            const slot = state.slots[idx];
            if (slot.breakfast != null) state.removed.push(slot.breakfast);
            drawInto(idx);
            state.flippedIdx = -1;
            state.liftedIdx = -1;
            closeModal();
            render();
        }

        function redrawPick() {
            if (state.flippedIdx === -1) return;
            const idx = state.flippedIdx;
            state.slots[idx].flip = 'idle';
            state.flippedIdx = -1;
            state.liftedIdx = -1;
            closeModal();
            renderCards();
        }

        function restoreItem(idx) {
            const item = state.removed.splice(idx, 1)[0];
            state.deck.push(item);
            const emptySlot = state.slots.findIndex(s => s.flip === 'empty');
            if (emptySlot !== -1) drawInto(emptySlot);
            render();
        }

        els.grid.addEventListener('click', (e) => {
            const cardEl = e.target.closest('.bp-card');
            if (!cardEl) return;
            const slotIdx = Number(cardEl.dataset.slot);
            getAudioCtx();
            onCardClick(slotIdx);
        });

        rootEl.querySelector('[data-action="confirm"]').addEventListener('click', confirmPick);
        rootEl.querySelector('[data-action="redraw"]').addEventListener('click', redrawPick);

        shuffleInit();
        render();
    },
};
