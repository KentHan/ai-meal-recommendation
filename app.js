import { getAudioCtx } from './shared/audio.js';
import chris from './features/chris/index.js';
import emma from './features/emma/index.js';
import shower from './features/shower/index.js';
import blackpink from './features/blackpink/index.js';

const features = [
    chris,
    emma,
    shower,
    blackpink,
];

const toggleContainer = document.querySelector('.user-toggle');
const appRoot = document.getElementById('app');

function renderToggle() {
    toggleContainer.innerHTML = features.map(f =>
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
setUser(document.body.dataset.user ?? features[0].id);
