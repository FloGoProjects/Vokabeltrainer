// UI: Ansichten Lernen / Runde / Belohnungen / Einstellungen. Logik liegt in den getesteten Modulen.
import { checkAnswer } from './answer.js';
import { validateDeck } from './deck.js';
import { filterCards, buildSession, countByStatus, countStruggling, shuffleRandom } from './session.js';
import { DAILY_GOAL } from './gold.js';
import {
  loadState, saveState, createState, recordAnswer, redeem, validateImport, todayNumber,
} from './store.js';

const THEMES = [
  { id: 'heft', name: 'Heft', text: 'Wie dein Schulheft' },
  { id: 'modern', name: 'Hypermodern', text: 'Dunkel, Neon, Glas' },
  { id: 'pixel', name: 'Pixel', text: 'Blöcke wie in Minecraft' },
];

const view = document.getElementById('view');
let state = loadState();
let bookDecks = [];
let screen = 'home';
let round = null;

// ---------- Hilfen ----------

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const deckKey = (d) => `${d.lang}-${d.unit}`;

function commit(next) {
  state = next;
  if (!saveState(state)) alert('Speichern fehlgeschlagen – bitte Stand exportieren!');
  renderHeader();
}

function allDecks() {
  const byKey = new Map(bookDecks.map((d) => [deckKey(d), d]));
  for (const d of state.decks) byKey.set(deckKey(d), d);
  return [...byKey.values()].sort((a, b) => a.unit - b.unit);
}

function selection() {
  const decks = allDecks();
  const sel = state.settings.selection ?? {};
  const deck = decks.find((d) => deckKey(d) === sel.deck) ?? decks[0];
  if (!deck) return { deck: null };
  const sections = sel.deck === deckKey(deck) && sel.sections?.length ? sel.sections : Object.keys(deck.sections);
  return { deck, sections, pageFrom: sel.pageFrom ?? null, pageTo: sel.pageTo ?? null };
}

const everyCard = () => allDecks().flatMap((d) => d.cards);

function selectedCards() {
  const { deck, sections, pageFrom, pageTo } = selection();
  return deck ? filterCards(deck.cards, { sections, pageFrom, pageTo }) : [];
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('vokabel-gold:' + text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function askPin({ title = 'Eltern-PIN', text = 'Bitte PIN eingeben.' } = {}) {
  const dialog = document.getElementById('pin-dialog');
  const input = document.getElementById('pin-input');
  document.getElementById('pin-title').textContent = title;
  document.getElementById('pin-text').textContent = text;
  document.getElementById('pin-error').textContent = '';
  input.value = '';
  return new Promise((resolve) => {
    dialog.onclose = () => resolve(dialog.returnValue === 'ok' ? input.value : null);
    dialog.showModal();
    input.focus();
  });
}

async function requireParent(reason) {
  if (!state.pinHash) {
    const pin = await askPin({ title: 'Eltern-PIN festlegen', text: 'Noch keine PIN vergeben. Neue PIN (mind. 4 Ziffern):' });
    if (!pin) return false;
    if (pin.length < 4) { alert('Die PIN braucht mindestens 4 Zeichen.'); return false; }
    commit({ ...state, pinHash: await sha256(pin) });
    return true;
  }
  const pin = await askPin({ text: reason });
  if (pin == null) return false;
  if ((await sha256(pin)) !== state.pinHash) { alert('Falsche PIN.'); return false; }
  return true;
}

// ---------- Kopfzeile & Navigation ----------

function renderHeader() {
  document.documentElement.dataset.theme = state.settings.theme;
  document.getElementById('gold').innerHTML = `<span class="coin" aria-hidden="true"></span><b>${state.gold}</b>`;
  const today = todayNumber();
  const alive = state.streak.lastDay != null && state.streak.lastDay >= today - 1;
  document.getElementById('streak').textContent = alive && state.streak.count ? `🔥 ${state.streak.count}` : '';
  for (const b of document.querySelectorAll('[data-nav]')) b.classList.toggle('active', b.dataset.nav === screen);
  document.getElementById('tabs').hidden = screen === 'quiz';
}

function go(next) {
  screen = next;
  renderHeader();
  ({ home: renderHome, quiz: renderQuiz, summary: renderSummary, rewards: renderRewards, settings: renderSettings })[screen]();
  window.scrollTo(0, 0);
}

// ---------- Lernen ----------

function renderHome() {
  const decks = allDecks();
  const sel = selection();
  if (!sel.deck) {
    view.innerHTML = `<section class="panel"><h2>Noch keine Vokabeln</h2>
      <p>Importiere eine Vokabeldatei unter <b>Einstellungen</b>.</p></section>`;
    return;
  }
  const today = todayNumber();
  const cards = selectedCards();
  const counts = countByStatus(cards, state.cards, today);
  const daily = state.daily.day === today ? state.daily.correct : 0;
  const sessionSize = buildSession(cards, state.cards, today, { allCards: everyCard(), shuffle: (x) => x }).length;
  const inRange = new Set(cards.map((c) => c.id));
  const extraStruggling = countStruggling(everyCard().filter((c) => !inRange.has(c.id)), state.cards, today);

  view.innerHTML = `
    <section class="panel daily">
      <div class="daily-text">Tagesziel: <b>${Math.min(daily, DAILY_GOAL)} / ${DAILY_GOAL}</b> richtig ${daily >= DAILY_GOAL ? '✔' : ''}</div>
      <div class="bar"><span style="width:${Math.min(100, (daily / DAILY_GOAL) * 100)}%"></span></div>
    </section>

    <section class="panel">
      <h2>Was willst du lernen?</h2>
      ${decks.length > 1 ? `<div class="chips">${decks.map((d) => `
        <button class="chip ${deckKey(d) === deckKey(sel.deck) ? 'on' : ''}" data-deck="${esc(deckKey(d))}">Unit ${d.unit}</button>`).join('')}</div>` : ''}
      <p class="deck-title">Unit ${sel.deck.unit}: ${esc(sel.deck.title)}</p>
      <div class="chips">${Object.entries(sel.deck.sections).map(([key, label]) => `
        <button class="chip ${sel.sections.includes(key) ? 'on' : ''}" data-section="${esc(key)}">${esc(label)}</button>`).join('')}</div>
      <details class="pages" ${sel.pageFrom != null || sel.pageTo != null ? 'open' : ''}>
        <summary>Nur bestimmte Buchseiten</summary>
        <label>von S. <input type="number" inputmode="numeric" id="page-from" value="${sel.pageFrom ?? ''}"></label>
        <label>bis S. <input type="number" inputmode="numeric" id="page-to" value="${sel.pageTo ?? ''}"></label>
      </details>
      <div class="counts">
        <span><b>${cards.length}</b> Wörter</span>
        <span><b>${counts.new}</b> neu</span>
        <span><b>${counts.due}</b> fällig</span>
        <span><b>${counts.learning}</b> im Kasten</span>
        <span><b>${counts.mastered}</b> gemeistert</span>
      </div>
      ${extraStruggling ? `<p class="small struggling-hint">🔁 ${extraStruggling} Fehlwort${extraStruggling > 1 ? 'e' : ''} aus anderen Abschnitten ${extraStruggling > 1 ? 'kommen' : 'kommt'} mit, bis sie sitzen.</p>` : ''}
      <button class="primary big" data-action="start" ${sessionSize ? '' : 'disabled'}>
        ${sessionSize ? `Runde starten (${sessionSize} Karten)` : 'Heute nichts fällig – super!'}
      </button>
    </section>`;

  view.querySelectorAll('[data-deck]').forEach((b) => b.onclick = () => updateSelection({ deck: b.dataset.deck, sections: null }));
  view.querySelectorAll('[data-section]').forEach((b) => b.onclick = () => {
    const key = b.dataset.section;
    let sections = sel.sections.includes(key) ? sel.sections.filter((s) => s !== key) : [...sel.sections, key];
    if (!sections.length) sections = [key];
    sections = Object.keys(sel.deck.sections).filter((s) => sections.includes(s));
    updateSelection({ deck: deckKey(sel.deck), sections });
  });
  for (const id of ['page-from', 'page-to']) {
    view.querySelector('#' + id).onchange = () => {
      const num = (v) => (v === '' ? null : Number(v));
      updateSelection({ deck: deckKey(sel.deck), sections: sel.sections,
        pageFrom: num(view.querySelector('#page-from').value), pageTo: num(view.querySelector('#page-to').value) });
    };
  }
  view.querySelector('[data-action="start"]').onclick = startRound;
}

function updateSelection(patch) {
  const prev = state.settings.selection ?? {};
  const next = { ...prev, ...patch };
  if (patch.deck !== prev.deck) { next.pageFrom ??= null; next.pageTo ??= null; }
  commit({ ...state, settings: { ...state.settings, selection: next } });
  renderHome();
}

// ---------- Runde ----------

function startRound() {
  const today = todayNumber();
  const allCards = everyCard();
  const cards = buildSession(selectedCards(), state.cards, today, { allCards });
  if (!cards.length) return;
  round = { queue: cards, index: 0, practice: [], inPractice: false, feedback: null,
    stats: { correct: 0, total: cards.length, gold: 0, bonus: 0 }, allCards };
  go('quiz');
}

function renderQuiz() {
  const card = round.queue[round.index];
  const fb = round.feedback;
  const pos = round.index + 1;
  view.innerHTML = `
    <section class="panel quiz">
      <div class="quiz-top">
        <button class="secondary small" data-action="quit">✕ Beenden</button>
        <span class="muted">${round.inPractice ? `Übung – noch ${round.queue.length - round.index}` : `Karte ${pos} / ${round.queue.length}`}</span>
      </div>
      <div class="bar"><span style="width:${(round.index / round.queue.length) * 100}%"></span></div>
      ${round.inPractice ? '<p class="small practice-hint">Übung: Diese Karte kommt wieder, bis du sie richtig tippst.</p>' : ''}
      <p class="prompt-label">Auf Englisch:${!round.inPractice && state.cards[card.id]?.struggling ? ' <span class="badge">🔁 Fehlwort</span>' : ''}</p>
      <p class="prompt">${esc(card.de)}</p>
      <p class="muted small">${card.p != null ? `S. ${card.p}` : '&nbsp;'}${card.unsure ? ' · ⚠ bitte im Buch prüfen' : ''}</p>
      <form id="answer-form" autocomplete="off">
        <input id="answer" type="text" lang="en" autocomplete="off" autocorrect="off" autocapitalize="none"
          spellcheck="false" enterkeyhint="go" placeholder="Englisches Wort …" ${fb ? 'readonly' : ''} value="${esc(fb?.given ?? '')}">
        ${fb ? '' : '<button class="primary big" type="submit">Prüfen</button>'}
      </form>
      ${fb ? feedbackHtml(card, fb) : ''}
    </section>`;

  const input = view.querySelector('#answer');
  view.querySelector('[data-action="quit"]').onclick = () => { if (confirm('Runde beenden?')) go('summary'); };
  if (!fb) {
    input.focus();
    view.querySelector('#answer-form').onsubmit = (e) => { e.preventDefault(); submitAnswer(input.value); };
  } else {
    const next = view.querySelector('[data-action="next"]');
    next.onclick = nextCard;
    next.focus();
  }
}

const FEEDBACK = {
  correct: { cls: 'ok', title: 'Richtig!' },
  almost: { cls: 'almost', title: 'Fast! Ein Buchstabe stimmt nicht.' },
  other: { cls: 'other', title: 'Auch richtig – aber gesucht war ein anderes Wort.' },
  wrong: { cls: 'bad', title: 'Leider falsch.' },
};

function feedbackHtml(card, fb) {
  const f = FEEDBACK[fb.result];
  const earned = fb.gold + fb.bonus;
  return `
    <div class="feedback ${f.cls}">
      <p class="fb-title">${f.title}</p>
      ${fb.result === 'other' ? `<p>„${esc(fb.matched)}“ passt auch, gesucht war:</p>` : ''}
      ${fb.result === 'almost' ? `<p class="small">Du: ${esc(fb.given)}</p>` : ''}
      <p class="solution">${esc(card.en)}</p>
      ${card.forms ? `<p class="small">Formen: ${esc(card.forms)}</p>` : ''}
      ${card.note ? `<p class="small">💡 ${esc(card.note)}</p>` : ''}
      ${earned ? `<p class="gold-pop">+${earned} <span class="coin"></span>${fb.bonus ? ` <span class="small">(Tagesziel-Bonus +${fb.bonus})</span>` : ''}</p>` : ''}
    </div>
    <button class="primary big" data-action="next">Weiter</button>`;
}

function submitAnswer(given) {
  if (!given.trim()) return;
  const card = round.queue[round.index];
  const check = checkAnswer(given, card, round.allCards);
  const missed = check.result === 'wrong' || check.result === 'almost';
  let gold = 0, bonus = 0;
  if (!round.inPractice) {
    const r = recordAnswer(state, card, check.result, todayNumber());
    commit(r.state);
    gold = r.gold; bonus = r.bonus;
    round.stats.gold += gold; round.stats.bonus += bonus;
    if (check.result === 'correct') round.stats.correct++;
    if (missed) round.practice.push(card);
  } else if (missed) {
    round.queue.push(card); // Übung: so lange, bis sie einmal richtig getippt wurde
  }
  round.feedback = { ...check, given, gold, bonus };
  renderQuiz();
}

function nextCard() {
  round.feedback = null;
  round.index++;
  if (round.index >= round.queue.length) {
    if (!round.inPractice && round.practice.length) {
      round.inPractice = true;
      round.queue = shuffleRandom(round.practice);
      round.index = 0;
    } else {
      go('summary');
      return;
    }
  }
  renderQuiz();
}

function renderSummary() {
  const s = round?.stats ?? { correct: 0, total: 0, gold: 0, bonus: 0 };
  view.innerHTML = `
    <section class="panel summary">
      <h2>Runde geschafft!</h2>
      <p class="big-number">${s.correct} / ${s.total} richtig</p>
      <p class="gold-pop">+${s.gold + s.bonus} <span class="coin"></span></p>
      ${s.bonus ? `<p>inklusive Tagesziel-Bonus: +${s.bonus}</p>` : ''}
      <button class="primary big" data-action="home">Zurück</button>
    </section>`;
  round = null;
  view.querySelector('[data-action="home"]').onclick = () => go('home');
}

// ---------- Belohnungen ----------

function renderRewards() {
  const rewards = state.rewards;
  view.innerHTML = `
    <section class="panel">
      <h2>Belohnungen</h2>
      ${rewards.length ? '' : '<p>Noch keine Belohnungen. Deine Eltern können welche anlegen.</p>'}
      <ul class="rewards">${rewards.map((r) => `
        <li>
          <div class="reward-name">${esc(r.name)}</div>
          <div class="bar"><span style="width:${Math.min(100, (state.gold / r.price) * 100)}%"></span></div>
          <div class="reward-row">
            <span>${r.price} <span class="coin"></span></span>
            <button class="primary" data-redeem="${esc(r.id)}" ${state.gold >= r.price ? '' : 'disabled'}>Einlösen</button>
          </div>
        </li>`).join('')}</ul>
    </section>
    <section class="panel">
      <h2>Eingelöst</h2>
      ${state.redemptions.length ? `<ul class="history">${[...state.redemptions].reverse().map((x) => `
        <li>${new Date(x.day * 86400000).toLocaleDateString('de-DE')}: ${esc(x.name)} (−${x.price})</li>`).join('')}</ul>` : '<p class="muted">Noch nichts eingelöst.</p>'}
    </section>
    <section class="panel parent">
      <h2>Elternbereich</h2>
      <form id="reward-form" class="row wrap">
        <input id="reward-name" placeholder="z. B. Minecraft-Skin" required>
        <input id="reward-price" type="number" inputmode="numeric" min="1" placeholder="Preis" required>
        <button class="secondary" type="submit">Hinzufügen</button>
      </form>
      ${rewards.length ? `<ul class="history">${rewards.map((r) => `
        <li>${esc(r.name)} – ${r.price} <button class="link" data-remove="${esc(r.id)}">entfernen</button></li>`).join('')}</ul>` : ''}
      <p class="muted small">Anlegen, Entfernen und Einlösen brauchen die Eltern-PIN.</p>
    </section>`;

  view.querySelectorAll('[data-redeem]').forEach((b) => b.onclick = async () => {
    const reward = state.rewards.find((r) => r.id === b.dataset.redeem);
    if (!(await requireParent(`„${reward.name}“ für ${reward.price} Gold einlösen?`))) return;
    const r = redeem(state, reward.id, todayNumber());
    if (!r.ok) { alert(r.error); return; }
    commit(r.state);
    renderRewards();
  });
  view.querySelector('#reward-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = view.querySelector('#reward-name').value.trim();
    const price = Number(view.querySelector('#reward-price').value);
    if (!name || !(price > 0)) return;
    if (!(await requireParent('Belohnung anlegen'))) return;
    commit({ ...state, rewards: [...state.rewards, { id: 'r' + Date.now(), name, price: Math.round(price) }] });
    renderRewards();
  };
  view.querySelectorAll('[data-remove]').forEach((b) => b.onclick = async () => {
    if (!(await requireParent('Belohnung entfernen'))) return;
    commit({ ...state, rewards: state.rewards.filter((r) => r.id !== b.dataset.remove) });
    renderRewards();
  });
}

// ---------- Einstellungen ----------

function renderSettings() {
  view.innerHTML = `
    <section class="panel">
      <h2>Aussehen</h2>
      <div class="themes">${THEMES.map((t) => `
        <button class="theme-card ${state.settings.theme === t.id ? 'on' : ''}" data-theme-pick="${t.id}">
          <span class="theme-preview" data-preview="${t.id}"><span></span><span></span><span></span></span>
          <b>${t.name}</b><span class="small">${t.text}</span>
        </button>`).join('')}</div>
    </section>
    <section class="panel">
      <h2>Sichern</h2>
      <p>Der Lernstand liegt nur auf diesem iPad. Sichere ihn regelmäßig – die Datei enthält alles: Lernstand, Gold, Belohnungen und importierte Vokabeln.</p>
      <div class="row wrap">
        <button class="primary" data-action="export">Stand exportieren</button>
        <label class="button secondary">Stand oder Vokabeln importieren
          <input type="file" id="import-file" accept=".json,application/json" hidden></label>
      </div>
      ${state.lastExport ? `<p class="muted small">Letzte Sicherung: ${new Date(state.lastExport).toLocaleString('de-DE')}</p>` : '<p class="muted small">Noch nie gesichert.</p>'}
    </section>
    <section class="panel parent">
      <h2>Elternbereich</h2>
      <div class="row wrap">
        <button class="secondary" data-action="change-pin">PIN ändern</button>
        <button class="danger" data-action="reset">Lernstand zurücksetzen</button>
      </div>
    </section>`;

  view.querySelectorAll('[data-theme-pick]').forEach((b) => b.onclick = () => {
    commit({ ...state, settings: { ...state.settings, theme: b.dataset.themePick } });
    renderSettings();
  });
  view.querySelector('[data-action="export"]').onclick = exportState;
  view.querySelector('#import-file').onchange = (e) => importFile(e.target.files[0]);
  view.querySelector('[data-action="change-pin"]').onclick = async () => {
    if (!state.pinHash) { await requireParent(); return; }
    if (!(await requireParent('Aktuelle PIN eingeben'))) return;
    const pin = await askPin({ title: 'Neue PIN', text: 'Neue PIN (mind. 4 Zeichen):' });
    if (pin && pin.length >= 4) commit({ ...state, pinHash: await sha256(pin) });
  };
  view.querySelector('[data-action="reset"]').onclick = async () => {
    if (!(await requireParent('Lernstand und Gold wirklich löschen? Belohnungen, PIN und Vokabeln bleiben.'))) return;
    if (!confirm('Sicher? Das lässt sich nur mit einer Sicherungsdatei rückgängig machen.')) return;
    const fresh = createState();
    commit({ ...fresh, rewards: state.rewards, pinHash: state.pinHash, decks: state.decks, settings: state.settings });
    renderSettings();
  };
}

async function exportState() {
  const stamped = { ...state, lastExport: new Date().toISOString() };
  const name = `vokabeltrainer-stand-${stamped.lastExport.slice(0, 10)}.json`;
  const file = new File([JSON.stringify(stamped, null, 1)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Vokabeltrainer-Stand' });
    } else {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    }
    commit(stamped);
    renderSettings();
  } catch (err) {
    if (err?.name !== 'AbortError') alert('Export fehlgeschlagen: ' + err.message);
  }
}

async function importFile(file) {
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch { alert('Die Datei ist kein gültiges JSON.'); return; }

  if (Array.isArray(data?.cards) && data.unit != null) {
    const problems = validateDeck(data);
    if (problems.length) { alert('Vokabeldatei fehlerhaft:\n' + problems.slice(0, 5).join('\n')); return; }
    const decks = state.decks.filter((d) => deckKey(d) !== deckKey(data));
    commit({ ...state, decks: [...decks, data] });
    alert(`Unit ${data.unit} mit ${data.cards.length} Vokabeln importiert.`);
    renderSettings();
    return;
  }
  const check = validateImport(data);
  if (!check.ok) { alert(check.error); return; }
  if (!(await requireParent('Gesicherten Stand einspielen? Der aktuelle Stand wird ersetzt.'))) return;
  commit({ ...createState(), ...data });
  alert('Stand wiederhergestellt.');
  renderSettings();
}

// ---------- Start ----------

async function loadBookDecks() {
  try {
    const index = await (await fetch('data/index.json', { cache: 'no-cache' })).json();
    const decks = await Promise.all(index.decks.map(async (f) => (await fetch('data/' + f, { cache: 'no-cache' })).json()));
    bookDecks = decks.filter((d) => validateDeck(d).length === 0);
  } catch {
    bookDecks = []; // keine mitgelieferten Daten – nur importierte Vokabeln
  }
}

document.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => go(b.dataset.nav));
renderHeader();
await loadBookDecks();
go('home');

if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
