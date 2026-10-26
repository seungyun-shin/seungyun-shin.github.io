import { calcSeverance } from '../lib/severance.js';
import { bindCalculator, won, num, kpi, basisBlock, todayStr } from './common.js';

const won2 = (n) => `${(Number(n) || 0).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원`;

function render(r) {
  let html = '<h2>계산 결과</h2>';
  if (!r.eligible) {
    html += `<p class="big">퇴직금 0원</p><div class="note">${r.under15h ? '4주 평균 1주 소정근로시간이 15시간 미만이면 퇴직금 지급 대상이 아닙니다 (근로자퇴직급여 보장법 제4조①).' : `계속근로기간이 1년 미만(재직 ${num(r.serviceDays)}일)이라 퇴직금 지급 대상이 아닙니다. 퇴직일이 입사 1주년 당일 이후여야 합니다.`}</div>`;
  } else {
    html += `<p>예상 퇴직금 (세전)</p><p class="big">${won(r.severance)}</p>`;
  }
  html += `<div class="kpis">
    ${kpi('재직일수', `${num(r.serviceDays)}일 <small class="muted small">(${num(r.serviceYears, 2)}년)</small>`)}
    ${kpi('1일 평균임금', won2(r.avgDaily))}
    ${kpi('1일 통상임금', r.ordinaryDaily ? won2(r.ordinaryDaily) : '미입력')}
    ${kpi('적용 일급', `${won2(r.appliedDaily)}${r.useOrdinary ? ' <small class="muted small">(통상임금)</small>' : ''}`)}
  </div>`;
  html += basisBlock('계산 근거 펼치기', [
    `입사일 ${r.hireDate}, 마지막 근무일 ${r.lastWorkDate}, 퇴직일 ${r.retireDate} → 재직일수 ${num(r.serviceDays)}일`,
    `평균임금 산정기간: ${r.periodStart} ~ ${r.periodEnd} (${r.periodDays}일, 퇴직일 이전 3개월)`,
    `3개월 임금총액 ${won(r.wages3m)} + 상여금 가산 ${won(r.bonusAdd)} (연간 상여 × 3/12) + 연차수당 가산 ${won(r.leaveAdd)} (× 3/12) = ${won(r.total)}`,
    `1일 평균임금 = ${won(r.total)} ÷ ${r.periodDays}일 = ${won2(r.avgDaily)} (전 미만 올림, 고용노동부 계산기와 같음)`,
    r.ordinaryDaily ? `1일 통상임금 = 월 통상임금 ÷ 209 × 8 = ${won2(r.ordinaryDaily)} → ${r.useOrdinary ? '평균임금보다 커서 통상임금을 적용 (근로기준법 제2조②)' : '평균임금이 더 크므로 평균임금 적용'}` : '월 통상임금을 넣으면 평균임금과 비교해 큰 금액을 적용합니다.',
    `퇴직금 = ${won2(r.appliedDaily)} × 30일 × ${num(r.serviceDays)}일 ÷ 365 = ${won(r.severance)} (원 미만 반올림, 고용노동부 계산기와 같음)`,
  ], true);
  if (r.eligible && r.severance > 0) {
    const q = new URLSearchParams({ pay: String(r.severance), mode: 'dates', hireDate: r.hireDate, retireDate: r.lastWorkDate });
    html += `<p><a class="btn btn-ghost" href="/retirement-tax/?${q}">이 퇴직금의 퇴직소득세 계산 →</a></p>`;
  }
  html += '<p class="small muted">퇴직소득세는 별도입니다. 근속연수공제·환산급여공제를 적용하므로 근로소득세보다 훨씬 낮고, IRP 계좌로 받으면 과세가 이연됩니다.</p>';
  return html;
}

bindCalculator({
  defaults: () => ({ hireDate: '2021-03-02', lastWorkDate: todayStr(), monthlyBase: '3000000', monthlyAllowance: '0' }),
  compute: (v) => calcSeverance(v),
  render,
});
