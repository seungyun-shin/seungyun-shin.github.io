import { calcWeeklyHolidayPay } from '../lib/weekly-holiday.js';
import { RATES } from '../rates/2026.js';
import { bindCalculator, won, num, kpi, basisBlock } from './common.js';

const L = (path, text) => `<a href="https://www.law.go.kr/${path}" target="_blank" rel="noopener">${text}</a>`;

function render(r) {
  let html = '<h2>계산 결과</h2>';
  if (!r.eligibleByHours) {
    html += `<p class="big">주휴수당 0원</p><div class="note">1주 소정근로시간 ${num(r.weeklyHours, 2)}시간은 15시간 미만이라 주휴수당 대상이 아닙니다 (${L('법령/근로기준법/제18조', '근로기준법 제18조③')}). 4주를 평균해 15시간 이상이면 대상입니다.</div>`;
  } else if (!r.attended) {
    html += `<p class="big">이번 주 주휴수당 0원</p><div class="note">소정근로일을 개근하지 않은 주에는 주휴수당이 생기지 않습니다 (${L('법령/근로기준법시행령/제30조', '시행령 제30조①')}). 개근했다면 ${won(Math.floor(r.dailyHours * r.hourlyWage + 1e-6))}입니다.</div>`;
  } else {
    html += `<p>한 주 주휴수당</p><p class="big">${won(r.weeklyPay)}</p>`;
  }
  html += `<div class="kpis">
    ${kpi('1일 소정근로시간 (주휴 시간)', `${num(r.dailyHours, 2)}시간`)}
    ${kpi('한 달 평균 주휴수당', won(r.monthlyPay))}
    ${kpi('그 주 근로 임금', won(r.weeklyBasePay))}
    ${kpi('주휴 포함 주급', won(r.weeklyTotal))}
  </div>`;
  if (r.belowMinWage) {
    html += `<div class="note">시급 ${won(r.hourlyWage)}이 ${r.year}년 최저임금 ${won(r.minWage)}보다 낮습니다. 최저임금에 못 미치는 임금 약정은 그 부분이 무효이고 최저임금을 지급해야 합니다 (최저임금법 제6조①③). 최저임금으로 계산한 주휴수당은 ${won(r.weeklyPayAtMinWage)}, 한 주 부족액(근로 + 주휴)은 약 ${won(r.shortfallPerWeek)}입니다.</div>`;
  } else {
    html += `<p class="ok">시급이 ${r.year}년 최저임금 ${won(r.minWage)} 이상입니다.</p>`;
  }
  html += basisBlock('계산 근거 펼치기', [
    `1주 소정근로시간 ${num(r.weeklyHours, 2)}시간 ${r.eligibleByHours ? '≥' : '<'} 15시간 (${L('법령/근로기준법/제18조', '제18조③')})`,
    `1일 소정근로시간 = 4주 소정근로시간 ÷ 4주간 통상근로자 소정근로일수 = ${num(r.weeklyHours, 2)} × 4 ÷ 20일 = ${num(r.weeklyHours, 2)} ÷ 40 × 8 = ${num(r.dailyHours, 4)}시간 (시행령 별표 2, 통상근로자 주 5일·40시간 가정)`,
    `주휴수당 = ${num(r.dailyHours, 4)}시간 × ${won(r.hourlyWage)} = ${won(r.weeklyPay)} (원 미만 버림, ${L('법령/근로기준법/제55조', '제55조①')})`,
    `한 달 평균 = 주휴수당 × 365 ÷ 7 ÷ 12 (${num(r.weeksPerMonth, 4)}주) = ${won(r.monthlyPay)}`,
    `${r.year}년 시간급 최저임금 ${won(r.minWage)} — ${r.year === 2027 ? '고용노동부고시 제2026-60호' : '고용노동부고시 제2025-47호'}`,
  ], true);
  html += '<p class="small muted">통상근로자의 근무일이 주 6일이거나, 요일마다 근무시간이 다른 경우에는 실제 결과가 다를 수 있습니다. 근로계약서의 소정근로시간과 소정근로일을 기준으로 고용노동부(1350)에 확인하세요.</p>';
  return html;
}

bindCalculator({
  defaults: { weeklyHours: '20', hourlyWage: String(RATES.minWage.y2026.value.hourly), year: '2026', attended: true },
  validUntil: '2027-12-31',
  compute: (v) => calcWeeklyHolidayPay(v),
  render,
});
