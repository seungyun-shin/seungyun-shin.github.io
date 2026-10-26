import { calcHousingScore } from '../lib/housing-score.js';
import { bindCalculator, kpi, basisBlock, esc, todayStr } from './common.js';

const BYUL1 = 'https://www.law.go.kr/LSW/flDownload.do?flSeq=164950377';
const art = (n, label) => `<a href="https://www.law.go.kr/법령/주택공급에관한규칙/제${n}조" target="_blank" rel="noopener">${esc(label)}</a>`;
const byul = (label) => `<a href="${BYUL1}" target="_blank" rel="noopener">${esc(label)}</a>`;
const ym = (m) => `${Math.floor(m / 12)}년 ${m % 12}개월`;

function render(r) {
  const h = r.homeless; const d = r.dependents; const a = r.account;
  let html = `<h2>계산 결과</h2><p>청약 가점 (${r.max}점 만점)</p><p class="big">${r.total}점</p>
  <div class="kpis">
    ${kpi('무주택기간 (32)', `${h.points}점`)}
    ${kpi('부양가족 (35)', `${d.points}점`)}
    ${kpi('통장 가입기간 (17)', `${a.points}점`)}
    ${kpi('공고일', esc(r.notice))}
  </div>`;
  r.warnings.forEach((w) => { html += `<div class="note">${esc(w)}</div>`; });
  html += `<div class="table-scroll"><table><thead><tr><th>항목</th><th>산정</th><th class="num">점수</th></tr></thead><tbody>
  <tr><td class="nowrap">무주택기간</td><td>${h.ok ? `${esc(h.start)}부터 ${ym(h.months)}` : h.ownsNow ? '유주택 세대' : h.under30Single ? '만 30세 미만 미혼' : '기산일이 공고일 이후'}</td><td class="num">${h.points}</td></tr>
  <tr><td class="nowrap">부양가족</td><td>${d.count}명 (배우자 ${d.spouse}, 직계존속 ${d.ascendants}, 자녀 ${d.children + d.adultChildren})</td><td class="num">${d.points}</td></tr>
  <tr><td class="nowrap">본인 통장</td><td>${a.own ? `${ym(a.own.months)}${a.own.minor.excessDays ? ' (미성년 한도 적용)' : ''}` : '미입력'}</td><td class="num">${a.ownPoints}</td></tr>
  ${a.spouse ? `<tr><td class="nowrap">배우자 통장</td><td>${ym(a.spouse.months)} × 50%</td><td class="num">${a.spousePoints}</td></tr>` : ''}
  </tbody><tfoot><tr><td colspan="2">합계${a.capped ? ' (통장 17점 한도)' : ''}</td><td class="num">${r.total}</td></tr></tfoot></table></div>`;

  const steps = [];
  steps.push(`무주택기간 기산일: 만 30세가 되는 날 ${esc(r.age30)}${r.marriage ? `, 혼인신고일 ${esc(r.marriage)}` : ''}${r.disposal ? `, 최근 무주택자가 된 날 ${esc(r.disposal)}` : ''} → <strong>${esc(h.start)}</strong> (${esc(h.startReason)}) — ${byul('별표 1 제1호가목3)')}`);
  if (h.ok) steps.push(`${esc(h.start)} ~ ${esc(r.notice)}: ${ym(h.months)} → ${h.years}년 이상 ${h.years + 1}년 미만 = ${h.points}점 (1년 미만 2점, 1년마다 +2점, 15년 이상 32점)`);
  else if (h.ownsNow) steps.push(`공고일 현재 주택 소유 세대 → 무주택기간 0점, 1순위 가점제 대상 제외 (${art(28, '제28조⑥')}, ${art(53, '제53조')} 예외 주택은 무주택으로 봄)`);
  else if (h.under30Single) steps.push('만 30세 미만 미혼이라 무주택기간 0점 (청약홈 가점계산기 기준)');
  steps.push(`부양가족: 배우자 ${d.spouse}명 + 직계존속 ${d.ascendants}명${d.ascendantsInput !== d.ascendants ? ` (입력 ${d.ascendantsInput}명, 세대주가 아니라 제외)` : ''} + 30세 미만 미혼 자녀 ${d.children}명 + 30세 이상 미혼 자녀 ${d.adultChildren}명 = ${d.count}명 → ${d.points}점 (0명 5점, 1명마다 +5점, 6명 이상 35점) — ${byul('별표 1 제1호나목')}`);
  if (a.own) {
    const m = a.own.minor;
    if (m.minorDays) steps.push(`미성년(만 19세가 되는 ${esc(m.adult)} 전) 가입기간 ${m.minorDays}일 중 2023년 이전분 ${m.preDays}일(2년 한도) + 2024년 이후분 ${m.postDays}일 → 인정 ${m.recognizedDays}일 (5년 한도)${m.excessDays ? `, 초과 ${m.excessDays}일만큼 기산일을 ${esc(a.own.effStart)}로 미룸` : ''} — ${art(10, '제10조⑥')}`);
    steps.push(`본인 통장: ${esc(a.own.effStart)} ~ ${esc(r.notice)} ${ym(a.own.months)} → ${a.own.lawPoints}점 (6개월 미만 1점, 6개월~1년 2점, 1년 이상 3점부터 1년마다 +1점, 15년 이상 17점)`);
    if (a.own.applyhomePoints !== a.own.lawPoints) steps.push(`청약홈 가점계산기 방식(미성년·성년 구간을 각각 개월로 내림): ${ym(a.own.applyhomeMonths)} → ${a.own.applyhomePoints}점. 둘 중 낮은 ${a.ownPoints}점을 적용 (높게 적었다가 부적격이 되는 위험 방지)`);
  }
  if (a.spouse) steps.push(`배우자 통장: ${esc(a.spouse.start)}부터 ${ym(a.spouse.months)}의 50% = ${a.spouse.halfMonths}개월 → ${a.spousePoints}점 (최대 3점) — ${byul('별표 1 비고 2')}`);
  steps.push(`통장 점수 = min(17, 본인 ${a.ownPoints} + 배우자 ${a.spousePoints}) = ${a.points}점`);
  steps.push(`합계 = ${h.points} + ${d.points} + ${a.points} = <strong>${r.total}점</strong>`);
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">점수가 같으면 통장 가입기간이 긴 사람이 우선입니다(제28조⑦). 과거 2년 안에 가점제로 당첨된 사람이 속한 세대는 1순위 가점제에서 빠집니다. 특별공급(신혼부부·생애최초 등)은 별도 기준입니다.</p>';
  return html;
}

const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };

bindCalculator({
  defaults: () => ({
    noticeDate: todayStr(), birthDate: '1990-05-10', married: false, householdHead: true,
    ascendants: '0', children: '0', adultChildren: '0', accountDate: '2014-03-02',
  }),
  validUntil: '2027-06-30',
  compute: (v) => calcHousingScore(v),
  render,
  onChange: (form) => {
    const married = form.querySelector('[name=married]')?.checked;
    show('marriage-wrap', married);
    show('spouse-acct-wrap', married);
    show('disposal-wrap', form.querySelector('[name=everOwned]')?.checked);
  },
});
