const LUMEN = 'https://lumen-engine.onrender.com';
const FORMSPREE = 'https://formspree.io/f/xnjkozow';

// ── TYPEWRITER ──
const typed = document.getElementById('typed');
let ci = 0;
const word = 'Lumen_Engine';
function type() {
  typed.textContent = word.slice(0, ++ci);
  if (ci < word.length) setTimeout(type, 75);
  else typed.classList.add('done');
}
setTimeout(type, 700);

// ── NAV ──
window.addEventListener('scroll', () => document.getElementById('nav').classList.toggle('s', scrollY > 36));
function toggleMenu() { document.getElementById('mmenu').classList.toggle('open'); }
function closeMenu() { document.getElementById('mmenu').classList.remove('open'); }

// ── REVEAL ──
document.querySelectorAll('.rv').forEach(el => new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('vis')), {threshold:0.08}).observe(el));

// ── PIPELINE STEPS ──
document.querySelectorAll('.ps').forEach(el => new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) setTimeout(() => e.target.classList.add('vis'), +e.target.dataset.d);
}), {threshold:0.1}).observe(el));

// ── FLOW LINE ──
new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('vis')), {threshold:0.4})
  .observe(document.getElementById('fl'));

// ── RATE LIMIT TRACKING (client-side, resets via localStorage) ──
const RL_KEY = 'lumen_demo_rl';
const RL_MAX = 10;
const RL_WINDOW = 5 * 60 * 60 * 1000; // 5 hours ms

function getRLState() {
  try {
    const s = JSON.parse(localStorage.getItem(RL_KEY) || '{}');
    if (!s.reset || Date.now() > s.reset) return { count: 0, reset: Date.now() + RL_WINDOW };
    return s;
  } catch { return { count: 0, reset: Date.now() + RL_WINDOW }; }
}
function saveRLState(s) {
  try { localStorage.setItem(RL_KEY, JSON.stringify(s)); } catch {}
}
function getRemainingRequests() {
  const s = getRLState();
  return Math.max(0, RL_MAX - s.count);
}
function incrementRL() {
  const s = getRLState();
  s.count++;
  saveRLState(s);
  return s;
}
function isRateLimited() { return getRemainingRequests() === 0; }
function updateCounter() {
  const rem = getRemainingRequests();
  const el = document.getElementById('req-counter');
  if (el) el.textContent = rem < RL_MAX ? `${rem} demo requests remaining · resets in 5h` : '';
}
updateCounter();

// ── RATE LIMIT WALL ──
let timerInterval = null;
function showRLWall() {
  document.getElementById('rlwall').classList.add('show');
  document.getElementById('rp').style.display = 'none';
  document.getElementById('dz').style.opacity = '0.4';
  document.getElementById('dz').style.pointerEvents = 'none';
  startTimer();
}
function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    const s = getRLState();
    const ms = Math.max(0, s.reset - Date.now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    document.getElementById('rltimer').textContent =
      `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if (ms === 0) { clearInterval(timerInterval); location.reload(); }
  }, 1000);
}
if (isRateLimited()) showRLWall();

// ── DRAG & DROP ──
function dzev(type, e) {
  e.preventDefault();
  const z = document.getElementById('dz');
  if (type === 'over') z.classList.add('over');
  else if (type === 'leave') z.classList.remove('over');
  else if (type === 'drop') { z.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) run(f); }
}
function onpick(e) { const f = e.target.files[0]; if (f) run(f); e.target.value = ''; }

// ── PIPELINE ANIMATION (proportional to actual elapsed time) ──
const pids = ['p1','p2','p3','p4','p5'];
function resetProg() { pids.forEach(id => { const el=document.getElementById(id); el.classList.remove('act','done'); }); }
function animProg(startTime, totalMs) {
  resetProg();
  const weights = [0.05, 0.30, 0.35, 0.20, 0.10]; // proportion of total time each stage takes
  let acc = 0;
  weights.forEach((w, i) => {
    acc += w;
    const delay = acc * totalMs;
    setTimeout(() => {
      if (i > 0) { document.getElementById(pids[i-1]).classList.remove('act'); document.getElementById(pids[i-1]).classList.add('done'); }
      if (i < pids.length) document.getElementById(pids[i]).classList.add('act');
    }, delay);
  });
}
function finishProg() {
  pids.forEach(id => { const el=document.getElementById(id); el.classList.remove('act'); el.classList.add('done'); });
}

// ── PROCESS ──
async function run(file) {
  if (isRateLimited()) { showRLWall(); return; }
  if (file.size > 10 * 1024 * 1024) {
    document.getElementById('rp').innerHTML = `<div class="errbox">File is too large. Maximum size is 10MB. Please compress the image before uploading.</div>`;
    return;
  }

  const rp = document.getElementById('rp');
  const sizeMB = (file.size/1048576).toFixed(2);
  const isImg = file.type.startsWith('image/');
  const thumbSrc = isImg ? URL.createObjectURL(file) : null;

  rp.innerHTML = `<div class="lrow"><div class="spinner"></div><span>Running pipeline — this may take up to 30s if the server just woke up...</span></div>`;

  const est = 2000; // estimated time for animation
  animProg(Date.now(), est);

  const fd = new FormData();
  fd.append('image', file);
  const t0 = Date.now();

  try {
    const r = await fetch(LUMEN + '/demo/process', {
      method: 'POST',
      body: fd,
      signal: AbortSignal.timeout(90000)
    });

    const elapsed = Date.now() - t0;

    if (r.status === 429) {
      const d = await r.json();
      resetProg();
      incrementRL(); // sync client state
      showRLWall();
      return;
    }

    const d = await r.json();
    incrementRL();
    updateCounter();
    if (isRateLimited()) {
      finishProg();
      render(d, file, elapsed, thumbSrc, sizeMB);
      setTimeout(() => showRLWall(), 3000); // show results briefly then show wall
      return;
    }
    finishProg();
    render(d, file, elapsed, thumbSrc, sizeMB);
  } catch(e) {
    resetProg();
    rp.innerHTML = `<div class="errbox">
      <strong>Connection failed.</strong><br><br>
      ${e.name === 'TimeoutError'
        ? 'The server took too long to respond. This usually means it was sleeping and is now waking up — try again in 30 seconds.'
        : `Error: ${e.message}`}
    </div>`;
  }
}

// ── RENDER RESULTS ──
function pct(v) { return Math.round((v||0)*100); }
function bbar(v) { return `<div class="bw"><div class="bf" data-t="${pct(v)}%"></div></div>`; }
function fv(v, cls='') {
  if (v===null||v===undefined||v==='') return `<div class="fval nil">—</div>`;
  return `<div class="fval ${cls}">${v}</div>`;
}

function render(d, file, elapsed, thumbSrc, sizeMB) {
  const rp = document.getElementById('rp');
  const conf = d.confidence||'rejected';
  const ms = d.processing_time_ms||elapsed;

  // document/page icon as inline SVG instead of an emoji fallback
  const fbar = `<div class="file-bar">
    ${thumbSrc?`<img class="file-thumb" src="${thumbSrc}" alt="Receipt thumbnail"/>`:`<div class="file-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>`}
    <div><div class="fname">${file.name}</div><div class="fsize">${sizeMB} MB · ${file.type||'unknown'}</div></div>
  </div>`;

  if (!d.success) {
    const diag = d.diagnostics?Object.entries(d.diagnostics).map(([k,v])=>`${k}: ${v}`).join(' · '):'';
    rp.innerHTML = `${fbar}<span class="cbadge cr">✗ ${conf}</span>
      <div class="errbox" style="margin-top:10px">${d.message||'Processing failed.'}${diag?`<br><br><span style="font-size:11px;font-family:var(--mono)">${diag}</span>`:''}</div>
      <div class="ptime" style="margin-top:10px">${ms}ms</div>`;
    return;
  }

  const ex = d.extracted;
  const amt = ex.amount.value!==null?`${ex.amount.currency_detected||''} ${ex.amount.value}`.trim():null;
  const tags = (d.needs_review||[]).length>0
    ? `<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">${d.needs_review.map(f=>`<span style="font-family:var(--mono);font-size:10px;color:var(--warn);background:#1a1305;border:0.5px solid #5a420a;border-radius:100px;padding:2px 8px;text-transform:uppercase">review ${f}</span>`).join('')}</div>`
    : `<div style="font-family:var(--mono);font-size:11px;color:var(--gd);margin-bottom:10px">✓ all fields extracted</div>`;

  rp.innerHTML = `${fbar}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <span class="cbadge c${conf.charAt(0)}">${conf==='high'?'✓':'⚠'} ${conf} confidence</span>
      <span class="ptime" style="margin:0">${ms}ms</span>
    </div>
    ${tags}
    <div class="fgrid">
      <div class="fb"><div class="flabel">Amount</div>${fv(amt,amt?'amt':'')}${bbar(ex.amount.confidence)}<div class="fmeta">${pct(ex.amount.confidence)}% confidence${ex.amount.currency_detected?' · '+ex.amount.currency_detected:''}</div></div>
      <div class="fb"><div class="flabel">Date</div>${fv(ex.date.value)}${bbar(ex.date.confidence)}<div class="fmeta">${ex.date.format_detected||pct(ex.date.confidence)+'% confidence'}</div></div>
      <div class="fb"><div class="flabel">Merchant</div>${fv(ex.description.suggested)}${bbar(ex.description.confidence)}<div class="fmeta">${pct(ex.description.confidence)}% confidence</div></div>
      <div class="fb"><div class="flabel">Category</div>${fv(ex.category.suggested_type)}${bbar(ex.category.confidence)}<div class="fmeta">${(ex.category.signals_used||[]).join(' · ')||pct(ex.category.confidence)+'% confidence'}</div></div>
    </div>
    <button class="jtog" onclick="jtoggle(this)">▸ raw JSON</button>
    <div class="jblock">${JSON.stringify(d,null,2)}</div>`;

  setTimeout(() => document.querySelectorAll('.bf').forEach(b => { b.style.width = b.dataset.t; }), 80);
}

function jtoggle(btn) {
  const b = btn.nextElementSibling;
  const o = b.style.display==='block';
  b.style.display = o?'none':'block';
  btn.textContent = o?'▸ raw JSON':'▾ raw JSON';
}

// ── CONFIDENCE SWITCHER ──
const swStates = [
  {
    label: 'high confidence',
    labelClass: 'color:var(--green);background:var(--gbg);border:0.5px solid var(--gd)',
    ms: '312ms',
    claim: 'A well-lit, straight-on photo of a printed receipt. All five pipeline stages complete successfully. Four fields extracted with high confidence.',
    meta: 'Processing time: 312ms · OCR confidence: 0.91 · Stages: all passed',
    amount: 'USD 47.83', abar: '94%', ameta: '94% confidence',
    date: '2025-06-14', dbar: '91%', dmeta: '91% confidence',
    merchant: 'City Supermarket', mbar: '86%', mmeta: '86% confidence',
    category: 'groceries', cbar: '91%', cmeta: '91% · merchant_match',
    amtClass: 'sw-fval g', dateClass: 'sw-fval', mClass: 'sw-fval', catClass: 'sw-fval',
  },
  {
    label: 'rejected',
    labelClass: 'color:var(--danger);background:#1a0808;border:0.5px solid #5a1a1a',
    ms: '145ms',
    claim: 'A photo taken at an angle in poor lighting. OCR confidence fell below the 60% threshold. Rather than guess, Lumen returns null for every uncertain field.',
    meta: 'Processing time: 145ms · OCR confidence: 0.41 · Stage 3 quality gate: failed',
    amount: '—', abar: '0%', ameta: '0% — not extracted',
    date: '—', dbar: '0%', dmeta: '0% — not extracted',
    merchant: '—', mbar: '0%', mmeta: '0% — not extracted',
    category: 'uncategorized', cbar: '0%', cmeta: '0% — no signals',
    amtClass: 'sw-fval nil', dateClass: 'sw-fval nil', mClass: 'sw-fval nil', catClass: 'sw-fval nil',
  }
];
let swActive = 0;
function swTab(i) {
  swActive = i;
  document.querySelectorAll('.sw-tab').forEach((t,j) => t.classList.toggle('active', i===j));
  const s = swStates[i];
  document.getElementById('sw-badge').textContent = s.label;
  document.getElementById('sw-badge').style.cssText = `font-family:var(--mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;padding:3px 10px;border-radius:100px;${s.labelClass}`;
  document.getElementById('sw-ms').textContent = s.ms;
  document.getElementById('sw-claim').textContent = s.claim;
  document.getElementById('sw-meta').textContent = s.meta;
  document.getElementById('sw-amount').textContent = s.amount;
  document.getElementById('sw-amount').className = s.amtClass;
  document.getElementById('sw-abar').style.width = '0%';
  document.getElementById('sw-ameta').textContent = s.ameta;
  document.getElementById('sw-date').textContent = s.date;
  document.getElementById('sw-date').className = s.dateClass;
  document.getElementById('sw-dbar').style.width = '0%';
  document.getElementById('sw-dmeta').textContent = s.dmeta;
  document.getElementById('sw-merchant').textContent = s.merchant;
  document.getElementById('sw-merchant').className = s.mClass;
  document.getElementById('sw-mbar').style.width = '0%';
  document.getElementById('sw-mmeta').textContent = s.mmeta;
  document.getElementById('sw-cat').textContent = s.category;
  document.getElementById('sw-cat').className = s.catClass;
  document.getElementById('sw-cbar').style.width = '0%';
  document.getElementById('sw-cmeta').textContent = s.cmeta;
  const barColor = i === 0 ? 'var(--gd)' : 'var(--danger)';
  setTimeout(() => {
    document.getElementById('sw-abar').style.cssText = `width:${s.abar};background:${barColor};transition:width 0.6s ease`;
    document.getElementById('sw-dbar').style.cssText = `width:${s.dbar};background:${barColor};transition:width 0.6s ease`;
    document.getElementById('sw-mbar').style.cssText = `width:${s.mbar};background:${barColor};transition:width 0.6s ease`;
    document.getElementById('sw-cbar').style.cssText = `width:${s.cbar};background:${barColor};transition:width 0.6s ease`;
  }, 60);
}

// ── ACCESS FORM ──
async function submitAccess(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.form-submit');
  btn.textContent = 'Sending...'; btn.disabled = true;
  const body = {
    name: document.getElementById('f-name').value,
    email: document.getElementById('f-email').value,
    what: document.getElementById('f-what').value,
    link: document.getElementById('f-link').value,
    volume: document.getElementById('f-vol').value,
    country: document.getElementById('f-country').value,
  };
  try {
    const r = await fetch(FORMSPREE, {
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify(body)
    });
    if (r.ok) {
      document.getElementById('aform').style.display = 'none';
      document.getElementById('fsuccess').style.display = 'block';
    } else {
      btn.textContent = 'Send access request →'; btn.disabled = false;
      alert('Something went wrong. Please try again.');
    }
  } catch {
    btn.textContent = 'Send access request →'; btn.disabled = false;
    alert('Could not send. Check your connection and try again.');
  }
}
