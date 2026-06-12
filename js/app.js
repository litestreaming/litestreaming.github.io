(() => {
'use strict';

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}


const PROFILE_PICS = [
    { id: 'avatar-1',  label: 'Avatar 1',  url: 'https://litestreaming.github.io/images/LloydDraconusAvatar.jpg' },
    { id: 'avatar-2',  label: 'Avatar 2',  url: 'https://litestreaming.github.io/images/KaiDraconusAvatar.jpg' },
    { id: 'avatar-3',  label: 'Avatar 3',  url: 'https://litestreaming.github.io/images/JayDraconusAvatar.jpg' },
    { id: 'avatar-4',  label: 'Avatar 4',  url: 'https://litestreaming.github.io/images/ColeDraconusAvatar.jpg' },
    { id: 'avatar-5',  label: 'Avatar 5',  url: 'https://litestreaming.github.io/images/ZaneDraconusAvatar.jpg' },
    { id: 'avatar-6',  label: 'Avatar 6',  url: 'https://litestreaming.github.io/images/NyaDraconusAvatar.jpg' },
    { id: 'avatar-7',  label: 'Avatar 7',  url: 'https://litestreaming.github.io/images/ArinPfp.jpg' },
    { id: 'avatar-8',  label: 'Avatar 8',  url: 'https://litestreaming.github.io/images/WyldfyrePfp.jpg' },
    { id: 'avatar-9',  label: 'Avatar 9',  url: 'https://litestreaming.github.io/images/RiyuPfp.jpg' },
    { id: 'avatar-10', label: 'Avatar 10', url: 'https://litestreaming.github.io/images/RasPfp.jpg' },
    { id: 'avatar-11', label: 'Avatar 11', url: 'https://static.wikia.nocookie.net/ninjago/images/3/35/DRS3Part2FrakIB.png' },
    { id: 'avatar-12', label: 'Avatar 12', url: 'https://litestreaming.github.io/images/DreamzzzPfp.jpg' },
];

const DEFAULT_ACCENT = '#0072D2';
const THEME_PRESETS = [
    { name: 'Disney Blue', color: '#0072D2' }, { name: 'Sky', color: '#4F8EFB' }, { name: 'Cyan', color: '#22D3EE' },
    { name: 'Purple', color: '#8B5CF6' }, { name: 'Pink', color: '#EC4899' }, { name: 'Red', color: '#EF4444' },
    { name: 'Orange', color: '#F97316' }, { name: 'Green', color: '#22C55E' }, { name: 'Amber', color: '#F59E0B' },
];
const TRANSLATE_LANGS = [
    { code: 'es', label: 'Spanish (AI)' }, { code: 'fr', label: 'French (AI)' }, { code: 'fi', label: 'Finnish (AI)' },
    { code: 'de', label: 'German (AI)' }, { code: 'pt', label: 'Portuguese (AI)' }, { code: 'ja', label: 'Japanese (AI)' },
    { code: 'ko', label: 'Korean (AI)' }, { code: 'zh', label: 'Chinese (AI)' }, { code: 'ar', label: 'Arabic (AI)' },
    { code: 'hi', label: 'Hindi (AI)' }, { code: 'da', label: 'Danish (AI)' },
];
const SUB_SIZES = [
    { id: 'sm', label: 'S', scale: 0.78 }, { id: 'md', label: 'M', scale: 1 },
    { id: 'lg', label: 'L', scale: 1.35 }, { id: 'xl', label: 'XL', scale: 1.7 },
];
const SUB_BGS = [
    { id: 'solid', label: 'Solid' }, { id: 'soft', label: 'Soft' }, { id: 'none', label: 'None' },
];
const TV_RE = /(smart-?tv|tizen|web0s|webos|netcast|nettv|viera|aquos|bravia|roku|dtv|playstation|xbox|crkey|googletv|google tv|hbbtv|vidaa|hisense|sony.?tv)/i;
const PLAY_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

const $ = (id) => document.getElementById(id);
const $$ = (sel, scope) => Array.from((scope || document).querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; } };
const writeJSON = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };
const fmtClock = (t) => {
    if (!t || !isFinite(t) || t < 0) return '0:00';
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

const cacheBust = '?v=' + Date.now();
const state = {
    shows: [], heroData: [], heroIdx: 0, heroTimer: null,
    route: { name: 'home' },
    detail: { show: null, seasonIdx: -1, data: null, tab: 'episodes', reqId: 0 },
    play: {
        show: null, seasonNumber: null, seasonData: null, epIdx: -1,
        sources: [], srcIdx: -1, kind: null,
        cueTrack: null, subIdx: -1, lastSubIdx: -1, defaultSubPicked: false,
        pushed: false,
    },
    hls: null,
    playbackSpeed: parseFloat(localStorage.getItem('lsSpeed') || '1'),
    isDownloading: false,
    controlsTimer: null, currentSkipTarget: null,
    seasonCache: new Map(),
    durIO: null, lastTouch: 0, lastProgSave: 0,
};
let tvActive = false;

const getShow = (id) => state.shows.find(s => s.id === id);
const playableSeasons = (show) => (show && show.seasons ? show.seasons.filter(s => s.file) : []);
const isMovie = (show) => show && show.type === 'movie';

function epStatus(ep) {
    const s = String(ep.status || '').toLowerCase().trim();
    if (s === 'upcoming' || s === 'soon' || s === 'coming-soon' || s === 'comingsoon') return { id: 'upcoming', label: ep.statusText || 'Upcoming' };
    if (s === 'unavailable') return { id: 'unavailable', label: ep.statusText || 'Unavailable' };
    return null;
}

function toast(msg) {
    const stack = $('toastStack');
    if (!stack) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><span>' + esc(msg) + '</span>';
    stack.appendChild(t);
    setTimeout(() => t.remove(), 2950);
}

const PROG_KEY = 'lsProgressV2';
let progressMap = readJSON(PROG_KEY, {});
const progKey = (showId, s, e) => `${showId}|${s}|${e}`;
const getProgress = (showId, s, e) => progressMap[progKey(showId, s, e)] || null;
const isWatched = (p) => !!(p && p.d && p.t / p.d >= 0.95);
const isInProgress = (p) => !!(p && p.t > 5 && !isWatched(p));
const progPct = (p) => (p && p.d ? Math.min((p.t / p.d) * 100, 100) : 0);

function setProgress(showId, s, e, t, d, meta) {
    const key = progKey(showId, s, e);
    const prev = progressMap[key] || {};
    progressMap[key] = {
        t: Math.max(0, t), d: d || prev.d || null, u: Date.now(),
        title: (meta && meta.title) || prev.title || '', thumb: (meta && meta.thumb) || prev.thumb || '',
    };
    writeJSON(PROG_KEY, progressMap);
}
function parseProgEntries() {
    return Object.entries(progressMap).map(([key, p]) => {
        const [showId, s, e] = key.split('|');
        return { showId, s: parseInt(s), e: parseInt(e), p };
    }).filter(en => en.showId && !isNaN(en.s) && !isNaN(en.e));
}
function continueEntries() {
    const seen = new Set();
    return parseProgEntries()
        .filter(en => isInProgress(en.p) && getShow(en.showId))
        .sort((a, b) => (b.p.u || 0) - (a.p.u || 0))
        .filter(en => { if (seen.has(en.showId)) return false; seen.add(en.showId); return true; })
        .slice(0, 12);
}
function latestEntryForShow(showId) {
    return parseProgEntries().filter(en => en.showId === showId && isInProgress(en.p))
        .sort((a, b) => (b.p.u || 0) - (a.p.u || 0))[0] || null;
}
function migrateOldProgress() {
    const old = readJSON('continueWatching', null);
    if (!Array.isArray(old) || !old.length) { localStorage.removeItem('continueWatching'); return; }
    old.forEach(it => {
        const show = getShow(it.showId);
        if (!show) return;
        const playable = playableSeasons(show);
        const sNum = (playable[it.season] && playable[it.season].number != null) ? playable[it.season].number : ((it.season ?? 0) + 1);
        const eNum = (it.episode ?? 0) + 1;
        const key = progKey(it.showId, sNum, eNum);
        if (!progressMap[key]) progressMap[key] = { t: it.time || 0, d: it.duration || null, u: it.lastUpdated || Date.now(), title: '', thumb: '' };
    });
    writeJSON(PROG_KEY, progressMap);
    localStorage.removeItem('continueWatching');
}

let profile = readJSON('lsProfile', { name: '', avatar: '' });
const saveProfile = () => writeJSON('lsProfile', profile);
const avatarPic = () => PROFILE_PICS.find(p => p.id === profile.avatar) || null;

function avatarInner(idx) {
    const pic = avatarPic();
    if (pic && pic.url) return `<img src="${esc(pic.url)}" alt="" draggable="false">`;
    const initial = (profile.name || '?').trim().charAt(0).toUpperCase() || '?';
    return `<span>${esc(initial)}</span>`;
}
function avatarHue(i) { return (i * 137.5) % 360; }
function refreshAvatarUI() {
    const html = avatarInner();
    const side = $('sideAvatar'), bn = $('bnAvatar');
    if (side) side.innerHTML = html;
    if (bn) bn.innerHTML = html;
    const nameEl = $('sideProfileName');
    if (nameEl) nameEl.textContent = profile.name || 'Profile';
}


function applyAccent(hex) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const root = document.documentElement.style;
    root.setProperty('--accent', hex);
    root.setProperty('--accent-light', lighten(hex, 26));
    root.setProperty('--accent-dim', `rgba(${r},${g},${b},0.18)`);
    root.setProperty('--accent-glow', `rgba(${r},${g},${b},0.45)`);
    root.setProperty('--accent-soft', `rgba(${r},${g},${b},0.09)`);
    localStorage.setItem('lsTheme', hex);
    updateThemeSwatches();
}
function lighten(hex, pct) {
    let r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + Math.round((255 - r) * pct / 100));
    g = Math.min(255, g + Math.round((255 - g) * pct / 100));
    b = Math.min(255, b + Math.round((255 - b) * pct / 100));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
function buildThemeSwatches() {
    const c = $('themePresets');
    if (!c) return;
    c.innerHTML = THEME_PRESETS.map(t => `<button class="swatch" type="button" style="background:${t.color}" title="${t.name}" data-color="${t.color}" aria-label="${t.name} accent"></button>`).join('');
    $$('.swatch', c).forEach(s => s.addEventListener('click', () => applyAccent(s.dataset.color)));
    updateThemeSwatches();
}
function updateThemeSwatches() {
    const cur = localStorage.getItem('lsTheme') || DEFAULT_ACCENT;
    $$('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color.toLowerCase() === cur.toLowerCase()));
    const picker = $('customAccentPicker');
    if (picker) picker.value = cur;
}
function setAppearance(mode) {
    const light = mode === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    localStorage.setItem('lsAppearance', light ? 'light' : 'dark');
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = light ? '#F2F4F9' : '#05070D';
    $$('#appearanceSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.appearance === (light ? 'light' : 'dark')));
}
function computeTv() {
    const pref = localStorage.getItem('lsTvMode') || 'auto';
    if (pref === 'on') return true;
    if (pref === 'off') return false;
    return TV_RE.test(navigator.userAgent) || new URLSearchParams(location.search).has('tv');
}
function applyTvMode() {
    tvActive = computeTv();
    document.body.classList.toggle('tv-mode', tvActive);
    const pref = localStorage.getItem('lsTvMode') || 'auto';
    $$('#tvSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.tv === pref));
}
function initThemeUI() {
    const savedAccent = localStorage.getItem('lsTheme');
    if (savedAccent) applyAccent(savedAccent);
    setAppearance(localStorage.getItem('lsAppearance') === 'light' ? 'light' : 'dark');
    buildThemeSwatches();
    applyTvMode();
}


const getMyList = () => readJSON('myList', []);
const isInMyList = (id) => getMyList().includes(id);
function toggleMyList(id, ev) {
    if (ev) { ev.stopPropagation(); ev.preventDefault(); }
    let list = getMyList();
    const wasIn = list.includes(id);
    if (wasIn) list = list.filter(x => x !== id);
    else list.push(id);
    writeJSON('myList', list);
    updateListButtons(id);
    if ($('myListSection')) renderMyListRow();
    toast(wasIn ? 'Removed from My List' : 'Added to My List');
}
function updateListButtons(id) {
    const inList = isInMyList(id);
    $$(`[data-toggle-list="${CSS.escape(id)}"]`).forEach(btn => {
        btn.classList.toggle('in-list', inList);
        btn.textContent = inList ? '✓' : '+';
        btn.title = inList ? 'Remove from My List' : 'Add to My List';
    });
    const detailBtn = $('detailListBtn');
    if (detailBtn && detailBtn.dataset.show === id) {
        detailBtn.classList.toggle('in-list', inList);
        detailBtn.innerHTML = inList
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
        detailBtn.title = inList ? 'Remove from My List' : 'Add to My List';
    }
}


function fetchSeason(file) {
    if (state.seasonCache.has(file)) return state.seasonCache.get(file);
    const p = fetch(file + cacheBust).then(r => { if (!r.ok) throw new Error('season fetch failed'); return r.json(); });
    state.seasonCache.set(file, p);
    p.catch(() => state.seasonCache.delete(file));
    return p;
}
let durCache = readJSON('lsDurCache', {});
let durSaveTimer = null;
const durQueue = [];
let durRunning = 0;
function queueDuration(url, el) {
    if (!url) return;
    if (durCache[url]) { el.textContent = durCache[url]; return; }
    durQueue.push({ url, el });
    pumpDurQueue();
}
function pumpDurQueue() {
    while (durRunning < 3 && durQueue.length) {
        const job = durQueue.shift();
        if (!job.el.isConnected) continue;
        durRunning++;
        fetchDuration(job.url, (label) => {
            durRunning--;
            if (label) {
                durCache[job.url] = label;
                clearTimeout(durSaveTimer);
                durSaveTimer = setTimeout(() => writeJSON('lsDurCache', durCache), 1500);
                if (job.el.isConnected) job.el.textContent = label;
            }
            pumpDurQueue();
        });
    }
}
function fetchDuration(url, cb) {
    if (!url || sourceKindOf(url) !== 'direct') return cb('');
    const fmt = (d) => (!d || !isFinite(d)) ? '' : Math.max(1, Math.round(d / 60)) + 'm';
    const tmp = document.createElement('video');
    tmp.preload = 'metadata';
    tmp.muted = true;
    let done = false;
    const finish = (val) => { if (done) return; done = true; cb(val); try { tmp.removeAttribute('src'); tmp.load(); tmp.remove(); } catch {} };
    setTimeout(() => finish(''), 8000);
    if (url.includes('.m3u8') && window.Hls && Hls.isSupported()) {
        const h = new Hls();
        h.loadSource(url); h.attachMedia(tmp);
        h.on(Hls.Events.LEVEL_LOADED, (_, d) => { finish(fmt(d.details && d.details.totalduration)); h.destroy(); });
        h.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { finish(''); h.destroy(); } });
    } else {
        tmp.src = url;
        tmp.onloadedmetadata = () => finish(fmt(tmp.duration));
        tmp.onerror = () => finish('');
    }
}
function fmtEpDuration(val) {
    if (val == null || val === '') return '';
    if (typeof val === 'number') return Math.max(1, Math.round(val / 60)) + 'm';
    return String(val);
}


function sourceKindOf(url, declared) {
    if (declared === 'tab' || declared === 'iframe' || declared === 'direct') return declared;
    if (!url || !url.trim()) return 'none';
    const u = url.toLowerCase().split('?')[0];
    if (u.includes('.m3u8') || u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov') || u.endsWith('.m4v') || u.endsWith('.mkv')) return 'direct';
    return 'iframe';
}
function srcTypeTag(src) {
    if (src.type === 'tab') return 'NEW TAB';
    if (src.type === 'iframe') return 'EMBED';
    return src.url.toLowerCase().includes('.m3u8') ? 'HLS' : 'MP4';
}
function episodeSources(ep) {
    if (epStatus(ep)) return [];
    const list = [];
    if (ep.embed && ep.embed.trim()) list.push({ label: 'Default', url: ep.embed.trim(), type: sourceKindOf(ep.embed), def: true });
    (ep.sources || []).forEach((s, i) => {
        if (!s || !s.url || !s.url.trim()) return;
        list.push({ label: s.label || ('Source ' + (i + 1)), url: s.url.trim(), type: sourceKindOf(s.url, s.type) });
    });
    return list;
}
function toEmbedUrl(url) {
    let u = url;
    if (u.includes('watch?v=')) {
        const id = u.split('v=')[1].split('&')[0];
        u = `https://www.youtube.com/embed/${id}`;
    } else if (u.includes('youtu.be/')) {
        const id = u.split('youtu.be/')[1].split(/[?&]/)[0];
        u = `https://www.youtube.com/embed/${id}`;
    }
    if (u.includes('youtube.com/embed')) {
        u += (u.includes('?') ? '&' : '?') + 'autoplay=1&modestbranding=1&rel=0';
    }
    return u;
}

function parseHash() {
    let h = location.hash || '#/';
    if (h.startsWith('#show=')) {
        const p = new URLSearchParams(h.slice(1));
        const id = p.get('show') || '';
        const s = p.get('s'), e = p.get('e');
        let nh = '#/details/' + encodeURIComponent(id);
        if (s && e) nh += '/' + encodeURIComponent(s) + '/' + encodeURIComponent(e);
        history.replaceState(null, '', nh);
        h = nh;
    }
    if (!h.startsWith('#/')) return { name: 'home' };
    const parts = h.slice(2).split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return { name: 'home' };
    switch (parts[0]) {
        case 'shows': return { name: 'shows' };
        case 'movies': return { name: 'movies' };
        case 'coming-soon': return { name: 'coming-soon' };
        case 'search': return { name: 'search' };
        case 'details':
            if (parts.length >= 4) {
                const s = parseInt(parts[2]), e = parseInt(parts[3]);
                if (!isNaN(s) && !isNaN(e)) return { name: 'episode', id: parts[1], s, e };
            }
            if (parts.length >= 2) return { name: 'details', id: parts[1] };
            return { name: 'home' };
        default: return { name: 'home' };
    }
}
function updateNavActive(r) {
    const map = { home: 'home', shows: 'shows', movies: 'movies', 'coming-soon': 'coming-soon', search: 'search' };
    const active = map[r.name] || '';
    $$('[data-route]').forEach(el => el.classList.toggle('active', el.dataset.route === active));
}
function route() {
    if ($('player').classList.contains('open')) closePlayerNow(true);
    const r = parseHash();
    state.route = r;
    clearInterval(state.heroTimer);
    if (state.durIO) { state.durIO.disconnect(); state.durIO = null; }
    updateNavActive(r);
    window.scrollTo(0, 0);
    switch (r.name) {
        case 'home': renderHome(); document.title = 'Litestreaming'; break;
        case 'shows': renderBrowse('shows'); document.title = 'Shows — Litestreaming'; break;
        case 'movies': renderBrowse('movies'); document.title = 'Movies — Litestreaming'; break;
        case 'coming-soon': renderBrowse('coming-soon'); document.title = 'Coming Soon — Litestreaming'; break;
        case 'search': renderSearch(); document.title = 'Search — Litestreaming'; break;
        case 'details': renderDetails(r.id); break;
        case 'episode': renderEpisodePage(r.id, r.s, r.e); break;
        default: renderHome();
    }
    tvInitialFocus();
}
window.addEventListener('hashchange', route);
window.addEventListener('popstate', () => {
    if ($('player').classList.contains('open')) { state.play.pushed = false; closePlayerNow(); }
});

function tvInitialFocus() {
    if (!tvActive) return;
    requestAnimationFrame(() => {
        const target = document.querySelector('#view .hero-actions .btn-primary') ||
            document.querySelector('#view .btn-primary') ||
            document.querySelector('#view a[href], #view button, #view input');
        if (target) target.focus({ preventScroll: true });
    });
}

function posterCardHtml(show) {
    const soon = !!show.comingSoon;
    const inList = isInMyList(show.id);
    return `<a class="poster-card" href="#/details/${encodeURIComponent(show.id)}" draggable="false" aria-label="${esc(show.title)}">
        <img class="poster-img" src="${esc(show.poster)}" alt="" loading="lazy" decoding="async" draggable="false">
        ${show.newEpisodes && !soon ? '<div class="badge-new">NEW</div>' : ''}
        ${!soon ? `<button class="card-list-btn${inList ? ' in-list' : ''}" type="button" data-toggle-list="${esc(show.id)}" title="${inList ? 'Remove from My List' : 'Add to My List'}" aria-label="Toggle My List">${inList ? '✓' : '+'}</button>` : ''}
        ${soon ? `<div class="badge-soon">${esc(show.comingSoonText || 'Coming Soon')}</div>` : ''}
        <div class="poster-overlay"><div class="title">${esc(show.title)}</div><div class="sub">${soon ? 'Coming Soon' : (isMovie(show) ? 'Movie' : 'Series')}</div></div>
    </a>`;
}
function bindPosterCards(scope) {
    $$('[data-toggle-list]', scope).forEach(btn => {
        btn.addEventListener('click', (e) => toggleMyList(btn.dataset.toggleList, e));
    });
}
function rowWrapHtml(id) {
    return `<div class="h-scroll-wrap">
        <button class="row-arrow left" type="button" data-arrow="-1" aria-label="Scroll left" tabindex="-1">‹</button>
        <div class="h-scroll" id="${id}"></div>
        <button class="row-arrow right" type="button" data-arrow="1" aria-label="Scroll right" tabindex="-1">›</button>
    </div>`;
}
function bindRowArrows(scope) {
    $$('.h-scroll-wrap', scope).forEach(wrap => {
        const scroller = wrap.querySelector('.h-scroll');
        $$('.row-arrow', wrap).forEach(btn => {
            btn.addEventListener('click', () => {
                scroller.scrollBy({ left: scroller.clientWidth * 0.85 * (+btn.dataset.arrow), behavior: 'smooth' });
            });
        });
    });
}

const FAQ_ITEMS = [
    ['What is this site?', 'This site is a website you can stream most LEGO TV shows and movies on.'],
    ['Where does the video content come from?', 'Videos are embedded or streamed from official sources.'],
    ['Why is some content marked as "Coming Soon"?', 'Some shows or seasons are still being prepared and will be available at a later date. Check the Coming Soon page.'],
    ['How do I suggest a new feature?', 'Join the Discord server to make suggestions.'],
    ['What keyboard shortcuts work in the player?', 'Space / Enter = play/pause, ← / → = seek 10s, ↑ / ↓ = volume, F = fullscreen, M = mute, C = subtitles, Shift+N = next episode, Shift+P = previous episode, Esc = close player.'],
];
function faqHtml() {
    return `<section class="faq-section"><h2>FAQ</h2>${FAQ_ITEMS.map(([q, a]) => `
        <div class="faq-item">
            <button class="faq-q" type="button"><span>${esc(q)}</span><span class="icon">+</span></button>
            <div class="faq-a"><div class="faq-a-inner"><p>${esc(a)}</p></div></div>
        </div>`).join('')}</section>`;
}
function bindFaq(scope) {
    $$('.faq-item', scope).forEach(item => {
        item.querySelector('.faq-q').addEventListener('click', () => {
            const wasOpen = item.classList.contains('open');
            $$('.faq-item', scope).forEach(i => i.classList.remove('open'));
            if (!wasOpen) item.classList.add('open');
        });
    });
}

function renderHome() {
    const view = $('view');
    const showsList = state.shows.filter(s => !s.comingSoon && !isMovie(s));
    const moviesList = state.shows.filter(s => !s.comingSoon && isMovie(s));
    const soonList = state.shows.filter(s => s.comingSoon);
    const hasHero = state.heroData.length > 0;
    view.innerHTML = `<div class="page page-home">
        ${hasHero ? `<section class="hero" id="hero" aria-label="Featured">
            <div class="hero-slides" id="heroSlides"></div>
            <div class="hero-dots" id="heroDots"></div>
        </section>` : ''}
        <div class="page-inner ${hasHero ? '' : 'page-head-pad'}">
            <section class="row-section" id="continueSection" style="display:none">
                <div class="row-header"><h2>Continue Watching</h2></div>
                ${rowWrapHtml('continueGrid')}
            </section>
            <section class="row-section" id="myListSection" style="display:none">
                <div class="row-header"><h2>My List</h2></div>
                ${rowWrapHtml('myListGrid')}
            </section>
            ${showsList.length ? `<section class="row-section">
                <div class="row-header"><h2>Shows</h2><a class="row-link" href="#/shows">See all</a></div>
                ${rowWrapHtml('homeShowsRow')}
            </section>` : ''}
            ${moviesList.length ? `<section class="row-section">
                <div class="row-header"><h2>Movies</h2><a class="row-link" href="#/movies">See all</a></div>
                ${rowWrapHtml('homeMoviesRow')}
            </section>` : ''}
            ${soonList.length ? `<section class="row-section">
                <div class="row-header"><h2>Coming Soon</h2><a class="row-link" href="#/coming-soon">See all</a></div>
                ${rowWrapHtml('homeSoonRow')}
            </section>` : ''}
            ${faqHtml()}
        </div>
    </div>`;
    if (hasHero) buildHero();
    renderContinueRow();
    renderMyListRow();
    if (showsList.length) { $('homeShowsRow').innerHTML = showsList.map(posterCardHtml).join(''); }
    if (moviesList.length) { $('homeMoviesRow').innerHTML = moviesList.map(posterCardHtml).join(''); }
    if (soonList.length) { $('homeSoonRow').innerHTML = soonList.map(posterCardHtml).join(''); }
    bindPosterCards(view);
    bindRowArrows(view);
    bindFaq(view);
}

function buildHero() {
    state.heroIdx = 0;
    $('heroSlides').innerHTML = state.heroData.map((item, i) => {
        const show = getShow(item.showId);
        const soon = show && show.comingSoon;
        return `<div class="hero-slide${i === 0 ? ' active' : ''}" data-idx="${i}">
            <div class="hero-bg" style="background-image:url('${esc(item.heroBanner)}')"></div>
            <div class="hero-content">
                <div class="hero-pill"><span class="dot"></span><span>Featured</span></div>
                <h1 class="hero-title">${esc(item.title)}</h1>
                <p class="hero-desc">${esc(item.description)}</p>
                <div class="hero-actions">
                    ${!soon ? `<button class="btn-primary" type="button" data-hero-play="${esc(item.showId)}">${PLAY_SVG} Play</button>` : ''}
                    <a class="btn-secondary" href="#/details/${encodeURIComponent(item.showId)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        More Info</a>
                </div>
            </div>
        </div>`;
    }).join('');
    $('heroDots').innerHTML = state.heroData.map((_, i) => `<button class="hero-dot${i === 0 ? ' active' : ''}" type="button" data-idx="${i}" aria-label="Slide ${i + 1}"></button>`).join('');
    $$('#heroSlides [data-hero-play]').forEach(b => b.addEventListener('click', () => {
        const show = getShow(b.dataset.heroPlay);
        if (show) smartPlayShow(show);
    }));
    $$('#heroDots .hero-dot').forEach(d => d.addEventListener('click', () => { state.heroIdx = +d.dataset.idx; showHeroSlide(); resetHeroTimer(); }));
    const hero = $('hero');
    hero.addEventListener('mouseenter', () => clearInterval(state.heroTimer));
    hero.addEventListener('mouseleave', resetHeroTimer);
    resetHeroTimer();
}
function showHeroSlide() {
    $$('#heroSlides .hero-slide').forEach((s, i) => s.classList.toggle('active', i === state.heroIdx));
    $$('#heroDots .hero-dot').forEach((d, i) => d.classList.toggle('active', i === state.heroIdx));
}
function resetHeroTimer() {
    clearInterval(state.heroTimer);
    state.heroTimer = setInterval(() => {
        if (!$('heroSlides')) { clearInterval(state.heroTimer); return; }
        state.heroIdx = (state.heroIdx + 1) % state.heroData.length;
        showHeroSlide();
    }, 8000);
}
document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(state.heroTimer);
    else if (state.heroData.length && $('heroSlides')) resetHeroTimer();
});

function renderContinueRow() {
    const sec = $('continueSection'), grid = $('continueGrid');
    if (!sec || !grid) return;
    const entries = continueEntries();
    if (!entries.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    grid.innerHTML = entries.map(en => {
        const show = getShow(en.showId);
        const img = en.p.thumb || show.banner || show.poster;
        const left = (en.p.d && en.p.t) ? Math.max(1, Math.round((en.p.d - en.p.t) / 60)) + 'm left' : fmtClock(en.p.t) + ' watched';
        const epLabel = isMovie(show) ? (en.p.title || show.title) : `S${en.s} E${en.e}${en.p.title ? ' · ' + en.p.title : ''}`;
        return `<button class="continue-card" type="button" data-show="${esc(en.showId)}" data-s="${en.s}" data-e="${en.e}">
            <div class="cc-thumb">
                <img src="${esc(img)}" alt="" loading="lazy" decoding="async">
                <div class="cc-play"><span>${PLAY_SVG}</span></div>
                <div class="cc-prog"><div class="cc-prog-fill" style="width:${progPct(en.p).toFixed(1)}%"></div></div>
            </div>
            <div class="cc-meta"><div class="cc-title">${esc(show.title)}</div><div class="cc-sub">${esc(epLabel)} · ${esc(left)}</div></div>
        </button>`;
    }).join('');
    $$('.continue-card', grid).forEach(c => c.addEventListener('click', () => {
        playEpisodeByRef(c.dataset.show, parseInt(c.dataset.s), parseInt(c.dataset.e));
    }));
}
function renderMyListRow() {
    const sec = $('myListSection'), grid = $('myListGrid');
    if (!sec || !grid) return;
    const list = getMyList().map(getShow).filter(Boolean);
    if (!list.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    grid.innerHTML = list.map(posterCardHtml).join('');
    bindPosterCards(grid);
}

const BROWSE_META = {
    'shows': { title: 'Shows', blurb: 'Every series available to stream right now.', empty: 'No shows here yet.' },
    'movies': { title: 'Movies', blurb: 'Films and TV specials, ready to watch.', empty: 'No movies here yet.' },
    'coming-soon': { title: 'Coming Soon', blurb: 'Titles being prepared for the site. Check back soon — or join the Discord for updates.', empty: 'Nothing scheduled right now.' },
};
function browseList(kind) {
    if (kind === 'shows') return state.shows.filter(s => !s.comingSoon && !isMovie(s));
    if (kind === 'movies') return state.shows.filter(s => !s.comingSoon && isMovie(s));
    return state.shows.filter(s => s.comingSoon);
}
function renderBrowse(kind) {
    const meta = BROWSE_META[kind];
    const base = browseList(kind);
    const view = $('view');
    const genres = new Set();
    base.forEach(s => (s.genres || []).forEach(g => genres.add(g)));
    view.innerHTML = `<div class="page page-browse">
        <div class="page-inner page-head-pad">
            <h1 class="page-title">${meta.title}</h1>
            <p class="page-blurb">${meta.blurb}</p>
            <div class="filter-bar" id="filterBar">
                <button class="chip active" type="button" data-genre="All">All</button>
                ${[...genres].sort().map(g => `<button class="chip" type="button" data-genre="${esc(g)}">${esc(g)}</button>`).join('')}
                <select class="sort-select" id="sortSelect" aria-label="Sort">
                    <option value="default">Featured</option>
                    <option value="az">A–Z</option>
                    <option value="za">Z–A</option>
                    <option value="recent">Recently added</option>
                </select>
            </div>
            <div class="grid" id="browseGrid"></div>
        </div>
    </div>`;
    let activeGenre = 'All', sortMode = 'default';
    const apply = () => {
        let list = base.slice();
        if (activeGenre !== 'All') list = list.filter(s => s.genres && s.genres.includes(activeGenre));
        if (sortMode === 'az') list.sort((a, b) => a.title.localeCompare(b.title));
        else if (sortMode === 'za') list.sort((a, b) => b.title.localeCompare(a.title));
        else if (sortMode === 'recent') list.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
        const grid = $('browseGrid');
        grid.innerHTML = list.length ? list.map(posterCardHtml).join('') : `<p class="empty-msg">${meta.empty}</p>`;
        bindPosterCards(grid);
    };
    $$('#filterBar .chip').forEach(c => c.addEventListener('click', () => {
        activeGenre = c.dataset.genre;
        $$('#filterBar .chip').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        apply();
    }));
    $('sortSelect').addEventListener('change', (e) => { sortMode = e.target.value; apply(); });
    apply();
}


function renderSearch() {
    const view = $('view');
    view.innerHTML = `<div class="page page-search">
        <div class="page-inner page-head-pad">
            <div class="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input type="text" id="searchInput" placeholder="Search shows and movies..." autocomplete="off" spellcheck="false">
            </div>
            <div class="grid" id="searchGrid"></div>
            <p class="search-hint" id="searchHint">Type to search across all shows and movies.</p>
        </div>
    </div>`;
    const input = $('searchInput');
    let deb = null;
    const run = () => {
        const term = input.value.trim().toLowerCase();
        const grid = $('searchGrid'), hint = $('searchHint');
        if (!term) {
            grid.innerHTML = state.shows.map(posterCardHtml).join('');
            hint.style.display = 'none';
            bindPosterCards(grid);
            return;
        }
        const results = state.shows.filter(s =>
            s.title.toLowerCase().includes(term) ||
            (s.genres || []).some(g => g.toLowerCase().includes(term)));
        grid.innerHTML = results.map(posterCardHtml).join('');
        hint.style.display = results.length ? 'none' : 'block';
        hint.textContent = results.length ? '' : `No results for “${input.value.trim()}”.`;
        bindPosterCards(grid);
    };
    input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(run, 140); });
    run();
    if (!tvActive) setTimeout(() => input.focus(), 60);
}

function findResumeTarget(show) {
    const latest = latestEntryForShow(show.id);
    if (latest) return { s: latest.s, e: latest.e, resume: true, p: latest.p };
    const playable = playableSeasons(show);
    if (!playable.length) return null;
    // s:null lets playEpisodeByRef walk seasons for the first playable episode
    return { s: null, e: null, resume: false };
}
function renderDetails(id) {
    const show = getShow(id);
    const view = $('view');
    if (!show) {
        view.innerHTML = `<div class="page"><div class="page-inner page-head-pad"><h1 class="page-title">Not found</h1><p class="page-blurb">That title doesn't exist.</p><a class="btn-primary" href="#/">Go Home</a></div></div>`;
        return;
    }
    document.title = `${show.title} — Litestreaming`;
    const playable = playableSeasons(show);
    const target = !show.comingSoon ? findResumeTarget(show) : null;
    const inList = isInMyList(show.id);
    const seasonsLabel = isMovie(show)
        ? (show.runtime ? esc(show.runtime) : '')
        : (playable.length ? `${playable.length} Season${playable.length > 1 ? 's' : ''}` : '');
    const metaBits = [];
    if (show.rating) metaBits.push(`<span class="meta-badge">${esc(show.rating)}</span>`);
    metaBits.push('<span class="meta-badge">HD</span>');
    if (show.years) metaBits.push(`<span class="meta-text">${esc(show.years)}</span>`);
    if (seasonsLabel) metaBits.push('<span class="meta-dot">•</span>', `<span class="meta-text">${seasonsLabel}</span>`);
    const comingSeasonTags = (show.seasons || []).filter(s => s.comingSoonText).map(s => `<span class="coming-tag">${esc(s.comingSoonText)}</span>`).join('');
    let playLabel = 'Play';
    if (target && target.resume) playLabel = isMovie(show) ? 'Resume' : `Resume S${target.s} E${target.e}`;
    const hasEpisodesTab = playable.length > 0 && !isMovie(show) && !show.comingSoon;
    state.detail = { show, seasonIdx: -1, data: null, tab: hasEpisodesTab ? 'episodes' : 'details', reqId: state.detail.reqId + 1 };

    view.innerHTML = `<div class="page page-details">
        <div class="detail-hero">
            <div class="detail-bg" style="background-image:url('${esc(show.banner || show.poster)}')"></div>
            <div class="detail-hero-inner">
                ${show.logo ? `<img class="detail-logo" src="${esc(show.logo)}" alt="${esc(show.title)}">` : `<h1 class="detail-title">${esc(show.title)}</h1>`}
                <div class="meta-row">${metaBits.join('')}</div>
                ${show.genres && show.genres.length ? `<div class="genre-line">${esc(show.genres.join(' · '))}</div>` : ''}
                <div class="action-row">
                    ${show.comingSoon
                        ? `<span class="soon-banner">⏳ ${esc(show.comingSoonText || 'Coming Soon')}</span>`
                        : `${target ? `<button class="btn-primary" id="detailPlayBtn" type="button">${PLAY_SVG} ${esc(playLabel)}</button>` : ''}
                           <button class="icon-circle-btn${inList ? ' in-list' : ''}" id="detailListBtn" type="button" data-show="${esc(show.id)}" title="${inList ? 'Remove from My List' : 'Add to My List'}"></button>`}
                </div>
                <p class="detail-summary">${esc(show.summary || '')}</p>
                ${show.comingSoon && show.comingSoonNote ? `<p class="detail-summary" style="color:var(--text-secondary)">${esc(show.comingSoonNote)}</p>` : ''}
                ${comingSeasonTags ? `<div class="coming-tags">${comingSeasonTags}</div>` : ''}
            </div>
        </div>
        <div class="page-inner">
            <div class="tabs" id="detailTabs">
                ${hasEpisodesTab ? '<button class="tab" type="button" data-tab="episodes">Episodes</button>' : ''}
                <button class="tab" type="button" data-tab="details">Details</button>
            </div>
            <div id="tabPanel"></div>
        </div>
    </div>`;

    if (!show.comingSoon) {
        const listBtn = $('detailListBtn');
        if (listBtn) {
            updateListButtons(show.id);
            listBtn.addEventListener('click', () => toggleMyList(show.id));
        }
        const playBtn = $('detailPlayBtn');
        if (playBtn && target) playBtn.addEventListener('click', () => playEpisodeByRef(show.id, target.s, target.e));
    }
    $$('#detailTabs .tab').forEach(t => t.addEventListener('click', () => setDetailTab(t.dataset.tab)));
    setDetailTab(state.detail.tab);
}
function setDetailTab(tab) {
    state.detail.tab = tab;
    $$('#detailTabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    if (tab === 'episodes') renderEpisodesTab();
    else renderDetailsTab();
}
function renderDetailsTab() {
    const show = state.detail.show;
    const playable = playableSeasons(show);
    const fields = [];
    if (show.years) fields.push(['Release Date', show.years]);
    if (show.genres && show.genres.length) fields.push(['Genre', show.genres.join(', ')]);
    if (show.rating) fields.push(['Rating', show.rating]);
    if (isMovie(show)) { if (show.runtime) fields.push(['Runtime', show.runtime]); }
    else if (playable.length) fields.push(['Seasons', String(playable.length)]);
    const people = [];
    if (show.creator) people.push(['Creator', Array.isArray(show.creator) ? show.creator.join(', ') : show.creator]);
    if (show.starring && show.starring.length) people.push(['Starring', show.starring.join('<br>')]);
    $('tabPanel').innerHTML = `<div class="details-panel">
        <h3>${esc(show.title)}</h3>
        <p>${esc(show.summary || '')}</p>
        <div class="details-cols">
            <div>${fields.map(([k, v]) => `<div class="detail-field"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</div>
            <div>${people.map(([k, v]) => `<div class="detail-field"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</div>
        </div>
    </div>`;
}
function renderEpisodesTab() {
    const show = state.detail.show;
    const playable = playableSeasons(show);
    if (!playable.length) { $('tabPanel').innerHTML = '<p class="empty-msg">No episodes currently available.</p>'; return; }
    let startIdx = 0;
    const latest = latestEntryForShow(show.id);
    if (latest) {
        const i = playable.findIndex(s => s.number === latest.s);
        if (i >= 0) startIdx = i;
    }
    if (state.detail.seasonIdx >= 0 && state.detail.seasonIdx < playable.length) startIdx = state.detail.seasonIdx;
    $('tabPanel').innerHTML = `
        <div class="season-dropdown" id="seasonDropdown">
            <button class="season-btn" id="seasonBtn" type="button" aria-haspopup="true">
                <span id="seasonLabel">Season ${esc(String(playable[startIdx].number))}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            <div class="season-menu" id="seasonMenu">
                ${playable.map((s, i) => `<button class="season-opt${i === startIdx ? ' active' : ''}" type="button" data-si="${i}">Season ${esc(String(s.number))}</button>`).join('')}
            </div>
        </div>
        <div class="ep-list" id="epList"></div>`;
    $('seasonBtn').addEventListener('click', (e) => { e.stopPropagation(); $('seasonDropdown').classList.toggle('open'); });
    $$('#seasonMenu .season-opt').forEach(o => o.addEventListener('click', () => pickDetailSeason(+o.dataset.si)));
    pickDetailSeason(startIdx);
}
function pickDetailSeason(si) {
    const show = state.detail.show;
    const playable = playableSeasons(show);
    if (si < 0 || si >= playable.length) return;
    state.detail.seasonIdx = si;
    const dd = $('seasonDropdown');
    if (dd) {
        dd.classList.remove('open');
        $('seasonLabel').textContent = 'Season ' + playable[si].number;
        $$('#seasonMenu .season-opt').forEach((o, j) => o.classList.toggle('active', j === si));
    }
    const reqId = ++state.detail.reqId;
    showEpSkeleton();
    fetchSeason(playable[si].file).then(data => {
        if (reqId !== state.detail.reqId || !$('epList')) return;
        state.detail.data = data;
        if (data.type === 'external') renderExternalSeason(data);
        else renderEpisodeList(show, playable[si].number, data);
    }).catch(() => {
        if (reqId === state.detail.reqId && $('epList')) $('epList').innerHTML = '<p class="empty-msg">Failed to load episodes.</p>';
    });
}
function showEpSkeleton() {
    const el = $('epList');
    if (!el) return;
    el.innerHTML = Array(5).fill().map(() => `
        <div class="ep-skeleton">
            <div class="ep-skel-thumb skeleton"></div>
            <div class="ep-skel-content"><div class="ep-skel-line med skeleton"></div><div class="ep-skel-line short skeleton"></div></div>
        </div>`).join('');
}
function renderExternalSeason(data) {
    $('epList').innerHTML = `<div class="external-season">
        <a class="btn-primary" href="${esc(data.button.url)}" target="_blank" rel="noopener">${esc(data.button.label)}</a>
        <p>${esc(data.note || '')}</p>
    </div>`;
}
function epRowHtml(show, seasonNumber, ep, i) {
    const st = epStatus(ep);
    const p = st ? null : getProgress(show.id, seasonNumber, ep.number);
    const dur = st ? '' : (fmtEpDuration(ep.duration) || durCache[ep.embed] || '');
    return `<a class="ep-row${st ? ' is-status' : ''}" href="#/details/${encodeURIComponent(show.id)}/${seasonNumber}/${ep.number}" data-ep="${i}" draggable="false">
        <div class="ep-num">${esc(String(ep.number))}</div>
        <div class="ep-thumb">
            <img src="${esc(ep.thumbnail || '')}" alt="" loading="lazy" decoding="async" draggable="false">
            ${st
                ? `<div class="ep-status"><span>${esc(st.label)}</span></div>`
                : `<button class="ep-playbtn" type="button" data-play-ep="${i}" aria-label="Play ${esc(ep.title || 'episode')}"><span>${PLAY_SVG}</span></button>
                   ${isWatched(p) ? '<div class="ep-watched">✓</div>' : ''}
                   ${isInProgress(p) ? `<div class="ep-prog"><div class="ep-prog-fill" style="width:${progPct(p).toFixed(1)}%"></div></div>` : ''}`}
        </div>
        <div class="ep-info">
            <div class="ep-title-row"><h4 class="ep-title">${esc(ep.title || '')}</h4>${st ? '' : `<span class="ep-dur" data-dur-url="${esc(ep.embed || '')}">${esc(dur)}</span>`}</div>
            <p class="ep-desc">${esc(ep.description || '')}</p>
        </div>
    </a>`;
}
function renderEpisodeList(show, seasonNumber, data) {
    const eps = data.episodes || [];
    const el = $('epList');
    if (!eps.length) { el.innerHTML = '<p class="empty-msg">No episodes in this season yet.</p>'; return; }
    el.innerHTML = eps.map((ep, i) => epRowHtml(show, seasonNumber, ep, i)).join('');
    $$('[data-play-ep]', el).forEach(btn => btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        openPlayer(show, seasonNumber, data, +btn.dataset.playEp);
    }));
    observeDurations(el);
}
function observeDurations(scope) {
    if (state.durIO) state.durIO.disconnect();
    if (!('IntersectionObserver' in window)) return;
    state.durIO = new IntersectionObserver((entries) => {
        entries.forEach(en => {
            if (!en.isIntersecting) return;
            state.durIO.unobserve(en.target);
            const span = en.target.querySelector('.ep-dur');
            if (span && !span.textContent.trim() && span.dataset.durUrl) queueDuration(span.dataset.durUrl, span);
        });
    }, { rootMargin: '120px 0px' });
    $$('.ep-row', scope).forEach(r => state.durIO.observe(r));
}
document.addEventListener('click', (e) => {
    const dd = $('seasonDropdown');
    if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});

function renderEpisodePage(id, sNum, eNum) {
    const show = getShow(id);
    const view = $('view');
    if (!show) { location.hash = '#/'; return; }
    const playable = playableSeasons(show);
    const ref = playable.find(x => x.number === sNum);
    if (!ref) { location.hash = '#/details/' + encodeURIComponent(id); return; }
    view.innerHTML = `<div class="page"><div class="page-inner page-head-pad"><div class="ep-skeleton"><div class="ep-skel-thumb skeleton" style="width:340px"></div><div class="ep-skel-content"><div class="ep-skel-line med skeleton"></div><div class="ep-skel-line short skeleton"></div></div></div></div></div>`;
    fetchSeason(ref.file).then(data => {
        if (state.route.name !== 'episode' || state.route.id !== id || state.route.s !== sNum || state.route.e !== eNum) return;
        if (data.type === 'external' || !data.episodes || !data.episodes.length) { location.hash = '#/details/' + encodeURIComponent(id); return; }
        const eps = data.episodes;
        const idx = eps.findIndex(x => x.number === eNum);
        if (idx < 0) { location.hash = '#/details/' + encodeURIComponent(id); return; }
        renderEpisodePageContent(show, ref.number, data, idx);
    }).catch(() => {
        view.innerHTML = `<div class="page"><div class="page-inner page-head-pad"><h1 class="page-title">Couldn't load episode</h1><a class="btn-primary" href="#/details/${encodeURIComponent(id)}">Back to ${esc(show.title)}</a></div></div>`;
    });
}
function renderEpisodePageContent(show, seasonNumber, data, idx) {
    const view = $('view');
    const eps = data.episodes;
    const ep = eps[idx];
    const st = epStatus(ep);
    const p = st ? null : getProgress(show.id, seasonNumber, ep.number);
    const watched = isWatched(p), inProg = isInProgress(p);
    const dur = st ? '' : (fmtEpDuration(ep.duration) || durCache[ep.embed] || '');
    const prevEp = idx > 0 ? eps[idx - 1] : null;
    const nextEp = idx < eps.length - 1 ? eps[idx + 1] : null;
    const sources = episodeSources(ep);
    const canPlay = sources.length > 0;
    const playLabel = inProg ? 'Resume' : 'Play';
    document.title = `${show.title} S${seasonNumber} E${ep.number} — Litestreaming`;
    view.innerHTML = `<div class="page page-episode">
        <div class="ep-hero"><div class="ep-hero-bg" style="background-image:url('${esc(ep.thumbnail || show.banner || '')}')"></div></div>
        <div class="page-inner ep-page">
            <a class="crumb" href="#/details/${encodeURIComponent(show.id)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
                ${esc(show.title)}</a>
            <div class="ep-page-grid">
                <div class="ep-page-thumb${st ? ' is-status' : ''}">
                    <img src="${esc(ep.thumbnail || show.banner || '')}" alt="" decoding="async">
                    ${st ? `<div class="ep-status"><span>${esc(st.label)}</span></div>` : ''}
                    ${inProg ? `<div class="ep-prog"><div class="ep-prog-fill" style="width:${progPct(p).toFixed(1)}%"></div></div>` : ''}
                </div>
                <div>
                    <div class="ep-page-kicker">${isMovie(show) ? 'Movie' : `Season ${seasonNumber} · Episode ${ep.number}`}</div>
                    <h1 class="ep-page-title">${esc(ep.title || 'Episode ' + ep.number)}</h1>
                    <div class="meta-row">
                        ${st ? `<span class="meta-badge status-badge">${esc(st.label)}</span>` : ''}
                        ${dur ? `<span class="meta-text">${esc(dur)}</span>` : (ep.embed && !st ? `<span class="meta-text" id="epPageDur"></span>` : '')}
                        ${watched ? '<span class="meta-badge" style="color:var(--success);border-color:var(--success)">✓ Watched</span>' : ''}
                        ${show.rating ? `<span class="meta-badge">${esc(show.rating)}</span>` : ''}
                    </div>
                    <p class="ep-page-desc">${esc(ep.description || 'No description available for this episode.')}</p>
                    <div class="action-row">
                        ${canPlay
                            ? `<button class="btn-primary" id="epPlayBtn" type="button">${PLAY_SVG} ${playLabel}</button>`
                            : `<button class="btn-primary" disabled type="button">${st ? esc(st.label) : 'Unavailable'}</button>`}
                        ${prevEp ? `<a class="btn-secondary" href="#/details/${encodeURIComponent(show.id)}/${seasonNumber}/${prevEp.number}">‹ E${prevEp.number}</a>` : ''}
                        ${nextEp ? `<a class="btn-secondary" href="#/details/${encodeURIComponent(show.id)}/${seasonNumber}/${nextEp.number}">E${nextEp.number} ›</a>` : ''}
                    </div>
                    ${st && st.id === 'upcoming' ? '<p class="resume-note">This episode isn\'t out yet — check back later.</p>' : ''}
                    ${inProg ? `<p class="resume-note">You're ${Math.round(progPct(p))}% through — playback resumes from ${fmtClock(p.t)}.</p>` : ''}
                </div>
            </div>
            ${eps.length > 1 ? `<section class="row-section">
                <div class="row-header"><h2>More episodes</h2></div>
                ${rowWrapHtml('epMiniRow')}
            </section>` : ''}
        </div>
    </div>`;
    if (canPlay) $('epPlayBtn').addEventListener('click', () => openPlayer(show, seasonNumber, data, idx));
    const durEl = $('epPageDur');
    if (durEl) queueDuration(ep.embed, durEl);
    if (eps.length > 1) {
        $('epMiniRow').innerHTML = eps.map((e2, i2) => {
            const st2 = epStatus(e2);
            const p2 = st2 ? null : getProgress(show.id, seasonNumber, e2.number);
            return `<a class="ep-mini${i2 === idx ? ' current' : ''}${st2 ? ' is-status' : ''}" href="#/details/${encodeURIComponent(show.id)}/${seasonNumber}/${e2.number}" draggable="false">
                <div class="ep-mini-thumb">
                    <img src="${esc(e2.thumbnail || '')}" alt="" loading="lazy" decoding="async" draggable="false">
                    ${st2 ? `<div class="ep-status"><span>${esc(st2.label)}</span></div>` : ''}
                    ${isInProgress(p2) ? `<div class="ep-prog"><div class="ep-prog-fill" style="width:${progPct(p2).toFixed(1)}%"></div></div>` : ''}
                    ${isWatched(p2) ? '<div class="ep-watched">✓</div>' : ''}
                </div>
                <div class="ep-mini-t">${e2.number}. ${esc(e2.title || '')}</div>
            </a>`;
        }).join('');
        bindRowArrows(view);
    }
    tvInitialFocus();
}

function smartPlayShow(show) {
    if (show.comingSoon) { location.hash = '#/details/' + encodeURIComponent(show.id); return; }
    const target = findResumeTarget(show);
    if (!target) { location.hash = '#/details/' + encodeURIComponent(show.id); return; }
    playEpisodeByRef(show.id, target.s, target.e);
}
async function playEpisodeByRef(showId, sNum, eNum) {
    const show = getShow(showId);
    if (!show) return;
    const playable = playableSeasons(show);
    // explicit season requested → just that one; otherwise walk seasons until
    // we find something playable (skips external-only and upcoming seasons)
    const tryList = sNum != null ? playable.filter(x => x.number === sNum) : playable;
    if (!tryList.length) { location.hash = '#/details/' + encodeURIComponent(showId); return; }
    for (const ref of tryList) {
        let data;
        try { data = await fetchSeason(ref.file); } catch { continue; }
        if (data.type === 'external' || !data.episodes || !data.episodes.length) continue;
        const eps = data.episodes;
        if (eNum != null) {
            const idx = eps.findIndex(x => x.number === eNum);
            if (idx < 0) continue;
            if (!episodeSources(eps[idx]).length) {
                location.hash = `#/details/${encodeURIComponent(showId)}/${ref.number}/${eNum}`;
                return;
            }
            openPlayer(show, ref.number, data, idx);
            return;
        }
        const idx = eps.findIndex(x => episodeSources(x).length);
        if (idx < 0) continue;
        openPlayer(show, ref.number, data, idx);
        return;
    }
    location.hash = '#/details/' + encodeURIComponent(showId);
    toast('No streamable episodes available yet.');
}

const playerEl = () => $('player');
const playerOpen = () => playerEl().classList.contains('open');

function resetPlayerDom() {
    const video = $('pVideo'), frame = $('pFrame');
    video.ontimeupdate = null; video.onplay = null; video.onpause = null; video.onended = null;
    video.onwaiting = null; video.onplaying = null; video.oncanplay = null; video.onerror = null;
    video.pause();
    if (state.play.cueTrack) { try { state.play.cueTrack.removeEventListener('cuechange', renderActiveCues); } catch {} state.play.cueTrack = null; }
    state.play.subIdx = -1;
    try { video.removeAttribute('src'); while (video.firstChild) video.removeChild(video.firstChild); video.load(); } catch {}
    if (video._objectUrls) { video._objectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); }
    video._objectUrls = [];
    if (state.hls) { state.hls.destroy(); state.hls = null; }
    frame.src = ''; frame.style.display = 'none';
    $$('.player-error', $('pVideoArea')).forEach(e => e.remove());
    $$('.progress-marker').forEach(m => m.remove());
    $('subOverlay').innerHTML = '';
    $('skipBtn').classList.remove('show');
    $('nextToast').classList.remove('show');
    $('pLoader').classList.remove('show');
    $('pFill').style.width = '0%'; $('pBuffered').style.width = '0%'; $('pHandle').style.left = '0%';
    $('timeDisplay').textContent = '0:00 / 0:00';
    $('qualBtn').style.display = 'none';
    state.currentSkipTarget = null;
    closeAllPopups();
    updatePlayIcon(false);
    updateCCBtn();
}

function openPlayer(show, seasonNumber, seasonData, epIdx) {
    const eps = seasonData.episodes || [];
    if (!eps[epIdx]) return;
    const ep = eps[epIdx];
    state.play.show = show;
    state.play.seasonNumber = seasonNumber;
    state.play.seasonData = seasonData;
    state.play.epIdx = epIdx;
    state.play.sources = episodeSources(ep);
    state.play.srcIdx = -1;
    state.play.kind = null;
    state.play.defaultSubPicked = false;

    if (!playerOpen()) {
        try { history.pushState({ lsPlayer: true }, '', location.href); state.play.pushed = true; } catch {}
    }
    resetPlayerDom();
    $('pShowName').textContent = show.title;
    $('pEpName').textContent = isMovie(show) ? (ep.title || show.title) : `S${seasonNumber} · E${ep.number} — ${ep.title || ''}`;
    $('srcBtn').style.display = state.play.sources.length > 1 ? 'inline-flex' : 'none';
    $('airplayBtn').style.display = 'none';
    playerEl().classList.add('open');
    document.body.classList.add('lock');
    applySubStyle();

    if (!state.play.sources.length) {
        $('controlsBar').style.display = 'none';
        showPlayerError('This episode could not be loaded. Try again later or report it on Discord.');
        return;
    }
    const firstPlayable = state.play.sources.findIndex(s => s.type !== 'tab');
    if (firstPlayable < 0) {
        $('controlsBar').style.display = 'none';
        showSourcePanel('This episode opens in an external player:');
        return;
    }
    startSource(firstPlayable);
    resetCtrlTimer();
}

function startSource(i) {
    const src = state.play.sources[i];
    if (!src) return;
    if (src.type === 'tab') { window.open(src.url, '_blank', 'noopener'); return; }
    const video = $('pVideo'), frame = $('pFrame');
    const ep = state.play.seasonData.episodes[state.play.epIdx];

    // stop whatever is currently playing
    video.ontimeupdate = null; video.onerror = null;
    video.pause();
    if (state.play.cueTrack) { try { state.play.cueTrack.removeEventListener('cuechange', renderActiveCues); } catch {} state.play.cueTrack = null; }
    state.play.subIdx = -1;
    try { video.removeAttribute('src'); while (video.firstChild) video.removeChild(video.firstChild); video.load(); } catch {}
    if (video._objectUrls) { video._objectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch {} }); }
    video._objectUrls = [];
    if (state.hls) { state.hls.destroy(); state.hls = null; }
    frame.src = '';
    $$('.player-error', $('pVideoArea')).forEach(e => e.remove());
    $$('.progress-marker').forEach(m => m.remove());
    $('subOverlay').innerHTML = '';
    $('qualBtn').style.display = 'none';

    state.play.srcIdx = i;
    state.play.kind = src.type;

    if (src.type === 'iframe') {
        $('controlsBar').style.display = 'none';
        $('pLoader').classList.remove('show');
        video.style.display = 'none';
        frame.style.display = 'block';
        frame.src = toEmbedUrl(src.url);
        playerEl().classList.remove('hide-ui');
    } else {
        $('controlsBar').style.display = 'block';
        frame.style.display = 'none';
        video.style.display = 'block';
        $('pLoader').classList.add('show');
        $('airplayBtn').style.display = window.WebKitPlaybackTargetAvailabilityEvent ? 'flex' : 'none';
        setupVideo(video, src.url, ep);
    }
    buildSrcMenu();
    resetCtrlTimer();
}

function setupVideo(video, videoSrc, ep) {
    const show = state.play.show;
    const sNum = state.play.seasonNumber;
    const epIdx = state.play.epIdx;
    const existing = getProgress(show.id, sNum, ep.number);
    const startTime = (existing && isInProgress(existing)) ? existing.t : 0;

    attachSubtitles(video, ep);
    video.playbackRate = state.playbackSpeed;
    $('speedLabel').textContent = state.playbackSpeed === 1 ? '1×' : state.playbackSpeed + '×';

    const introS = ep.introStart ?? null, introE = ep.introEnd ?? null;
    const recapS = ep.recapStart ?? null, recapE = ep.recapEnd ?? null;

    video.ontimeupdate = () => {
        const ct = video.currentTime, dur = video.duration;
        if (ct > 0 && isFinite(dur) && Date.now() - state.lastProgSave > 3000) {
            state.lastProgSave = Date.now();
            setProgress(show.id, sNum, ep.number, ct, dur, { title: ep.title, thumb: ep.thumbnail });
        }
        updateProgressUI(ct, dur);
        updateTime(ct, dur);
        const sb = $('skipBtn');
        if (recapS != null && recapE != null && ct >= recapS && ct < recapE) {
            sb.textContent = 'Skip Recap ▸'; state.currentSkipTarget = recapE; sb.classList.add('show');
        } else if (introS != null && introE != null && ct >= introS && ct < introE) {
            sb.textContent = 'Skip Intro ▸'; state.currentSkipTarget = introE; sb.classList.add('show');
        } else { sb.classList.remove('show'); state.currentSkipTarget = null; }
        const nt = $('nextToast');
        const ni = nextPlayableIdx(state.play.epIdx, 1);
        if (dur > 0 && isFinite(dur) && (dur - ct) <= 15 && ni >= 0) {
            const next = state.play.seasonData.episodes[ni];
            $('nextThumb').src = next.thumbnail || '';
            $('nextName').textContent = next.title || '';
            nt.classList.add('show');
        } else nt.classList.remove('show');
    };
    video.onended = () => {
        if (isFinite(video.duration) && video.duration > 0) setProgress(show.id, sNum, ep.number, video.duration, video.duration, { title: ep.title, thumb: ep.thumbnail });
        playNext();
    };
    video.onplay = () => { updatePlayIcon(true); $('pLoader').classList.remove('show'); };
    video.onpause = () => {
        updatePlayIcon(false);
        if (video.currentTime > 0 && isFinite(video.duration)) setProgress(show.id, sNum, ep.number, video.currentTime, video.duration, { title: ep.title, thumb: ep.thumbnail });
    };
    video.onwaiting = () => $('pLoader').classList.add('show');
    video.onplaying = () => $('pLoader').classList.remove('show');
    video.oncanplay = () => $('pLoader').classList.remove('show');
    video.onerror = () => fatalPlaybackError();

    const onReady = () => {
        $('pLoader').classList.remove('show');
        // HLS: duration is unknown at MANIFEST_PARSED — defer the resume seek
        // until metadata arrives, otherwise it would be silently skipped
        let resumed = false;
        const applyResume = () => {
            if (resumed || !isFinite(video.duration)) return;
            resumed = true;
            if (startTime > 0 && startTime < video.duration - 10) video.currentTime = startTime;
        };
        applyResume();
        if (!resumed) {
            video.addEventListener('loadedmetadata', applyResume, { once: true });
            video.addEventListener('durationchange', applyResume, { once: true });
        }
        video.play().catch(() => {});
        video.playbackRate = state.playbackSpeed;
        const addMarkers = () => { if (video.duration && isFinite(video.duration)) addProgressMarkers(video.duration, introS, introE, recapS, recapE); };
        addMarkers();
        if (!video.duration || !isFinite(video.duration)) video.addEventListener('durationchange', addMarkers, { once: true });
        if (state.hls && state.hls.levels && state.hls.levels.length > 1) buildQualMenu();
    };
    if (videoSrc.includes('.m3u8') && window.Hls && Hls.isSupported()) {
        state.hls = new Hls({ maxBufferLength: 30 });
        state.hls.loadSource(videoSrc);
        state.hls.attachMedia(video);
        state.hls.on(Hls.Events.MANIFEST_PARSED, onReady);
        state.hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { console.error('HLS fatal', d); fatalPlaybackError(); } });
    } else {
        video.src = videoSrc;
        video.addEventListener('loadedmetadata', onReady, { once: true });
    }
}
function fatalPlaybackError() {
    $('pLoader').classList.remove('show');
    if (state.play.sources.length > 1) showSourcePanel('Playback failed. Try a different source:');
    else showPlayerError('This episode could not be loaded. Try again later or report it on Discord.');
}
function showPlayerError(msg) {
    $$('.player-error', $('pVideoArea')).forEach(e => e.remove());
    const d = document.createElement('div');
    d.className = 'player-error';
    d.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3>Video Unavailable</h3><p>${esc(msg)}</p>
        <a class="discord-link" href="https://discord.gg/jmeYYbBcsN" target="_blank" rel="noopener">Open Discord</a>`;
    $('pVideoArea').appendChild(d);
}
function showSourcePanel(msg) {
    $$('.player-error', $('pVideoArea')).forEach(e => e.remove());
    const d = document.createElement('div');
    d.className = 'player-error';
    d.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        <h3>Pick a source</h3><p>${esc(msg)}</p>
        <div class="error-sources">${state.play.sources.map((s, i) =>
            s.type === 'tab'
                ? `<a class="src-choice" href="${esc(s.url)}" target="_blank" rel="noopener"><span>${esc(s.label)}</span><span class="src-type">NEW TAB</span></a>`
                : `<button class="src-choice" type="button" data-pick-src="${i}"><span>${esc(s.label)}</span><span class="src-type">${srcTypeTag(s)}</span></button>`
        ).join('')}</div>
        <a class="discord-link" href="https://discord.gg/jmeYYbBcsN" target="_blank" rel="noopener">Report on Discord</a>`;
    $('pVideoArea').appendChild(d);
    $$('[data-pick-src]', d).forEach(b => b.addEventListener('click', () => {
        d.remove();
        startSource(+b.dataset.pickSrc);
    }));
}
function buildSrcMenu() {
    const p = $('srcPopup');
    if (!p) return;
    p.innerHTML = '<div class="popup-label">Sources</div>' + state.play.sources.map((s, i) =>
        `<button class="popup-item${i === state.play.srcIdx ? ' active' : ''}" type="button" data-src-i="${i}"><span>${esc(s.label)}</span><span class="src-type">${srcTypeTag(s)}</span></button>`
    ).join('');
    $$('[data-src-i]', p).forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllPopups();
        const i = +b.dataset.srcI;
        const s = state.play.sources[i];
        if (s.type === 'tab') { window.open(s.url, '_blank', 'noopener'); return; }
        if (i !== state.play.srcIdx) startSource(i);
    }));
}

const getSubStyle = () => readJSON('lsSubStyle', { size: 'md', bg: 'solid' });
const subsEnabled = () => localStorage.getItem('lsSubsOn') !== '0';
function applySubStyle() {
    const st = getSubStyle();
    const size = SUB_SIZES.find(s => s.id === st.size) || SUB_SIZES[1];
    playerEl().style.setProperty('--sub-scale', size.scale);
    playerEl().classList.remove('sub-bg-solid', 'sub-bg-soft', 'sub-bg-none');
    playerEl().classList.add('sub-bg-' + (st.bg || 'solid'));
}
let subToken = 0;
function attachSubtitles(video, ep) {
    const subs = (ep.subtitles || []).filter(t => t.url && t.url.trim());
    const tok = ++subToken;
    subs.forEach((trk, i) => {
        fetch(trk.url).then(r => { if (!r.ok) throw new Error(); return r.blob(); }).then(blob => {
            if (tok !== subToken || !playerOpen()) return;
            const t = document.createElement('track');
            t.kind = 'subtitles';
            t.label = trk.label || trk.lang || ('Track ' + (i + 1));
            t.srclang = trk.lang || '';
            const burl = URL.createObjectURL(blob);
            video._objectUrls.push(burl);
            t.src = burl;
            video.appendChild(t);
            try { t.track.mode = 'hidden'; } catch {}
            const wantDefault = trk.default || trk.lang === 'en';
            if (wantDefault && !state.play.defaultSubPicked && subsEnabled()) {
                state.play.defaultSubPicked = true;
                setTimeout(() => setActiveSubTrack(trackIndexOf(video, t.track)), 150);
            }
        }).catch(() => {});
    });
}
function trackIndexOf(video, track) {
    for (let i = 0; i < video.textTracks.length; i++) if (video.textTracks[i] === track) return i;
    return -1;
}
function setActiveSubTrack(idx) {
    const video = $('pVideo');
    for (let i = 0; i < video.textTracks.length; i++) {
        try { video.textTracks[i].mode = 'hidden'; } catch {}
    }
    if (state.play.cueTrack) { try { state.play.cueTrack.removeEventListener('cuechange', renderActiveCues); } catch {} state.play.cueTrack = null; }
    $('subOverlay').innerHTML = '';
    state.play.subIdx = (idx != null && idx >= 0 && video.textTracks[idx]) ? idx : -1;
    if (state.play.subIdx >= 0) {
        state.play.lastSubIdx = state.play.subIdx;
        localStorage.setItem('lsSubsOn', '1');
        const t = video.textTracks[state.play.subIdx];
        state.play.cueTrack = t;
        t.addEventListener('cuechange', renderActiveCues);
        renderActiveCues();
    }
    updateCCBtn();
}
function cueToHtml(text) {
    let s = String(text || '')
        .replace(/<\/?(c|v|lang|ruby|rt)[^>]*>/gi, '')
        .replace(/<\d{2}:[^>]*>/g, '');
    s = esc(s);
    s = s.replace(/&lt;(\/?)(i|b|u)&gt;/gi, '<$1$2>');
    return s.split('\n').map(l => l.trim()).filter(Boolean)
        .map(l => `<span class="sub-line">${l}</span>`).join('');
}
function renderActiveCues() {
    const overlay = $('subOverlay');
    const t = state.play.cueTrack;
    if (!t || state.play.kind !== 'direct') { overlay.innerHTML = ''; return; }
    let html = '';
    if (t.activeCues) for (let i = 0; i < t.activeCues.length; i++) html += cueToHtml(t.activeCues[i].text);
    overlay.innerHTML = html;
}
function updateCCBtn() {
    $('ccBtn').classList.toggle('cc-on', state.play.subIdx >= 0);
}
function toggleSubtitles() {
    const video = $('pVideo');
    if (state.play.subIdx >= 0) {
        localStorage.setItem('lsSubsOn', '0');
        setActiveSubTrack(-1);
        localStorage.setItem('lsSubsOn', '0');
    } else {
        let idx = state.play.lastSubIdx;
        if (idx < 0 || !video.textTracks[idx]) idx = video.textTracks.length ? 0 : -1;
        if (idx < 0) { toast('No subtitles available'); return; }
        localStorage.setItem('lsSubsOn', '1');
        setActiveSubTrack(idx);
    }
}
function buildSubMenu() {
    const video = $('pVideo'), tracks = video.textTracks;
    let h = '<div class="popup-label">Subtitles</div>';
    h += `<button class="popup-item${state.play.subIdx < 0 ? ' active' : ''}" type="button" data-sub="off">Off</button>`;
    let hasSource = false;
    for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (t.label && t.label.startsWith('AI:')) continue;
        hasSource = true;
        h += `<button class="popup-item${state.play.subIdx === i ? ' active' : ''}" type="button" data-sub="${i}">${esc(t.label || t.language || 'Track ' + (i + 1))}</button>`;
    }
    for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        if (!t.label || !t.label.startsWith('AI:')) continue;
        h += `<button class="popup-item${state.play.subIdx === i ? ' active' : ''}" type="button" data-sub="${i}">${esc(t.label)}</button>`;
    }
    if (hasSource) {
        h += '<div class="popup-divider"></div><div class="popup-label">AI Translate</div>';
        TRANSLATE_LANGS.forEach(lang => {
            h += `<button class="popup-item" type="button" data-ai="${lang.code}" data-ai-label="${esc(lang.label)}">${esc(lang.label)}</button>`;
        });
    }
    const st = getSubStyle();
    h += '<div class="popup-divider"></div><div class="popup-label">Size</div><div class="popup-seg">' +
        SUB_SIZES.map(s => `<button type="button" class="${st.size === s.id ? 'active' : ''}" data-sub-size="${s.id}">${s.label}</button>`).join('') + '</div>';
    h += '<div class="popup-label">Background</div><div class="popup-seg">' +
        SUB_BGS.map(b => `<button type="button" class="${(st.bg || 'solid') === b.id ? 'active' : ''}" data-sub-bg="${b.id}">${b.label}</button>`).join('') + '</div>';
    const p = $('subPopup');
    p.innerHTML = h;
    $$('[data-sub]', p).forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (b.dataset.sub === 'off') { localStorage.setItem('lsSubsOn', '0'); setActiveSubTrack(-1); localStorage.setItem('lsSubsOn', '0'); }
        else setActiveSubTrack(parseInt(b.dataset.sub));
        closeAllPopups();
    }));
    $$('[data-ai]', p).forEach(b => b.addEventListener('click', (e) => setAISub(b.dataset.ai, b.dataset.aiLabel, e)));
    $$('[data-sub-size]', p).forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const st2 = getSubStyle(); st2.size = b.dataset.subSize; writeJSON('lsSubStyle', st2);
        applySubStyle(); buildSubMenu();
    }));
    $$('[data-sub-bg]', p).forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        const st2 = getSubStyle(); st2.bg = b.dataset.subBg; writeJSON('lsSubStyle', st2);
        applySubStyle(); buildSubMenu();
    }));
}
async function setAISub(code, label, e) {
    if (e) e.stopPropagation();
    const video = $('pVideo'), tracks = video.textTracks;
    const full = 'AI: ' + label;
    for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].label === full) { setActiveSubTrack(i); closeAllPopups(); return; }
    }
    let src = null;
    for (let i = 0; i < tracks.length; i++) if (!tracks[i].label || !tracks[i].label.startsWith('AI:')) { src = tracks[i]; break; }
    if (!src) { toast('No source subtitles available'); return; }
    if (src.mode === 'disabled') src.mode = 'hidden';
    await new Promise(r => setTimeout(r, 800));
    if (!src.cues || !src.cues.length) { toast('No cues to translate'); return; }
    closeAllPopups();
    toast('Translating...');
    const cues = [];
    for (let i = 0; i < src.cues.length; i++) cues.push({ s: src.cues[i].startTime, e: src.cues[i].endTime, t: src.cues[i].text });
    try {
        const SEP = ' ||| ';
        const translated = [];
        const chunk = 30;
        for (let i = 0; i < cues.length; i += chunk) {
            const c = cues.slice(i, i + chunk);
            const txt = c.map(x => x.t.replace(/\n/g, ' ').replace(/\|\|\|/g, ''));
            const joined = txt.join(SEP);
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${code}&dt=t&q=${encodeURIComponent(joined)}`;
            const resp = await fetch(url);
            const data = await resp.json();
            let ft = '';
            if (data && data[0]) ft = data[0].map(s => s[0]).join('');
            const parts = ft.split(/\s*\|\|\|\s*/);
            for (let j = 0; j < c.length; j++) translated.push(j < parts.length && parts[j].trim() ? parts[j].trim() : c[j].t);
        }
        let vtt = 'WEBVTT\n\n';
        for (let i = 0; i < cues.length; i++) vtt += `${fmtVTT(cues[i].s)} --> ${fmtVTT(cues[i].e)}\n${translated[i] || cues[i].t}\n\n`;
        const blob = new Blob([vtt], { type: 'text/vtt' });
        const burl = URL.createObjectURL(blob);
        if (video._objectUrls) video._objectUrls.push(burl);
        const nt = document.createElement('track');
        nt.kind = 'subtitles';
        nt.label = full;
        nt.srclang = code;
        nt.src = burl;
        video.appendChild(nt);
        await new Promise(r => setTimeout(r, 300));
        setActiveSubTrack(trackIndexOf(video, nt.track));
        toast('Subtitles translated');
    } catch (err) {
        console.error('AI translation error:', err);
        toast('Translation failed');
    }
}
function fmtVTT(s) {
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = Math.floor(s % 60), ms = Math.floor(s % 1 * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function togglePlay() { const v = $('pVideo'); if (state.play.kind !== 'direct') return; if (v.paused) v.play().catch(() => {}); else v.pause(); }
function updatePlayIcon(p) {
    $('playBtn').innerHTML = p
        ? '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    $('playBtn').setAttribute('aria-label', p ? 'Pause' : 'Play');
}
function toggleMute() {
    const v = $('pVideo');
    v.muted = !v.muted;
    $('volSlider').value = v.muted ? 0 : v.volume;
    updateMuteIcon(v.muted);
}
function updateMuteIcon(m) {
    $('muteBtn').innerHTML = m
        ? '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
}
function updateProgressUI(c, d) {
    if (!d || !isFinite(d)) return;
    const pct = (c / d) * 100;
    $('pFill').style.width = pct + '%';
    $('pHandle').style.left = pct + '%';
}
function updateTime(c, d) {
    $('timeDisplay').textContent = fmtClock(c) + ' / ' + fmtClock(d);
}
function addProgressMarkers(dur, iS, iE, rS, rE) {
    const bar = $('progressTrack');
    $$('.progress-marker').forEach(m => m.remove());
    const add = (s, e) => {
        if (s == null || e == null || s >= e) return;
        const m = document.createElement('div');
        m.className = 'progress-marker';
        m.style.left = (s / dur * 100) + '%';
        m.style.width = ((e - s) / dur * 100) + '%';
        bar.appendChild(m);
    };
    add(rS, rE); add(iS, iE);
}
function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
}
function lockLandscape() {
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch {}
}
function videoNativeFS() {
    // iPhone Safari: no element fullscreen — use the video's native fullscreen
    const v = $('pVideo');
    if (state.play.kind === 'direct' && v.webkitEnterFullscreen) { try { v.webkitEnterFullscreen(); } catch {} }
}
function toggleFS() {
    const el = playerEl();
    if (isFullscreen()) {
        try {
            if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        } catch {}
        return;
    }
    if (el.requestFullscreen) el.requestFullscreen().then(lockLandscape).catch(videoNativeFS);
    else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); lockLandscape(); }
    else videoNativeFS();
}
function updateFsIcon() {
    $('fsBtn').innerHTML = isFullscreen()
        ? '<svg viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
}
['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, updateFsIcon));
// While in iOS native fullscreen the custom overlay is hidden, so hand the
// active subtitle track to the native renderer and take it back afterwards.
$('pVideo').addEventListener('webkitbeginfullscreen', () => {
    if (state.play.cueTrack) try { state.play.cueTrack.mode = 'showing'; } catch {}
});
$('pVideo').addEventListener('webkitendfullscreen', () => {
    if (state.play.cueTrack) try { state.play.cueTrack.mode = 'hidden'; } catch {}
});
function resetCtrlTimer() {
    const m = playerEl();
    m.classList.remove('hide-ui');
    clearTimeout(state.controlsTimer);
    state.controlsTimer = setTimeout(() => {
        if (state.play.kind === 'direct' && !$('pVideo').paused) m.classList.add('hide-ui');
    }, 3200);
}
function flashSeek(side) {
    const el = $(side === 'left' ? 'seekLeft' : 'seekRight');
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
function nextPlayableIdx(from, dirn) {
    const eps = (state.play.seasonData && state.play.seasonData.episodes) || [];
    for (let i = from + dirn; i >= 0 && i < eps.length; i += dirn) {
        if (episodeSources(eps[i]).length) return i;
    }
    return -1;
}
function playNext() {
    const ni = nextPlayableIdx(state.play.epIdx, 1);
    if (ni >= 0) openPlayer(state.play.show, state.play.seasonNumber, state.play.seasonData, ni);
    else requestClosePlayer();
}
function playPrev() {
    const pi = nextPlayableIdx(state.play.epIdx, -1);
    if (pi >= 0) openPlayer(state.play.show, state.play.seasonNumber, state.play.seasonData, pi);
}
function requestClosePlayer() {
    if (state.play.pushed) { state.play.pushed = false; history.back(); }
    else closePlayerNow();
}
function closePlayerNow(skipRefresh) {
    resetPlayerDom();
    playerEl().classList.remove('open', 'hide-ui');
    if (!anyModalOpen()) document.body.classList.remove('lock');
    state.play.epIdx = -1;
    state.play.kind = null;
    state.play.pushed = false;
    if (skipRefresh) return;
    if (state.route.name === 'home') { renderContinueRow(); }
    else if (state.route.name === 'episode' || state.route.name === 'details') { route(); }
}

function togglePopup(id, e) {
    if (e) e.stopPropagation();
    const p = $(id);
    if (!p) return;
    const willOpen = !p.classList.contains('open');
    closeAllPopups();
    if (willOpen) {
        if (id === 'speedPopup') buildSpeedMenu();
        if (id === 'qualPopup' && state.hls) buildQualMenu();
        if (id === 'subPopup') buildSubMenu();
        if (id === 'dlPopup') buildDLMenu();
        if (id === 'srcPopup') buildSrcMenu();
        p.classList.add('open');
    }
}
function closeAllPopups() {
    ['speedPopup', 'qualPopup', 'subPopup', 'dlPopup', 'srcPopup'].forEach(id => {
        const el = $(id);
        if (el) el.classList.remove('open');
    });
}
$$('[data-popup]').forEach(btn => {
    btn.addEventListener('click', (e) => {
        if (e.target.closest('.popup')) return;
        togglePopup(btn.dataset.popup, e);
    });
});
document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-popup]') && !e.target.closest('.popup')) closeAllPopups();
});

function buildSpeedMenu() {
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    $('speedPopup').innerHTML = '<div class="popup-label">Speed</div>' + speeds.map(s =>
        `<button class="popup-item${s === state.playbackSpeed ? ' active' : ''}" type="button" data-speed="${s}">${s === 1 ? 'Normal' : s + '×'}</button>`).join('');
    $$('#speedPopup [data-speed]').forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        state.playbackSpeed = parseFloat(b.dataset.speed);
        localStorage.setItem('lsSpeed', state.playbackSpeed);
        $('pVideo').playbackRate = state.playbackSpeed;
        $('speedLabel').textContent = state.playbackSpeed === 1 ? '1×' : state.playbackSpeed + '×';
        closeAllPopups();
    }));
}
function buildQualMenu() {
    if (!state.hls || !state.hls.levels || state.hls.levels.length <= 1) return;
    $('qualBtn').style.display = 'flex';
    const p = $('qualPopup');
    let h = `<div class="popup-label">Quality</div><button class="popup-item${state.hls.currentLevel === -1 ? ' active' : ''}" type="button" data-q="-1">Auto</button>`;
    state.hls.levels.forEach((l, i) => {
        const lb = l.height ? l.height + 'p' : Math.round(l.bitrate / 1000) + 'k';
        h += `<button class="popup-item${state.hls.currentLevel === i ? ' active' : ''}" type="button" data-q="${i}">${lb}</button>`;
    });
    p.innerHTML = h;
    $$('[data-q]', p).forEach(b => b.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.hls) return;
        state.hls.currentLevel = parseInt(b.dataset.q);
        closeAllPopups();
        setTimeout(buildQualMenu, 500);
    }));
}
function buildDLMenu() {
    const p = $('dlPopup');
    const ep = state.play.seasonData && state.play.seasonData.episodes[state.play.epIdx];
    if (!ep) return;
    const src = state.play.sources[state.play.srcIdx];
    let h = '<div class="popup-label">Download</div>';
    if (src && src.type === 'direct') {
        if (src.url.includes('.m3u8')) h += `<button class="popup-item" type="button" data-dl="hls"><span>Stream</span><span class="src-type">.MP4</span></button>`;
        else h += `<button class="popup-item" type="button" data-dl="direct"><span>Direct</span><span class="src-type">FILE</span></button>`;
    }
    if (ep.downloads && ep.downloads.length) {
        h += '<div class="popup-divider"></div><div class="popup-label">Alt Sources</div>';
        ep.downloads.forEach(dl => {
            h += `<a class="popup-item" href="${esc(dl.url)}" target="_blank" rel="noopener" download><span>${esc(dl.label)}</span>${dl.size ? `<span class="src-type">${esc(dl.size)}</span>` : ''}</a>`;
        });
    }
    h += `<div class="dl-progress" id="dlProg" style="display:none"><div class="dl-progress-text" id="dlText">Preparing...</div><div class="dl-bar-outer"><div class="dl-bar-inner" id="dlBar"></div></div></div>`;
    p.innerHTML = h;
    $$('[data-dl]', p).forEach(b => b.addEventListener('click', (e) => {
        if (b.dataset.dl === 'hls') dlHLS(e); else dlDirect(e);
    }));
}
function dlFileName(ext) {
    const ep = state.play.seasonData.episodes[state.play.epIdx];
    return `${state.play.show.title} - S${state.play.seasonNumber}E${ep.number} - ${ep.title || ''}.${ext}`.replace(/[<>:"/\\|?*]/g, '');
}
async function dlHLS(e) {
    e.stopPropagation();
    if (state.isDownloading) return;
    state.isDownloading = true;
    const src = state.play.sources[state.play.srcIdx].url;
    const fn = dlFileName('mp4');
    const pw = $('dlProg'), pt = $('dlText'), pb = $('dlBar');
    if (pw) pw.style.display = 'block';
    try {
        pt.textContent = 'Fetching playlist...'; pb.style.width = '2%';
        const r = await fetch(src);
        const txt = await r.text();
        const base = src.substring(0, src.lastIndexOf('/') + 1);
        let segUrl = src, segTxt = txt;
        if (txt.includes('#EXT-X-STREAM-INF')) {
            const lines = txt.split('\n');
            let bestBw = 0, bestU = '';
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                    const bm = lines[i].match(/BANDWIDTH=(\d+)/);
                    const bw = bm ? parseInt(bm[1]) : 0;
                    const nl = lines[i + 1] ? lines[i + 1].trim() : '';
                    if (bw > bestBw && nl && !nl.startsWith('#')) { bestBw = bw; bestU = nl; }
                }
            }
            if (bestU) { segUrl = bestU.startsWith('http') ? bestU : base + bestU; const r2 = await fetch(segUrl); segTxt = await r2.text(); }
        }
        const segBase = segUrl.substring(0, segUrl.lastIndexOf('/') + 1);
        const segUrls = [];
        segTxt.split('\n').forEach(l => { const t = l.trim(); if (t && !t.startsWith('#')) segUrls.push(t.startsWith('http') ? t : segBase + t); });
        if (!segUrls.length) throw new Error('No segments');
        pt.textContent = `0/${segUrls.length} segments...`; pb.style.width = '5%';
        const segs = new Array(segUrls.length);
        let done = 0;
        const dl = async (i) => { const rr = await fetch(segUrls[i]); segs[i] = new Uint8Array(await rr.arrayBuffer()); done++; pb.style.width = (5 + Math.round(done / segUrls.length * 85)) + '%'; pt.textContent = `${done}/${segUrls.length} segments...`; };
        for (let i = 0; i < segUrls.length; i += 4) { const b = []; for (let j = i; j < Math.min(i + 4, segUrls.length); j++) b.push(dl(j)); await Promise.all(b); }
        pt.textContent = 'Combining...'; pb.style.width = '92%';
        let total = 0; segs.forEach(s => total += s.length);
        const combined = new Uint8Array(total);
        let off = 0; segs.forEach(s => { combined.set(s, off); off += s.length; });
        pt.textContent = 'Saving...'; pb.style.width = '98%';
        saveBlob(new Blob([combined], { type: 'video/mp4' }), fn);
        pt.textContent = 'Done!'; pb.style.width = '100%';
        toast('Download complete');
        setTimeout(() => { if (pw) pw.style.display = 'none'; }, 2000);
    } catch (err) {
        console.error(err); pt.textContent = 'Failed.'; toast('Download failed');
        setTimeout(() => { if (pw) pw.style.display = 'none'; }, 3000);
    }
    state.isDownloading = false;
}
async function dlDirect(e) {
    e.stopPropagation();
    if (state.isDownloading) return;
    state.isDownloading = true;
    const src = state.play.sources[state.play.srcIdx].url;
    const ext = src.split('.').pop().split('?')[0] || 'mp4';
    const fn = dlFileName(ext);
    const pw = $('dlProg'), pt = $('dlText'), pb = $('dlBar');
    if (pw) pw.style.display = 'block';
    try {
        pt.textContent = 'Downloading...'; pb.style.width = '10%';
        const r = await fetch(src);
        const reader = r.body.getReader();
        const cl = +r.headers.get('Content-Length') || 0;
        let recv = 0; const chunks = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value); recv += value.length;
            if (cl > 0) { pb.style.width = (Math.round(recv / cl * 90) + 5) + '%'; pt.textContent = `Downloading... ${(recv / 1048576).toFixed(1)} MB`; }
        }
        pt.textContent = 'Saving...'; pb.style.width = '98%';
        saveBlob(new Blob(chunks, { type: 'video/mp4' }), fn);
        pt.textContent = 'Done!'; pb.style.width = '100%';
        toast('Download complete');
        setTimeout(() => { if (pw) pw.style.display = 'none'; }, 2000);
    } catch (err) {
        console.error(err); pt.textContent = 'Failed.'; toast('Download failed');
        setTimeout(() => { if (pw) pw.style.display = 'none'; }, 3000);
    }
    state.isDownloading = false;
}
function saveBlob(blob, fn) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fn;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

$('playBtn').addEventListener('click', togglePlay);
$('prevEpBtn').addEventListener('click', playPrev);
$('nextEpBtn').addEventListener('click', playNext);
$('muteBtn').addEventListener('click', toggleMute);
$('fsBtn').addEventListener('click', toggleFS);
$('ccBtn').addEventListener('click', (e) => { if (e.target.closest('.popup')) return; });
$('playerCloseBtn').addEventListener('click', requestClosePlayer);
$('playerBackBtn').addEventListener('click', requestClosePlayer);
$('skipBtn').addEventListener('click', () => { if (state.currentSkipTarget != null) $('pVideo').currentTime = state.currentSkipTarget; });
$('nextToast').addEventListener('click', playNext);
$('nextToast').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playNext(); } });
$('airplayBtn').addEventListener('click', () => { const v = $('pVideo'); if (v.webkitShowPlaybackTargetPicker) v.webkitShowPlaybackTargetPicker(); });
$('volSlider').addEventListener('input', (e) => {
    const v = $('pVideo');
    v.volume = parseFloat(e.target.value);
    v.muted = v.volume === 0;
    updateMuteIcon(v.muted);
});
// Pointer-based seeking: tap or drag anywhere on the bar (mouse + touch)
(() => {
    const wrap = $('progressWrap');
    let dragging = false;
    const seekTo = (clientX) => {
        const v = $('pVideo');
        if (!v.duration || !isFinite(v.duration)) return;
        const r = wrap.getBoundingClientRect();
        const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
        v.currentTime = pct * v.duration;
        updateProgressUI(v.currentTime, v.duration);
        updateTime(v.currentTime, v.duration);
    };
    wrap.addEventListener('pointerdown', (e) => {
        if (state.play.kind !== 'direct') return;
        dragging = true;
        try { wrap.setPointerCapture(e.pointerId); } catch {}
        seekTo(e.clientX);
        resetCtrlTimer();
    });
    wrap.addEventListener('pointermove', (e) => { if (dragging) { seekTo(e.clientX); resetCtrlTimer(); } });
    const end = () => { dragging = false; };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
})();
let bufferInterval = setInterval(() => {
    if (!playerOpen()) return;
    const v = $('pVideo');
    if (v.buffered.length && v.duration && isFinite(v.duration)) {
        $('pBuffered').style.width = (v.buffered.end(v.buffered.length - 1) / v.duration * 100) + '%';
    }
}, 1000);
playerEl().addEventListener('mousemove', resetCtrlTimer);

let lastTapTime = 0, lastTapX = 0;
$('pVideoArea').addEventListener('touchend', function (e) {
    state.lastTouch = Date.now();
    if (e.target.closest('.controls-bar') || e.target.closest('.skip-btn') || e.target.closest('.next-toast') || e.target.closest('.player-top') || e.target.closest('.player-error')) return;
    const now = Date.now();
    const x = e.changedTouches[0].clientX;
    const w = this.clientWidth;
    if (now - lastTapTime < 300 && Math.abs(x - lastTapX) < 100) {
        e.preventDefault();
        const v = $('pVideo');
        if (state.play.kind !== 'direct' || !v.duration || !isFinite(v.duration)) return;
        if (x < w / 2) { v.currentTime = Math.max(0, v.currentTime - 10); flashSeek('left'); }
        else { v.currentTime = Math.min(v.duration, v.currentTime + 10); flashSeek('right'); }
        lastTapTime = 0;
        resetCtrlTimer();
    } else {
        lastTapTime = now; lastTapX = x;
        // single tap toggles the controls instead of pausing
        const m = playerEl();
        if (state.play.kind === 'direct' && !m.classList.contains('hide-ui') && !$('pVideo').paused) {
            m.classList.add('hide-ui');
            closeAllPopups();
        } else {
            resetCtrlTimer();
        }
    }
});
$('pVideoArea').addEventListener('click', (e) => {
    if (Date.now() - state.lastTouch < 700) return; // touch taps handled above
    resetCtrlTimer();
    if (e.target.closest('button, a, .controls-bar, .player-top, .next-toast, .skip-btn, .player-error, .popup')) return;
    togglePlay();
});
$('pVideoArea').addEventListener('dblclick', (e) => {
    if (Date.now() - state.lastTouch < 700) return;
    if (e.target.closest('button, a, .controls-bar, .player-top, .player-error')) return;
    toggleFS();
});

function ctrlButtons() {
    return $$('#controlsBar .ctrl-btn').filter(b => b.offsetParent !== null);
}
document.addEventListener('keydown', (e) => {
    if (!playerOpen()) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const v = $('pVideo');
    const direct = state.play.kind === 'direct';
    const isBack = e.key === 'Escape' || e.keyCode === 461 || e.keyCode === 10009 || e.key === 'GoBack' || e.key === 'BrowserBack' || (tvActive && e.key === 'Backspace');
    if (isBack) { e.preventDefault(); requestClosePlayer(); return; }
    resetCtrlTimer();
    if (e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); playNext(); return; }
    if (e.shiftKey && e.key.toLowerCase() === 'p') { e.preventDefault(); playPrev(); return; }
    const inControls = e.target.closest && e.target.closest('#controlsBar');
    if (tvActive && inControls) {
        // D-pad navigation across the control buttons
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const btns = ctrlButtons();
            const i = btns.indexOf(e.target);
            const next = btns[i + (e.key === 'ArrowRight' ? 1 : -1)];
            if (next) next.focus();
            return;
        }
        if (e.key === 'ArrowUp') { e.preventDefault(); e.target.blur(); playerEl().focus({ preventScroll: true }); return; }
    }
    if (tvActive && e.key === 'ArrowDown' && !inControls && direct) {
        e.preventDefault();
        const btns = ctrlButtons();
        if (btns.length) btns[0].focus();
        return;
    }
    if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); togglePlay(); return; }
    if (e.key === 'Enter' && !e.target.closest('button, a, [role="button"]')) { e.preventDefault(); togglePlay(); return; }
    if (!direct) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); if (v.duration) { v.currentTime = Math.min(v.currentTime + 10, v.duration); flashSeek('right'); } return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(v.currentTime - 10, 0); flashSeek('left'); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); v.volume = Math.min(1, v.volume + 0.05); $('volSlider').value = v.volume; v.muted = false; updateMuteIcon(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); v.volume = Math.max(0, v.volume - 0.05); $('volSlider').value = v.volume; if (v.volume === 0) v.muted = true; updateMuteIcon(v.muted); return; }
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFS(); return; }
    if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); return; }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); toggleSubtitles(); return; }
});

function anyModalOpen() {
    return ['profileModal', 'settingsModal'].some(id => $(id).classList.contains('open')) || playerOpen();
}
function openModal(id) {
    document.body.classList.add('lock');
    $(id).classList.add('open');
    if (tvActive) {
        requestAnimationFrame(() => {
            const first = $(id).querySelector('input, button:not(.panel-close)');
            if (first) first.focus({ preventScroll: true });
        });
    }
}
function closeModal(id) {
    $(id).classList.remove('open');
    if (!anyModalOpen()) document.body.classList.remove('lock');
}
function closeTopModal() {
    if ($('settingsModal').classList.contains('open')) { closeModal('settingsModal'); return true; }
    if ($('profileModal').classList.contains('open')) { closeModal('profileModal'); return true; }
    return false;
}
document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-close]');
    if (trigger) closeModal(trigger.dataset.close);
});


function renderAvatarPreview() {
    $('avatarPreview').innerHTML = avatarInner();
}
function renderAvatarGrid() {
    $('avatarGrid').innerHTML = PROFILE_PICS.map((pic, i) => `
        <button class="avatar-cell${profile.avatar === pic.id ? ' active' : ''}" type="button" data-avatar="${pic.id}" title="${esc(pic.label)}"
            style="background:linear-gradient(135deg, hsl(${avatarHue(i)},62%,42%), hsl(${(avatarHue(i) + 40) % 360},68%,58%))">
            ${pic.url ? `<img src="${esc(pic.url)}" alt="${esc(pic.label)}" loading="lazy" draggable="false">` : `<span>${i + 1}</span>`}
        </button>`).join('');
    $$('#avatarGrid .avatar-cell').forEach(cell => cell.addEventListener('click', () => {
        profile.avatar = profile.avatar === cell.dataset.avatar ? '' : cell.dataset.avatar;
        saveProfile();
        renderAvatarGrid();
        renderAvatarPreview();
        refreshAvatarUI();
    }));
}
function renderStats() {
    const entries = parseProgEntries();
    const started = entries.length;
    const completed = entries.filter(en => isWatched(en.p)).length;
    let totalSecs = 0;
    const showCounts = {};
    entries.forEach(en => {
        totalSecs += en.p.t || 0;
        const show = getShow(en.showId);
        if (show) showCounts[show.title] = (showCounts[show.title] || 0) + 1;
    });
    const topShow = Object.entries(showCounts).sort((a, b) => b[1] - a[1])[0];
    $('statGrid').innerHTML = `
        <div class="stat-card"><div class="stat-val">${started}</div><div class="stat-label">Episodes Started</div></div>
        <div class="stat-card"><div class="stat-val">${completed}</div><div class="stat-label">Episodes Finished</div></div>
        <div class="stat-card"><div class="stat-val">${(totalSecs / 3600).toFixed(1)}h</div><div class="stat-label">Hours Streamed</div></div>
        <div class="stat-card"><div class="stat-val">${getMyList().length}</div><div class="stat-label">In My List</div></div>
        ${topShow ? `<div class="stat-card full"><div class="stat-label">Most Watched Show</div><div class="stat-show">${esc(topShow[0])}</div></div>` : ''}
    `;
}
function openProfile() {
    renderAvatarPreview();
    renderAvatarGrid();
    renderStats();
    $('profileNameInput').value = profile.name || '';
    openModal('profileModal');
}
let nameDeb = null;
$('profileNameInput').addEventListener('input', (e) => {
    profile.name = e.target.value.trim();
    clearTimeout(nameDeb);
    nameDeb = setTimeout(() => { saveProfile(); refreshAvatarUI(); renderAvatarPreview(); }, 250);
});
$('clearHistoryBtn').addEventListener('click', () => {
    if (!confirm('Clear all watch history and resume points? This cannot be undone.')) return;
    progressMap = {};
    writeJSON(PROG_KEY, progressMap);
    renderStats();
    if ($('continueSection')) renderContinueRow();
    toast('Watch history cleared');
});
$('sideProfileBtn').addEventListener('click', openProfile);
$('bnProfileBtn').addEventListener('click', openProfile);


function openSettings() {
    buildThemeSwatches();
    applyTvMode();
    setAppearance(localStorage.getItem('lsAppearance') === 'light' ? 'light' : 'dark');
    openModal('settingsModal');
}
$('sideSettingsBtn').addEventListener('click', openSettings);
$('mSettingsBtn').addEventListener('click', openSettings);
$$('#appearanceSeg .seg-btn').forEach(b => b.addEventListener('click', () => setAppearance(b.dataset.appearance)));
$$('#tvSeg .seg-btn').forEach(b => b.addEventListener('click', () => {
    localStorage.setItem('lsTvMode', b.dataset.tv);
    applyTvMode();
    toast('TV mode: ' + b.dataset.tv);
}));
$('themeResetBtn').addEventListener('click', () => {
    localStorage.removeItem('lsTheme');
    applyAccent(DEFAULT_ACCENT);
});
$('customAccentPicker').addEventListener('input', (e) => applyAccent(e.target.value));


function modalScope() {
    if ($('settingsModal').classList.contains('open')) return $('settingsModal').querySelector('.panel');
    if ($('profileModal').classList.contains('open')) return $('profileModal').querySelector('.panel');
    return null;
}
function visibleFocusables(scope) {
    return $$('a[href], button:not(:disabled), input, select, [tabindex="0"]', scope || document).filter(el => {
        if (el.classList.contains('skip-link')) return false;
        if (el.closest('.player-overlay') && !playerOpen()) return false;
        if (!scope && el.closest('.modal-overlay')) return false;
        if (el.tabIndex < 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 2 && r.height > 2;
    });
}
function spatialMove(dir) {
    const scope = modalScope();
    const els = visibleFocusables(scope);
    if (!els.length) return;
    const cur = document.activeElement;
    if (!cur || cur === document.body || !els.includes(cur)) {
        // nothing focused yet — land on page content first, not the sidebar
        const viewEls = els.filter(el => el.closest('#view'));
        const pool = viewEls.length ? viewEls : els;
        const inView = pool.find(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight * 0.9; }) || pool[0];
        inView.focus({ preventScroll: true });
        inView.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
        return;
    }
    const cr = cur.getBoundingClientRect();
    const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
    let best = null, bestScore = Infinity;
    els.forEach(el => {
        if (el === cur) return;
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        const dx = x - cx, dy = y - cy;
        let primary, cross;
        if (dir === 'left') { if (dx >= -6) return; primary = -dx; cross = Math.abs(dy); }
        else if (dir === 'right') { if (dx <= 6) return; primary = dx; cross = Math.abs(dy); }
        else if (dir === 'up') { if (dy >= -6) return; primary = -dy; cross = Math.abs(dx); }
        else { if (dy <= 6) return; primary = dy; cross = Math.abs(dx); }
        if (cross > primary * 2 + 220) return;
        const score = primary + cross * 2.4;
        if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) {
        best.focus({ preventScroll: true });
        best.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }
}
document.addEventListener('keydown', (e) => {
    if (playerOpen()) return;
    const isBackKey = e.keyCode === 461 || e.keyCode === 10009 || e.key === 'GoBack' || e.key === 'BrowserBack';
    const typing = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';
    if (e.key === 'Escape' || isBackKey || (tvActive && e.key === 'Backspace' && !typing)) {
        if (closeTopModal()) { e.preventDefault(); return; }
        if ((isBackKey || (tvActive && e.key === 'Backspace')) && state.route.name !== 'home') { e.preventDefault(); history.back(); }
        return;
    }
    if (!tvActive) return;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    if (typing && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return;
    e.preventDefault();
    spatialMove(e.key.replace('Arrow', '').toLowerCase());
});


initThemeUI();
refreshAvatarUI();
$('subOverlay').classList.add('lift');

Promise.all([
    fetch('data/show.json' + cacheBust).then(r => r.json()),
    fetch('data/hero.json' + cacheBust).then(r => r.json()).catch(() => ({ featured: [] })),
]).then(([showData, heroJson]) => {
    state.shows = showData.shows || [];
    state.heroData = heroJson.featured || [];
    migrateOldProgress();
    route();
}).catch(err => {
    console.error('Boot failed', err);
    $('view').innerHTML = '<div class="page"><div class="page-inner page-head-pad"><h1 class="page-title">Something went wrong</h1><p class="page-blurb">Failed to load the library. Please refresh the page.</p></div></div>';
});

})();
