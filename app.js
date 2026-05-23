import { getAudioCtx } from './shared/audio.js';
import chris from './features/chris/index.js';
// import emma from './features/emma/index.js';
// import shower from './features/shower/index.js';

const features = [
    chris,
    // emma, shower
];

const toggleContainer = document.querySelector('.user-toggle');
const appRoot = document.getElementById('app');

// Static fallback list during incremental migration — Task 6 will replace this with `features`.
const TOGGLE_LIST = [
    { id: 'chris', label: 'Chris', emoji: '🧊' },
    { id: 'emma', label: 'Emma', emoji: '🐱' },
    { id: 'shower', label: '洗澡', emoji: '🛁' },
];

function renderToggle() {
    toggleContainer.innerHTML = TOGGLE_LIST.map(f =>
        `<button data-user-btn="${f.id}">${f.emoji} ${f.label}</button>`
    ).join('');
    toggleContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-user-btn]');
        if (!btn) return;
        getAudioCtx();
        setUser(btn.dataset.userBtn);
    });
}

function setUser(id) {
    document.body.dataset.user = id;
    toggleContainer.querySelectorAll('[data-user-btn]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.userBtn === id);
    });
}

function mountFeatures() {
    features.forEach(f => {
        const container = document.createElement('div');
        container.className = `feature-root ${f.id}-only`;
        appRoot.appendChild(container);
        f.mount(container);
    });
}

renderToggle();
mountFeatures();
setUser(features[0]?.id ?? document.body.dataset.user ?? 'chris');
