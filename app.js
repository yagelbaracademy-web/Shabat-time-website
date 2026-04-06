'use strict';

// ─── Cities configuration ────────────────────────────────────
const CITIES = [
  { name: 'ירושלים',      api: 'Jerusalem'     },
  { name: 'תל אביב–יפו',  api: 'Tel Aviv'      },
  { name: 'חיפה',         api: 'Haifa'         },
  { name: 'באר שבע',      api: 'Beer Sheva'    },
  { name: 'אילת',         api: 'Eilat'         },
  { name: 'נתניה',        api: 'Netanya'       },
  { name: 'אשדוד',        api: 'Ashdod'        },
  { name: 'ראשון לציון',  api: 'Rishon LeZion' },
];

// ─── SVG icons for theme toggle ─────────────────────────────
const SUN_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
  <line x1="10" y1="1.5" x2="10" y2="4"   stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="10" y1="16"  x2="10" y2="18.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="1.5" y1="10" x2="4"   y2="10"  stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="16"  y1="10" x2="18.5" y2="10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="3.7" y1="3.7" x2="5.5" y2="5.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="14.5" y1="14.5" x2="16.3" y2="16.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="3.7" y1="16.3" x2="5.5" y2="14.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <line x1="14.5" y1="5.5" x2="16.3" y2="3.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

const MOON_ICON = `<svg viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
  <path d="M10 2a8 8 0 1 0 8 8A8 8 0 0 0 10 2zm0 14a6 6 0 0 1 0-12 5.5 5.5 0 0 0 0 12z"
        fill="none" stroke="currentColor" stroke-width="1.4"/>
  <path d="M10 3C6.2 4.5 4 7.5 4 10s2.2 5.5 6 7c-4.5-1-7-4-7-7s2.5-6 7-7z" fill="currentColor"/>
</svg>`;

// ─── State ───────────────────────────────────────────────────
let candleLightingDate = null;
let countdownInterval  = null;

// ─── Dark mode setup ─────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  const isDark = saved === 'dark';
  if (isDark) document.body.classList.add('dark');
  updateToggleIcon(isDark);
}

function updateToggleIcon(isDark) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = isDark
    ? `${SUN_ICON}<span>בהיר</span>`
    : `${MOON_ICON}<span>כהה</span>`;
}

function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateToggleIcon(isDark);
  });
}

// ─── Fetch Shabbat data for a single city ────────────────────
async function fetchCity(apiName) {
  const url = `https://www.hebcal.com/shabbat?cfg=json&city=${encodeURIComponent(apiName)}&m=50&b=18&lg=h`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Fetch 6-month holiday data for a single city ────────────
async function fetchHolidaysForCity(apiName) {
  const today = new Date().toISOString().split('T')[0];
  const end   = new Date(Date.now() + 183 * 86_400_000).toISOString().split('T')[0];
  const url   = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&c=on&start=${today}&end=${end}&i=on&city=${encodeURIComponent(apiName)}&lg=h`;
  const res   = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Parse Shabbat items ─────────────────────────────────────
function parseItems(items) {
  let candles  = null;
  let havdalah = null;
  const holidays = [];
  let parasha    = null;

  for (const item of (items || [])) {
    if (item.category === 'candles')  candles  = item;
    if (item.category === 'havdalah') havdalah = item;
    if (item.category === 'holiday')  holidays.push(item);
    if (item.category === 'parashat') parasha  = item;
  }
  return { candles, havdalah, holidays, parasha };
}

// ─── Parse holiday items ──────────────────────────────────────
function parseHolidayItems(items) {
  const entries = [];
  let pending   = null;

  for (const item of (items || [])) {
    if (item.category === 'candles' && item.memo) {
      if (pending) {
        entries.push({ name: pending.memo, candleDate: pending.date, havdalahDate: null, dateKey: pending.dateKey });
      }
      pending = { memo: item.memo, date: item.date, dateKey: item.date.split('T')[0] };

    } else if (item.category === 'havdalah' && item.memo) {
      if (pending) {
        entries.push({ name: pending.memo, candleDate: pending.date, havdalahDate: item.date, dateKey: pending.dateKey });
        pending = null;
      } else {
        entries.push({ name: item.memo, candleDate: null, havdalahDate: item.date, dateKey: item.date.split('T')[0] });
      }
    }
  }

  if (pending) {
    entries.push({ name: pending.memo, candleDate: pending.date, havdalahDate: null, dateKey: pending.dateKey });
  }

  return entries;
}

// ─── Build cross-city holiday map ────────────────────────────
function buildHolidayMap(allResults) {
  const map = new Map();

  allResults.forEach((result, i) => {
    if (result.status !== 'fulfilled') return;
    const city    = CITIES[i];
    const entries = parseHolidayItems(result.value.items || []);

    entries.forEach(entry => {
      if (!map.has(entry.dateKey)) {
        map.set(entry.dateKey, {
          name: entry.name,
          candleDate:   entry.candleDate,
          havdalahDate: entry.havdalahDate,
          dateKey:      entry.dateKey,
          cities:       new Map(),
        });
      }
      map.get(entry.dateKey).cities.set(city.name, {
        candle:   entry.candleDate,
        havdalah: entry.havdalahDate,
      });
    });
  });

  return [...map.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

// ─── Format ISO string → HH:MM ───────────────────────────────
function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jerusalem', hour12: false,
  });
}

// ─── Format date → Hebrew calendar ───────────────────────────
function toHebrewDate(isoString, full = false) {
  if (!isoString) return '';
  try {
    const opts = full
      ? { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' }
      : { month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' };
    return new Date(isoString).toLocaleDateString('he-IL-u-ca-hebrew', opts);
  } catch { return ''; }
}

// ─── Format date → Gregorian (Hebrew locale) ─────────────────
function toGregDate(isoString, full = false) {
  if (!isoString) return '';
  const opts = full
    ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' }
    : { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' };
  return new Date(isoString).toLocaleDateString('he-IL', opts);
}

// ─── Render a Shabbat city card ───────────────────────────────
function renderCard(city, parsed, index) {
  const { candles, havdalah, holidays } = parsed;
  const candleTime   = formatTime(candles?.date);
  const havdalahTime = formatTime(havdalah?.date);
  const hasHoliday   = holidays.length > 0;
  const holidayNames = holidays.map(h => h.hebrew || h.title).join(' · ');

  // Gregorian date of Shabbat candle lighting
  const shabbatDate = candles?.date
    ? toGregDate(candles.date)
    : '';

  const card = document.createElement('div');
  card.className = 'city-card';
  card.style.animationDelay = `${index * 0.06}s`;

  card.innerHTML = `
    <div class="card-header">
      <div class="city-name">${city.name}</div>
      ${hasHoliday ? `<span class="holiday-badge">שבת + חג</span>` : ''}
    </div>
    <div class="card-times">
      <div class="time-row">
        <div class="time-label">הדלקת נרות</div>
        <span class="time-value candles-value">${candleTime}</span>
      </div>
      <div class="time-row">
        <div class="time-label">הבדלה</div>
        <span class="time-value havdalah-value">${havdalahTime}</span>
      </div>
    </div>
    ${hasHoliday ? `<div class="card-holiday-name">${holidayNames}</div>` : ''}
    ${shabbatDate ? `<div class="card-shabbat-date">${shabbatDate}</div>` : ''}
  `;

  return card;
}

// ─── Render a holiday event card ─────────────────────────────
function renderHolidayCard(hol, index) {
  const card = document.createElement('div');
  card.className = 'holiday-event-card';
  card.style.animationDelay = `${index * 0.08}s`;

  const refDate  = hol.candleDate || hol.havdalahDate;
  const hebDate  = toHebrewDate(refDate);
  const gregDate = toGregDate(refDate);

  const cityRows = CITIES.map(city => {
    const times    = hol.cities.get(city.name);
    const candle   = times?.candle   ? formatTime(times.candle)   : '—';
    const havdalah = times?.havdalah ? formatTime(times.havdalah) : '—';
    const cClass   = candle   === '—' ? 'hol-candle-time hol-no-time'   : 'hol-candle-time';
    const hClass   = havdalah === '—' ? 'hol-havdalah-time hol-no-time' : 'hol-havdalah-time';
    return `<div class="hol-city-row">
      <span class="hol-city-name">${city.name}</span>
      <span class="${cClass}">${candle}</span>
      <span class="${hClass}">${havdalah}</span>
    </div>`;
  }).join('');

  card.innerHTML = `
    <div class="hol-card-header">
      <span class="hol-name">${hol.name}</span>
      <div class="hol-dates">
        ${hebDate  ? `<span class="hol-heb-date">${hebDate}</span>`   : ''}
        ${gregDate ? `<span class="hol-greg-date">${gregDate}</span>` : ''}
      </div>
    </div>
    <div class="hol-table-header">
      <span>עיר</span>
      <span>כניסת חג</span>
      <span>יציאת חג</span>
    </div>
    <div class="hol-city-table">${cityRows}</div>
  `;

  return card;
}

// ─── Render holidays section ──────────────────────────────────
function renderHolidays(holidays) {
  const grid = document.getElementById('holiday-cards-grid');
  grid.innerHTML = '';

  if (!holidays.length) {
    grid.innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem;grid-column:1/-1">אין חגים בששת החודשים הקרובים</p>';
    return;
  }

  holidays.forEach((hol, i) => grid.appendChild(renderHolidayCard(hol, i)));
}

// ─── Countdown ───────────────────────────────────────────────
function updateCountdown() {
  if (!candleLightingDate) return;

  const diff = candleLightingDate.getTime() - Date.now();

  const dDays    = document.getElementById('cd-days');
  const dHours   = document.getElementById('cd-hours');
  const dMinutes = document.getElementById('cd-minutes');
  const dSeconds = document.getElementById('cd-seconds');
  const label    = document.getElementById('countdown-label');

  if (diff <= 0) {
    ['00','00','00','00'].forEach((v, i) =>
      [dDays,dHours,dMinutes,dSeconds][i].textContent = v);
    label.textContent = 'שבת שלום';
    [dDays,dHours,dMinutes,dSeconds].forEach(el => {
      el.classList.add('shabbat-in');
      el.classList.remove('urgent');
    });
    return;
  }

  const totalSec = Math.floor(diff / 1000);
  dDays.textContent    = String(Math.floor(totalSec / 86400)).padStart(2, '0');
  dHours.textContent   = String(Math.floor(totalSec / 3600) % 24).padStart(2, '0');
  dMinutes.textContent = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
  dSeconds.textContent = String(totalSec % 60).padStart(2, '0');

  const urgent = diff < 3_600_000;
  [dDays,dHours,dMinutes,dSeconds].forEach(el => {
    el.classList.toggle('urgent', urgent);
    el.classList.remove('shabbat-in');
  });

  label.textContent = urgent ? 'כניסת שבת בקרוב' : 'זמן לכניסת שבת';
}

// ─── Header: Hebrew + Gregorian date ─────────────────────────
function setDates(data) {
  if (!data?.date) return;
  const todayIso = new Date().toISOString();
  const hebEl  = document.getElementById('hebrew-date');
  const gregEl = document.getElementById('greg-date');

  const hebFull  = toHebrewDate(todayIso, true);
  const gregFull = toGregDate(todayIso, true);

  if (hebFull)  hebEl.textContent  = hebFull;
  if (gregFull) gregEl.textContent = gregFull;
}

// ─── Header: parasha ──────────────────────────────────────────
function setParasha(parsed) {
  const el = document.getElementById('parasha');
  if (parsed.parasha) {
    el.textContent = `פרשת ${parsed.parasha.hebrew || parsed.parasha.title}`;
  }
}

// ─── Header: holiday banner ───────────────────────────────────
function setHolidayBanner(parsed) {
  const banner = document.getElementById('holiday-banner');
  if (parsed.holidays.length > 0) {
    banner.textContent = parsed.holidays.map(h => h.hebrew || h.title).join(' · ');
    banner.classList.remove('hidden');
  }
}

// ─── Section sub: Shabbat date ────────────────────────────────
function setShabbatDateSub(candleDate) {
  const el = document.getElementById('shabbat-date-sub');
  if (!el || !candleDate) return;
  const greg = toGregDate(candleDate);
  const heb  = toHebrewDate(candleDate);
  el.textContent = `הדלקת נרות והבדלה לשבת — ${greg}${heb ? ' · ' + heb : ''}`;
}

// ─── Main loader ──────────────────────────────────────────────
async function init() {
  const grid = document.getElementById('city-grid');

  const [shabbatResults, holidayResults] = await Promise.all([
    Promise.allSettled(CITIES.map(c => fetchCity(c.api))),
    Promise.allSettled(CITIES.map(c => fetchHolidaysForCity(c.api))),
  ]);

  // ── Shabbat cards ──
  grid.innerHTML = '';

  let jerusalemData   = null;
  let jerusalemParsed = null;

  shabbatResults.forEach((result, i) => {
    const city = CITIES[i];
    let parsed = { candles: null, havdalah: null, holidays: [], parasha: null };

    if (result.status === 'fulfilled') {
      parsed = parseItems(result.value.items);
      if (city.api === 'Jerusalem') {
        jerusalemData   = result.value;
        jerusalemParsed = parsed;
      }
    }

    grid.appendChild(renderCard(city, parsed, i));
  });

  // ── Header updates ──
  if (jerusalemData)   setDates(jerusalemData);
  if (jerusalemParsed) {
    setParasha(jerusalemParsed);
    setHolidayBanner(jerusalemParsed);

    if (jerusalemParsed.candles) {
      candleLightingDate = new Date(jerusalemParsed.candles.date);
      document.getElementById('ref-city-time').textContent =
        `הדלקת נרות בירושלים: ${formatTime(jerusalemParsed.candles.date)}`;
      setShabbatDateSub(jerusalemParsed.candles.date);
    }
  }

  // ── Countdown ──
  updateCountdown();
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdown, 1000);

  // ── Holiday cards ──
  renderHolidays(buildHolidayMap(holidayResults));

  // ── Footer ──
  document.getElementById('footer-update').textContent =
    `עודכן: ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;
}

// ─── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupThemeToggle();
  init();
});
