
// Final script with Google search on "Learn more", suggestions, toasts, favorites toggle, WOD hero, tabs separation

/************
 * Elements *
 ************/
const query = document.querySelector('.search');
const button = document.querySelector('.btn');
const outputbox = document.getElementById('outputbox');
const audio = document.getElementById('audio');

const recentList = document.getElementById('recentList');
const favoritesList = document.getElementById('favoritesList');
const clearRecentBtn = document.getElementById('clearRecent');
const clearFavoritesBtn = document.getElementById('clearFavorites');
const exportFavoritesBtn = document.getElementById('exportFavorites');
const themeToggle = document.getElementById('themeToggle');
const toastContainer = document.getElementById('toastContainer');

// WOD hero refs
const wodCard = document.getElementById('wodCard');
const wodWordEl = document.getElementById('wodWord');
const wodIpaEl = document.getElementById('wodIpa');
const wodAudioBtn = document.getElementById('wodAudioBtn');
const wodMeaningEl = document.getElementById('wodMeaning');
const wodExampleEl = document.getElementById('wodExample');
const wodLearnBtn = document.getElementById('wodLearn');
const wodRefreshBtn = document.getElementById('wodRefresh');
const wodCollapseBtn = document.getElementById('wodCollapse');

const wordOfDayBtn = document.getElementById('wordOfDay');
const quickPills = document.getElementById('quickPills');

/************
 * Constants *
 ************/
const api = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const STORAGE_RECENT = 'dict_recent';
const STORAGE_FAVORITES = 'dict_favorites';
const STORAGE_THEME = 'dict_theme';
const STORAGE_WOD_COLLAPSED = 'dict_wod_collapsed';
const MAX_RECENT = 12;

const SEED_WORDS = [
  'serendipity','ephemeral','benevolent','quintessential','eloquent','ubiquitous',
  'resilience','catalyst','empathy','paradox','solace','nuance','lucid','ambivalent',
  'cogent','fortitude','candor','pragmatic','alacrity','catharsis','ambiguous',
  'definitely','separate','receive','occurred','address','accommodate','environment',
  'government','weird','tomorrow','publicly','which'
];

const COMMON_CORRECTIONS = {
  'ambious':'ambiguous',
  'ambigous':'ambiguous',
  'recieve':'receive',
  'definately':'definitely',
  'seperate':'separate',
  'occured':'occurred',
  'adress':'address',
  'acommodate':'accommodate',
  'goverment':'government',
  'enviroment':'environment',
  'wierd':'weird',
  'tommorow':'tomorrow',
  'publically':'publicly',
  'wich':'which'
};

const saveJSON = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const loadJSON = (key, fallback = []) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const unique = arr => [...new Set(arr.filter(Boolean))];
const truncate = (str, n=180) => (str && str.length > n) ? str.slice(0, n-1) + '…' : str;
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icon = type === 'success' ? 'fa-check-circle' : type === 'warn' ? 'fa-exclamation-triangle' : type === 'danger' ? 'fa-circle-xmark' : 'fa-info-circle';
  t.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span><button class="toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
  toastContainer.appendChild(t);
  const timer = setTimeout(() => t.remove(), 3000);
  t.querySelector('.toast-close').addEventListener('click', () => { clearTimeout(timer); t.remove(); });
}

button.addEventListener('click', () => { fetchword(); });
query.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.keyCode === 13) fetchword(); });
window.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== query) { e.preventDefault(); query.focus(); } });

function displayloader() {
  const loader = document.createElement('div');
  loader.classList.add('loader');
  loader.innerHTML = `<i class="fa-solid fa-spinner icon"></i><p class="description">Loading...</p>`;
  outputbox.innerHTML = '';
  outputbox.appendChild(loader);
  return loader;
}

const getErrorMessage = (msgHTML) => `<section class="error-container card">${msgHTML}</section>`;

async function fetchSpellSuggestionsOnline(word) {
  try {
    const resp = await fetch(`https://api.datamuse.com/sug?s=${encodeURIComponent(word)}`);
    if (!resp.ok) throw new Error(resp.status);
    const json = await resp.json();
    return (json || []).map(x => x.word).slice(0, 8);
  } catch { return []; }
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  const dp = Array(bl + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= al; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= bl; j++) {
      const temp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return dp[bl];
}

function fetchSpellSuggestionsLocal(word) {
  const base = unique(SEED_WORDS.concat(loadJSON(STORAGE_RECENT, []), loadJSON(STORAGE_FAVORITES, [])));
  const withCorrections = unique(base.concat(Object.values(COMMON_CORRECTIONS)));
  const scored = withCorrections.map(w => ({ w, d: levenshtein(word, w) })).sort((a,b)=> a.d - b.d).slice(0, 8).map(x => x.w);
  const direct = COMMON_CORRECTIONS[word];
  if (direct) return unique([direct].concat(scored));
  return scored;
}

async function getSuggestions(word) {
  if (COMMON_CORRECTIONS[word]) return [COMMON_CORRECTIONS[word]];
  const online = await fetchSpellSuggestionsOnline(word);
  const local = fetchSpellSuggestionsLocal(word);
  const merged = unique([].concat(online, local));
  return merged.length ? merged : local;
}

async function fetchword() {
  const word = query.value.trim().toLowerCase();
  if (!word) { alert('Please enter a word'); return; }
  const loader = displayloader();
  try {
    const response = await fetch(`${api}${encodeURIComponent(word)}`);
    if (!response.ok) throw Error(response.status);
    const words = await response.json();
    buildEnhancedCard(words);
    const recent = loadJSON(STORAGE_RECENT, []);
    const next = [word].concat(recent.filter(w => w !== word)).slice(0, MAX_RECENT);
    saveJSON(STORAGE_RECENT, next);
    renderLists();
    query.value = '';
  } catch (err) {
    const suggestions = await getSuggestions(word);
    const suggestionsHTML = suggestions.length ? `<p class="did-you-mean">Did you mean:</p><div class="suggest-row">${suggestions.map(s => `<button class="pill suggest">${s}</button>`).join('')}</div>` : `<p class="suggestion">No close matches found. Try a different spelling.</p>`;
    outputbox.innerHTML = getErrorMessage(`${Number(err.toString().match(/\d{3}$/)) === 404 ? `<h4>Couldn't find “${word}”.</h4><i class="fa-solid fa-face-frown icon"></i><p>Please check your spelling or try the suggestions below.</p>` : `<h4>Error: ${err}</h4><p>An error occurred. Please try again.</p>`}${suggestionsHTML}`);
    [...outputbox.querySelectorAll('.suggest')].forEach(btn => { btn.addEventListener('click', () => { query.value = btn.textContent; fetchword(); }); });
  } finally { loader.remove(); }
}

function getdefinition(words) {
  return words.map((wordObj) => wordObj.meanings.map((meaning) => `<section class="card"><section class="word-audio-container"><section class="word-container"><h4 class="word">${wordObj.word}</h4><p class="part-of-speech">${meaning.partOfSpeech}</p>${wordObj.origin ? `<p class="origin">Origin: ${wordObj.origin}</p>` : ''}</section>${wordObj.phonetics.reduce((result, phonetic) => { if (phonetic.audio && phonetic.text && !result) { result = `<button class="play-audio" data-soundtrack="${phonetic.audio}" onclick="playAudio(this.dataset.soundtrack)"><i class="fa-solid fa-volume-high"></i></button>`; } return result; }, "")}</section><section class="phonetic-container">${(wordObj.phonetics || []).map((p) => p.audio && p.text ? `<button data-soundtrack="${p.audio}" class="phonetic" onclick="playAudio(this.dataset.soundtrack)">${p.text}</button>` : (p.text ? `<button class="phonetic" disabled>${p.text}</button>` : '')).join("")}</section><section class="definition-container"><ol>${meaning.definitions.map((definitionObj) => definitionObj.example ? `<li><p class="definition">${definitionObj.definition}</p><p class="example">${definitionObj.example}</p></li>` : `<li><p class="definition">${definitionObj.definition}</p></li>`).join("\n")}</ol></section></section>`).join("\n")).join("\n");
}

const playAudio = (url) => { audio.setAttribute('src', url); audio.play().then(()=>showToast('Playing audio','info')).catch(()=>{}); };

function renderList(listEl, items, type) {
  if (!listEl) return;
  listEl.innerHTML = '';
  items.forEach(word => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="list-word" title="Search ${word}">${word}</button>${type === 'favorites' ? '<button class="remove" title="Remove"><i class="fa-solid fa-xmark"></i></button>' : ''}`;
    li.querySelector('.list-word').addEventListener('click', () => { query.value = word; fetchword(); });
    if (type === 'favorites') {
      li.querySelector('.remove').addEventListener('click', () => {
        const favs = loadJSON(STORAGE_FAVORITES, []);
        saveJSON(STORAGE_FAVORITES, favs.filter(w => w !== word));
        renderLists();
        showToast(`Removed “${word}” from favorites`, 'warn');
      });
    }
    listEl.appendChild(li);
  });
}

function renderLists(){
  const recent = loadJSON(STORAGE_RECENT, []);
  const favs = loadJSON(STORAGE_FAVORITES, []);
  renderList(recentList, recent, 'recent');
  renderList(favoritesList, favs, 'favorites');
}

if (clearRecentBtn) clearRecentBtn.addEventListener('click', () => { saveJSON(STORAGE_RECENT, []); renderLists(); showToast('Recent cleared','info'); });
if (clearFavoritesBtn) clearFavoritesBtn.addEventListener('click', () => { saveJSON(STORAGE_FAVORITES, []); renderLists(); showToast('Favorites cleared','warn'); });
if (exportFavoritesBtn) exportFavoritesBtn.addEventListener('click', () => {
  const favs = loadJSON(STORAGE_FAVORITES, []);
  const blob = new Blob([JSON.stringify({ favorites: favs, exported: new Date().toISOString().slice(0,10) }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `favorites-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Favorites exported','success');
});

function buildEnhancedCard(wordsData) {
  const w0 = wordsData[0];
  const title = w0.word;
  const defsHTML = getdefinition(wordsData);
  const synonyms = []; const antonyms = []; const examples = [];
  (w0.meanings || []).forEach(m => {
    if (Array.isArray(m.synonyms)) synonyms.push(...m.synonyms);
    if (Array.isArray(m.antonyms)) antonyms.push(...m.antonyms);
    (m.definitions || []).forEach(d => { if (d.example) examples.push({ pos: m.partOfSpeech, ex: d.example }); if (Array.isArray(d.synonyms)) synonyms.push(...d.synonyms); if (Array.isArray(d.antonyms)) antonyms.push(...d.antonyms); });
  });
  const synClean = unique(synonyms).sort((a,b)=>a.localeCompare(b));
  const antClean = unique(antonyms).sort((a,b)=>a.localeCompare(b));
  const synHTML = synClean.length ? `<div class="chips">${synClean.slice(0,80).map(s => `<button class="pill">${s}</button>`).join('')}</div>` : `<p class="suggestion">No synonyms found.</p>`;
  const antHTML = antClean.length ? `<div class="chips">${antClean.slice(0,80).map(a => `<button class="pill">${a}</button>`).join('')}</div>` : `<p class="suggestion">No antonyms found.</p>`;
  const primaryPOS = (w0.meanings?.[0]?.partOfSpeech) || ''; let shortDef = ''; for (const m of (w0.meanings || [])) { for (const d of (m.definitions || [])) { if (d.definition) { shortDef = d.definition; break; } } if (shortDef) break; }
  const cleanDef = (shortDef || '').replace(/\.$/, '');
  let examplesHTML = '';
  if (examples.length) {
    examplesHTML = `<ol class="examples-list">${examples.slice(0,6).map(e => `<li><strong>${e.pos || primaryPOS}</strong> — ${e.ex}</li>`).join('')}</ol>`;
  }
  else {
    const auto = [];
    if (primaryPOS === 'noun' || !primaryPOS) { auto.push(`${cap(title)} often refers to ${cleanDef}.`); auto.push(`Finding the letter on the day of the interview was pure ${title}.`); auto.push(`Their meeting was a stroke of ${title} that sparked a lasting partnership.`); }
    else if (primaryPOS === 'verb') { auto.push(`${cap(title)} can mean to ${cleanDef}.`); auto.push(`We ${title} our schedule to make room for a new project.`); auto.push(`She decided to ${title} after reviewing the updated requirements.`); }
    else if (primaryPOS === 'adjective') { auto.push(`${cap(title)} describes something that is ${cleanDef}.`); auto.push(`His ${title} remarks clarified a complex idea.`); auto.push(`Choose a ${title} solution rather than a quick fix.`); }
    else if (primaryPOS === 'adverb') { auto.push(`${cap(title)} indicates manner: ${cleanDef}.`); auto.push(`They proceeded ${title}, ensuring every detail was checked.`); }
    else { auto.push(`${cap(title)}: ${cleanDef}.`); auto.push(`The concept of ${title} appears frequently in modern discourse.`); }
    examplesHTML = `<div class="example-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> Auto‑generated examples</div><ol class="examples-list">${auto.map(x => `<li>${x}</li>`).join('')}</ol>`;
  }
  const firstAudio = (w0.phonetics || []).find(p => p.audio)?.audio; const ipaButtons = (w0.phonetics || []).filter(p => p.text).slice(0,4);
  const card = document.createElement('section'); card.className = 'card';
  card.innerHTML = `<div class="word-bar"><div class="word-title"><h4 class="word">${title}</h4>${w0.origin ? `<p class="origin">Origin: ${w0.origin}</p>` : ''}</div><div class="action-row">${firstAudio ? `<button class="play-audio" title="Play pronunciation"><i class="fa-solid fa-volume-high"></i></button>` : ''}<button class="icon-small fav" id="favBtn" title="Add to favorites" aria-pressed="false"><i class="fa-solid fa-bookmark"></i></button><button class="icon-small share" id="shareBtn" title="Share"><i class="fa-solid fa-share-nodes"></i></button><button class="icon-small copy" id="copyBtn" title="Copy"><i class="fa-solid fa-copy"></i></button></div></div><section class="phonetic-container">${ipaButtons.map(p => (p.audio && p.text) ? `<button class="phonetic" data-soundtrack="${p.audio}" onclick="playAudio(this.dataset.soundtrack)">${p.text}</button>` : `<button class="phonetic" disabled>${p.text}</button>`).join('')}</section><div class="tabs"><button class="tab active" data-tab="defs">Definitions</button><button class="tab" data-tab="syn">Synonyms</button><button class="tab" data-tab="ant">Antonyms</button><button class="tab" data-tab="ex">Examples</button></div><div class="tab-panel" data-panel="defs">${defsHTML}</div><div class="tab-panel" data-panel="syn" hidden>${synHTML}</div><div class="tab-panel" data-panel="ant" hidden>${antHTML}</div><div class="tab-panel" data-panel="ex" hidden>${examplesHTML}</div>`;
  outputbox.innerHTML = ''; outputbox.appendChild(card);
  const favBtn = card.querySelector('#favBtn'); const favs = loadJSON(STORAGE_FAVORITES, []); const isFav = favs.includes(title); if (isFav) { favBtn.classList.add('active'); favBtn.setAttribute('aria-pressed', 'true'); favBtn.title = 'Remove from favorites'; }
  if (firstAudio) { card.querySelector('.play-audio').addEventListener('click', () => playAudio(firstAudio)); }
  [...card.querySelectorAll('.tab')].forEach(tab => { tab.addEventListener('click', () => { card.querySelectorAll('.tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); const key = tab.dataset.tab; card.querySelectorAll('.tab-panel').forEach(p => { p.hidden = (p.dataset.panel !== key); }); }); });
  favBtn.addEventListener('click', () => {
    let favs = loadJSON(STORAGE_FAVORITES, []);
    const nowFav = favBtn.classList.toggle('active');
    favBtn.setAttribute('aria-pressed', String(nowFav));
    if (nowFav) {
      if (!favs.includes(title)) favs.push(title);
      favBtn.title = 'Remove from favorites';
      showToast(`Added “${title}” to favorites`, 'success');
    } else {
      favs = favs.filter(w => w !== title);
      favBtn.title = 'Add to favorites';
      showToast(`Removed “${title}” from favorites`, 'warn');
    }
    saveJSON(STORAGE_FAVORITES, favs);
    renderLists();
  });
  card.querySelector('#shareBtn').addEventListener('click', async () => {
    const text = `${title}\n${card.querySelector('[data-panel="defs"]').innerText}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Dictionary: ${title}`, text }); showToast('Shared', 'success'); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard', 'success');
    }
  });
  card.querySelector('#copyBtn').addEventListener('click', async () => {
    const text = `${title}\n${card.querySelector('[data-panel="defs"]').innerText}`;
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  });
  [...card.querySelectorAll('[data-panel="syn"] .pill')].forEach(btn => { btn.addEventListener('click', () => { query.value = btn.textContent; fetchword(); }); });
  [...card.querySelectorAll('[data-panel="ant"] .pill')].forEach(btn => { btn.addEventListener('click', () => { query.value = btn.textContent; fetchword(); }); });
}

(function initTheme(){
  const saved = localStorage.getItem(STORAGE_THEME) || 'dark';
  document.documentElement.classList.toggle('light', saved === 'light');
  if (themeToggle) themeToggle.innerHTML = `<i class="fa-solid ${saved === 'light' ? 'fa-sun' : 'fa-moon'}"></i>`;
})();
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem(STORAGE_THEME, isLight ? 'light' : 'dark');
    themeToggle.innerHTML = `<i class="fa-solid ${isLight ? 'fa-sun' : 'fa-moon'}"></i>`;
    showToast(isLight ? 'Light theme' : 'Dark theme', 'info');
  });
}

(function initWODMini(){
  if (!wordOfDayBtn || !quickPills) return;
  const idx = (new Date().getUTCDate() + new Date().getUTCMonth()) % SEED_WORDS.length;
  const wod = SEED_WORDS[idx];
  wordOfDayBtn.textContent = `Word of the day: ${wod}`;
  wordOfDayBtn.addEventListener('click', () => { query.value = wod; fetchword(); });
  quickPills.innerHTML = SEED_WORDS.slice(0,6).map(w => `<button class="pill">${w}</button>`).join('');
  [...quickPills.querySelectorAll('.pill')].forEach(btn => btn.addEventListener('click', () => { query.value = btn.textContent; fetchword(); }));
})();

function wodIndex(seed=SEED_WORDS) { const d = new Date(); return (d.getUTCDate() + d.getUTCMonth()) % seed.length; }
async function fetchWODData(word) {
  try {
    const resp = await fetch(`${api}${encodeURIComponent(word)}`);
    if (!resp.ok) throw new Error(resp.status);
    const json = await resp.json();
    const w0 = json[0] || {};
    const firstIpa = (w0.phonetics || []).find(p => p.text)?.text || '';
    const firstAudio = (w0.phonetics || []).find(p => p.audio)?.audio || '';
    let shortDef = ''; let example = '';
    (w0.meanings || []).forEach(m => {
      (m.definitions || []).forEach(d => {
        if (!shortDef && d.definition) shortDef = d.definition;
        if (!example && d.example) example = d.example;
      });
    });
    return { word: w0.word || word, ipa: firstIpa, audio: firstAudio, def: shortDef, example };
  } catch { return { word, ipa: '', audio: '', def: 'Explore the meaning by clicking Learn more.', example: '' }; }
}
async function renderWOD(word) {
  const data = await fetchWODData(word);
  if (wodWordEl) wodWordEl.textContent = data.word || word;
  if (wodIpaEl) { wodIpaEl.textContent = data.ipa || '/'; wodIpaEl.disabled = !data.ipa; }
  if (wodAudioBtn) { wodAudioBtn.disabled = !data.audio; wodAudioBtn.onclick = () => { if (data.audio) playAudio(data.audio); }; }
  if (wodMeaningEl) wodMeaningEl.textContent = truncate(data.def || 'No definition available.');
  if (wodExampleEl) wodExampleEl.textContent = data.example ? `Example: ${data.example}` : '';
  if (wodLearnBtn) {
    wodLearnBtn.onclick = () => {
      const q = encodeURIComponent(data.word || word);
      window.open(`https://www.google.com/search?q=${q}`, '_blank', 'noopener,noreferrer');
    };
  }
  if (wordOfDayBtn) wordOfDayBtn.textContent = `Word of the day: ${data.word}`;
}
function setWODCollapsed(collapsed) {
  if (!wodCard) return;
  wodCard.classList.toggle('wod-collapsed', collapsed);
  localStorage.setItem(STORAGE_WOD_COLLAPSED, collapsed ? '1' : '0');
}
(function initWODHero(){
  if (!wodCard) return;
  const idx = wodIndex();
  let currentWord = SEED_WORDS[idx];
  const collapsed = localStorage.getItem(STORAGE_WOD_COLLAPSED) === '1';
  setWODCollapsed(collapsed);
  renderWOD(currentWord);
  if (wodRefreshBtn) wodRefreshBtn.addEventListener('click', async () => {
    const i = (SEED_WORDS.indexOf(currentWord) + 1) % SEED_WORDS.length;
    currentWord = SEED_WORDS[i];
    await renderWOD(currentWord);
  });
  if (wodCollapseBtn) wodCollapseBtn.addEventListener('click', () => {
    const nowCollapsed = !wodCard.classList.contains('wod-collapsed');
    setWODCollapsed(nowCollapsed);
    wodCollapseBtn.innerHTML = `<i class="fa-solid ${nowCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}"></i>`;
  });
})();

renderLists();
``
