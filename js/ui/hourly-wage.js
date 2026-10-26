import { calcWageConvert, MODES } from '../lib/wage-convert.js';
import { RATES } from '../rates/2026.js';
import { bindCalculator, won, num, kpi, basisBlock } from './common.js';

const won2 = (n) => `${(Number(n) || 0).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원`;

function render(r) {
  const head = r.mode === 'hourly' ? ['월급 (세전)', won(r.monthly)] : ['시간급 환산', won2(r.hourly)];
  let html = `<h2>계산 결과</h2><p>${MODES[r.mode]} ${won(r.amount)} →  ${head[0]}</p><p class="big">${head[1]}</p>
  <div class="kpis">
    ${kpi('시급', won2(r.hourly))}
    ${kpi('월급', won(r.monthly))}
    ${kpi('연봉 (월급 × 12)', won(r.annual))}
    ${kpi('월 기준시간', `${num(r.hours, 2)}시간`)}
  </div>`;
  const minLabel = `${r.year}년 최저임금${r.probation ? ' (수습 90%)' : ''} ${won2(r.minHourly)}`;
  if (r.belowMin) {
    html += `<div class="note">환산 시급 ${won2(r.hourly)}이 ${minLabel}보다 낮습니다 — 최저임금 위반 소지. 같은 시간 기준 최저 월급은 ${won(r.minMonthly)}이고 월 약 ${won(r.shortMonthly)} 부족합니다. 최저임금에 못 미치는 임금 약정은 그 부분이 무효입니다 (최저임금법 제6조③). 입력한 금액이 최저임금 산입 임금(매월 정기 지급분, 연장·휴일·야간 가산수당 제외)인지 확인하세요.</div>`;
  } else {
    html += `<p class="ok">${minLabel} 이상입니다 (최저임금보다 ${num(r.marginPct * 100, 2)}% 높음). 같은 시간 기준 최저 월급 ${won(r.minMonthly)}.</p>`;
  }
  html += basisBlock('계산 근거 펼치기', [
    `주휴시간 = ${r.weeklyHours >= 15 ? `${num(r.weeklyHours, 2)} ÷ 40 × 8 = ${num(r.holidayHours, 4)}시간` : '주 15시간 미만이라 0시간 (근로기준법 제18조③)'}`,
    `월 기준시간 = (${num(r.weeklyHours, 2)} + ${num(r.holidayHours, 4)}) × 365 ÷ 7 ÷ 12 = ${num(r.exactHours, 4)}시간 → ${r.customHours ? `직접 입력한 ${num(r.hours, 2)}시간 사용` : `반올림 ${num(r.hours)}시간`} (최저임금법 시행령 제5조①3호)`,
    r.mode === 'hourly' ? `월급 = ${won(r.amount)} × ${num(r.hours, 2)}시간 = ${won(r.monthly)} (원 미만 반올림)`
      : r.mode === 'monthly' ? `시간급 = ${won(r.monthly)} ÷ ${num(r.hours, 2)}시간 = ${won2(r.hourly)}`
        : `월급 = 연봉 ${won(r.annual)} ÷ 12 = ${won(r.monthly)}, 시간급 = 연봉 ÷ 12 ÷ ${num(r.hours, 2)}시간 = ${won2(r.hourly)}`,
    `최저임금: ${r.year === 2027 ? '고용노동부고시 제2026-60호' : '고용노동부고시 제2025-47호'} 시간급 ${won(RATES.minWage[`y${r.year}`].value.hourly)}${r.probation ? ' × 90% (수습, 시행령 제3조)' : ''}`,
  ], true);
  html += '<p class="small muted">세전 금액입니다. 4대보험·소득세를 뺀 실수령액은 연봉 실수령액 계산기에서 확인하세요.</p>';
  return html;
}

bindCalculator({
  defaults: { mode: 'hourly', amount: String(RATES.minWage.y2026.value.hourly), weeklyHours: '40', year: '2026', probation: false },
  validUntil: '2027-12-31',
  compute: (v) => calcWageConvert(v),
  render,
});
