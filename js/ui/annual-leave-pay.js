import { calcAnnualLeavePay } from '../lib/annual-leave-pay.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const won2 = (n) => `${(Number(n) || 0).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원`;

function render(r) {
  let html = `<h2>계산 결과</h2><p>${r.exempt ? '지급 의무 없음 (사용촉진으로 소멸)' : r.situation === 'retire' ? '퇴사 시 받을 연차수당 (세전)' : '사용 기간 만료로 받을 연차수당 (세전)'}</p><p class="big">${won(r.payable)}</p>
  <div class="kpis">
    ${kpi('1일 통상임금', won2(r.daily))}
    ${kpi('미사용 연차', `${num(r.unusedDays, 1)}일`)}
    ${r.mode === 'firstYear' ? kpi('발생 (월 1일)', `${num(r.accrued)}일 <small class="muted small">사용 ${num(r.usedDays, 1)}일</small>`) : ''}
    ${r.exempt ? kpi('촉진 없었다면', won(r.allowance)) : ''}
  </div>`;
  for (const w of r.warnings) html += `<div class="note">${esc(w)}</div>`;
  const steps = [];
  if (r.type === 'monthly') steps.push(`1일 통상임금 = 월 통상임금 ${won(r.monthlyWage)} ÷ ${num(r.monthlyHours, 2)}시간 × ${num(r.dailyHours, 2)}시간 = ${won2(r.daily)}`);
  else if (r.type === 'hourly') steps.push(`1일 통상임금 = 시급 ${won(r.hourlyWage)} × ${num(r.dailyHours, 2)}시간 = ${won2(r.daily)}`);
  else steps.push(`1일 통상임금 ${won2(r.daily)} (입력값)`);
  if (r.mode === 'firstYear') steps.push(`입사 1년 미만: 개근한 달마다 1일 → ${num(r.accrued)}일 발생 − 사용 ${num(r.usedDays, 1)}일 = 미사용 ${num(r.unusedDays, 1)}일 (근로기준법 제60조②)`);
  steps.push(`연차수당 = ${num(r.unusedDays, 1)}일 × ${won2(r.daily)} = ${won(r.allowance)} (원 미만 절사, 제60조⑤)`);
  if (r.exempt) steps.push(`사용촉진(제61조${r.mode === 'firstYear' ? '②' : '①'})을 거쳐 사용 기간 만료로 소멸 → 보상 의무 없음 → 0원`);
  if (r.situation === 'retire') steps.push(`퇴직일부터 ${r.deadlineDays}일 안에 지급 (제36조, 합의로 연장 가능)`);
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">연차가 언제 며칠 생겼는지, 회계연도 기준 퇴사 정산 일수는 <a href="/annual-leave/">연차 계산기</a>로 확인하세요. 연차수당은 퇴직 전 1년 동안 받은 금액의 3/12이 퇴직금 평균임금에 들어갑니다(<a href="/severance-pay/">퇴직금 계산기</a>).</p>';
  return html;
}

bindCalculator({
  defaults: { wageType: 'monthly', monthlyWage: '3000000', monthlyHours: '209', dailyHours: '8', mode: 'days', unusedDays: '5', monthsWorked: '6', usedDays: '0', situation: 'retire', promoted: false },
  compute: (v) => calcAnnualLeavePay(v),
  render,
  onChange: (form) => {
    const t = form.querySelector('[name=wageType]:checked')?.value || 'monthly';
    document.getElementById('monthly-wrap').hidden = t !== 'monthly';
    document.getElementById('hourly-wrap').hidden = t !== 'hourly';
    document.getElementById('daily-wrap').hidden = t !== 'daily';
    const first = form.querySelector('[name=mode]:checked')?.value === 'firstYear';
    document.getElementById('days-wrap').hidden = first;
    document.getElementById('first-wrap').hidden = !first;
  },
});
