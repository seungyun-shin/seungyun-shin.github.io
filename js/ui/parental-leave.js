import { calcParentalLeave } from '../lib/parental-leave.js';
import { bindCalculator, won, esc, kpi, basisBlock } from './common.js';

function table(title, plan) {
  const rows = plan.rows.map((r) => `<tr><td>${r.month}개월차</td><td>${esc(r.rule)}</td><td class="num">${won(r.cap)}</td><td class="num">${won(r.amount)}</td></tr>`).join('');
  return `<h3>${esc(title)}</h3><div class="table-scroll"><table><thead><tr><th>기간</th><th>적용 기준</th><th class="num">상한</th><th class="num">월 급여</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3">합계</td><td class="num">${won(plan.total)}</td></tr></tfoot></table></div>`;
}

function render(r) {
  let html = `<h2>계산 결과</h2><p>${r.b ? '부모 합산 ' : ''}육아휴직급여 총액</p><p class="big">${won(r.total)}</p>`;
  html += `<div class="kpis">${kpi(r.b ? '본인' : '총액', won(r.a.total))}${r.b ? kpi('배우자', won(r.b.total)) : ''}${kpi('본인 첫 달', won(r.a.rows[0]?.amount))}${kpi('본인 사용 기간', `${r.a.rows.length}개월`)}</div>`;
  r.warnings.forEach((w) => { html += `<div class="note">${esc(w)}</div>`; });
  html += table(r.b ? '본인 월별 급여' : '월별 급여', r.a);
  if (r.b) html += table('배우자 월별 급여', r.b);
  html += basisBlock('계산 근거 펼치기', [
    '일반: 1~3개월 통상임금 100%(상한 250만원), 4~6개월 100%(상한 200만원), 7개월부터 80%(상한 160만원), 하한 70만원 (고용보험법 시행령 제95조①)',
    r.mode === 'sixsix' ? `6+6 특례: 부모가 모두 쓴 개월 수(최대 6개월, 이번 계산 ${r.a.overlap}개월)까지 통상임금 100%, 상한 250·250·300·350·400·450만원` : '6+6 특례: 생후 18개월 이내 자녀를 둔 부모가 모두 육아휴직을 쓰면 첫 6개월 상한이 올라갑니다',
    r.mode === 'single' ? '한부모 특례: 1~3개월 통상임금 100%, 상한 300만원' : '한부모 근로자는 1~3개월 상한이 300만원입니다',
    '2025년부터 사후지급금(25%)이 없어져 휴직 기간 중 매달 전액을 받습니다.',
    '한 달을 다 채우지 못한 달은 일수에 비례해 지급하므로 실제 금액이 다를 수 있습니다.',
  ]);
  if (r.mode === 'sixsix') html += '<p class="small muted">먼저 육아휴직을 쓴 부모는 처음에는 일반 기준으로 받고, 배우자가 육아휴직을 시작한 뒤 신청하면 특례와의 차액을 소급해 받습니다.</p>';
  return html;
}

bindCalculator({
  defaults: { mode: 'general', wageA: '3000000', monthsA: '12', wageB: '3000000', monthsB: '6' },
  compute: (v) => calcParentalLeave(v),
  render,
  onChange: (form) => {
    const six = form.querySelector('[name=mode]:checked')?.value === 'sixsix';
    document.getElementById('spouse-wrap').hidden = !six;
  },
});
