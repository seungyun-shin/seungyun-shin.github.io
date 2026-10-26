import { calcAnnualLeave } from '../lib/annual-leave.js';
import { bindCalculator, won, num, esc, kpi, basisBlock, todayStr } from './common.js';

function eventsTable(events, title) {
  if (!events.length) return `<p class="muted">${esc(title)}: 아직 발생한 연차가 없습니다.</p>`;
  const rows = events.map((e) => `<tr><td>${e.date}</td><td>${esc(e.label)}${e.warn ? ' <span class="badge badge-warn">확인 필요</span>' : ''}</td><td class="num">${num(e.days, 2)}일</td><td class="small muted">${esc(e.basis)}</td></tr>`).join('');
  const total = events.reduce((s, e) => s + e.days, 0);
  return `<h3>${esc(title)}</h3><div class="table-scroll"><table><thead><tr><th>발생일</th><th>사유</th><th class="num">일수</th><th>근거</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="2">누적 합계</td><td class="num">${num(total, 2)}일</td><td></td></tr></tfoot></table></div>`;
}

function render(r, v) {
  const fiscal = r.basis === 'fiscal';
  const retire = v.status === 'retire';
  const primaryTotal = fiscal ? r.fiscalTotal : r.hireTotal;
  let html = `<h2>계산 결과</h2>`;
  if (r.latestAnnual && !retire) {
    html += `<p>가장 최근 발생한 연 단위 연차</p><p class="big">${num(r.latestAnnual.days, 2)}일 <small>${r.latestAnnual.date} 발생</small></p>`;
  } else {
    html += `<p>${retire ? '재직 기간 동안 발생한 연차 합계' : '지금까지 발생한 연차 합계'} (${fiscal ? '회계연도' : '입사일'} 기준)</p><p class="big">${num(primaryTotal, 2)}일</p>`;
  }
  html += `<div class="kpis">
    ${kpi('재직 일수', `${num(r.serviceDays)}일`)}
    ${kpi('1년 미만 월차', `${r.monthlyCount}일 <small class="muted small">(최대 11일)</small>`)}
    ${kpi('입사일 기준 누적', `${num(r.hireTotal, 2)}일`)}
    ${kpi('회계연도 기준 누적', `${num(r.fiscalTotal, 2)}일`)}
  </div>`;
  if (r.monthlyCount > 0 && r.monthlyCount < 11 && !retire) {
    html += `<p class="small muted">입사 1년 미만 기간에 생긴 월 단위 연차는 입사일로부터 1년(${r.monthlyUseDeadline}까지) 안에 사용해야 합니다(제60조⑦ 단서).</p>`;
  }
  if (retire && fiscal) {
    html += r.settlementDays > 0
      ? `<div class="note">회계연도 기준 누적(${num(r.fiscalTotal, 2)}일)이 입사일 기준 누적(${num(r.hireTotal, 2)}일)보다 <strong>${num(r.settlementDays, 2)}일 적습니다.</strong> 고용노동부 지침에 따라 퇴직 시 부족분은 연차수당으로 정산해야 합니다.</div>`
      : `<p class="ok">회계연도 기준 누적이 입사일 기준 이상이므로 추가 정산 대상이 아닙니다. (초과분을 근로자에게 불리하게 차감하는지는 취업규칙·단체협약에 따릅니다.)</p>`;
  }
  if (r.dailyWage > 0) {
    html += `<h3>연차수당 추정</h3><div class="kpis">
      ${kpi('1일 통상임금', won(r.dailyWage))}
      ${kpi(`미사용 ${num(r.unusedDays, 2)}일 수당`, won(r.allowanceUnused))}
      ${retire && fiscal ? kpi(`정산 부족분 ${num(r.settlementDays, 2)}일`, won(r.allowanceSettlement)) : ''}
      ${kpi('수당 합계(세전)', `<strong>${won(r.allowanceTotal)}</strong>`)}
    </div>`;
  }
  html += basisBlock('계산 근거 펼치기', [
    `입사일 ${r.hireDate}, ${retire ? `마지막 근무일 ${r.endDate} (퇴직일 ${r.retirementDate})` : `기준일 ${r.endDate}`}`,
    '연차는 발생일 당일에 근로관계가 있어야 생깁니다. 1년을 채우고 바로 다음 날 퇴직하면 15일은 발생하지 않습니다 (대법원 2021다227100, 고용노동부 2021.12.16. 행정해석).',
    '1년 미만(또는 1년간 출근율 80% 미만): 1개월 개근 시 1일 (근로기준법 제60조②), 최대 11일',
    '1년간 80% 이상 출근: 15일 (제60조①), 3년 이상 근속 시 최초 1년을 초과하는 매 2년마다 1일 가산, 최대 25일 (제60조④)',
    '회계연도 기준: 입사연도 재직일수에 비례한 연차를 다음 회계연도 첫날 부여하고, 이후 회계연도마다 근속연수에 따른 일수를 부여. 퇴직 시 입사일 기준보다 적으면 차이를 정산',
    r.dailyWage > 0 ? `1일 통상임금 = 월 통상임금 ${won(v.monthlyOrdinaryWage)} ÷ ${num(v.monthlyHours || 209)}시간 × ${num(v.dailyHours || 8)}시간 = ${won(r.dailyWage)} (원 미만은 수당에서 절사)` : '월 통상임금을 입력하면 연차수당을 계산합니다.',
  ]);
  html += `<details class="basis"><summary>발생 내역 전체 보기</summary>${eventsTable(r.hireEvents, '입사일 기준')}${eventsTable(r.fiscalEvents, '회계연도 기준')}</details>`;
  return html;
}

bindCalculator({
  defaults: () => ({ hireDate: '2024-03-04', endDate: todayStr(), status: 'employed', basis: 'hire', fyStartMonth: '1', monthlyHours: '209', dailyHours: '8' }),
  compute: (v) => calcAnnualLeave(v),
  render,
  onChange: (form) => {
    const retire = form.querySelector('[name=status]:checked')?.value === 'retire';
    const lbl = document.getElementById('endDate-label');
    if (lbl) lbl.textContent = retire ? '마지막 근무일' : '계산 기준일';
    const fiscal = form.querySelector('[name=basis]:checked')?.value === 'fiscal';
    document.getElementById('fy-wrap').hidden = !fiscal;
  },
});
