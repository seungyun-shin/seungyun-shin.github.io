// UI 공통 도우미 (브라우저 전용)

export const won = (n) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`;
export const num = (n, d = 0) => (Number(n) || 0).toLocaleString('ko-KR', { maximumFractionDigits: d });
export const pct = (r, d = 3) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function parseMoney(v) {
  const s = String(v ?? '').replace(/[^\d.-]/g, '');
  if (s === '' || s === '-') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(input) {
  const raw = String(input.value).replace(/[^\d]/g, '');
  input.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
}

export function todayStr() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 폼 값을 객체로 (data-money 필드는 숫자로) */
export function readForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; continue; }
    if (el.type === 'checkbox') { out[el.name] = el.checked; continue; }
    out[el.name] = el.dataset.money !== undefined ? parseMoney(el.value) : el.value;
  }
  return out;
}

function writeForm(form, values) {
  for (const el of form.elements) {
    if (!el.name || !(el.name in values)) continue;
    const v = values[el.name];
    if (el.type === 'radio') el.checked = String(v) === el.value;
    else if (el.type === 'checkbox') el.checked = v === true || v === '1' || v === 'true';
    else {
      el.value = v;
      if (el.dataset.money !== undefined) formatMoneyInput(el);
    }
  }
}

function toQuery(values) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) {
    if (v === '' || v == null) continue;
    q.set(k, v === true ? '1' : v === false ? '0' : String(v));
  }
  return q.toString();
}

/**
 * 계산기 바인딩.
 * @param {object} o
 * @param {(v:object)=>any} o.compute 순수 계산
 * @param {(r:any, v:object)=>string} o.render 결과 HTML
 * @param {object} [o.defaults] 초기값 (함수 가능)
 * @param {(form:HTMLFormElement)=>void} [o.onChange] 입력 변경 시 UI 토글 등
 * @param {string} [o.validUntil] 이 계산기의 기준이 유효한 마지막 날 (기본 RATES_VALID_UNTIL)
 */
export function bindCalculator(o) {
  const form = document.getElementById('calc-form');
  const result = document.getElementById('result');
  const defaults = typeof o.defaults === 'function' ? o.defaults() : (o.defaults || {});

  form.querySelectorAll('[data-money]').forEach((el) => {
    el.setAttribute('inputmode', 'numeric');
    el.addEventListener('input', () => formatMoneyInput(el));
  });

  const params = Object.fromEntries(new URLSearchParams(location.search));
  writeForm(form, { ...defaults, ...params });
  if (o.onChange) { o.onChange(form); form.addEventListener('change', () => o.onChange(form)); }

  const run = (scroll) => {
    const v = readForm(form);
    try {
      const r = o.compute(v);
      result.innerHTML = staleNote(o.validUntil) + o.render(r, v) + shareBlock();
      result.hidden = false;
      history.replaceState(null, '', `${location.pathname}?${toQuery(readRawForm(form))}`);
      const btn = result.querySelector('[data-copy]');
      if (btn) btn.addEventListener('click', () => {
        navigator.clipboard?.writeText(location.href).then(() => { btn.textContent = '링크 복사됨'; }, () => {});
      });
      if (scroll) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      result.innerHTML = `<p class="error">${esc(e.message || e)}</p>`;
      result.hidden = false;
    }
  };

  form.addEventListener('submit', (e) => { e.preventDefault(); run(true); });
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    form.reset();
    writeForm(form, defaults);
    if (o.onChange) o.onChange(form);
    result.hidden = true;
    history.replaceState(null, '', location.pathname);
  });
  if (Object.keys(params).length) run(false);
}

function readRawForm(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; continue; }
    if (el.type === 'checkbox') { out[el.name] = el.checked; continue; }
    out[el.name] = el.dataset.money !== undefined ? String(parseMoney(el.value) || '') : el.value;
  }
  return out;
}

// 요율 파일이 다루는 기간(2026년)이 지나면 경고
const RATES_VALID_UNTIL = '2026-12-31';
function staleNote(validUntil = RATES_VALID_UNTIL) {
  return todayStr() > validUntil
    ? `<div class="note">이 계산기는 2026년 요율·기준을 반영합니다. 오늘(${todayStr()}) 적용되는 새 요율은 아직 반영되지 않았을 수 있으니 확인 필요.</div>`
    : '';
}

function shareBlock() {
  return '<p class="small muted" style="margin-top:12px">입력값은 이 기기 브라우저 주소에만 담기며 서버로 전송되지 않습니다. <button type="button" class="btn btn-ghost" data-copy style="padding:4px 10px;min-height:0;font-size:13px">결과 링크 복사</button></p>';
}

export function kpi(k, v) {
  return `<div class="kpi"><div class="k">${esc(k)}</div><div class="v">${v}</div></div>`;
}

/** 근거(산식) 목록 */
export function basisBlock(title, items, open = false) {
  return `<details class="basis"${open ? ' open' : ''}><summary>${esc(title)}</summary><ol>${items.map((i) => `<li>${i}</li>`).join('')}</ol></details>`;
}

export function confBadge(c) {
  return `<span class="conf conf-${esc(c)}">${esc(c)}</span>`;
}
