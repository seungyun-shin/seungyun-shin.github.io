import { calcMaternityLeave } from '../lib/maternity-leave.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const won2 = (n) => `${(Number(n) || 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원`;
const L = (path, label) => `<a href="https://www.law.go.kr/${path}" target="_blank" rel="noopener">${esc(label)}</a>`;
const GOSHI = L('행정규칙/출산전후휴가급여등상한액고시', '고시 제2026-67호');
const TYPE = { single: '한 명', premature: '미숙아', multiple: '다태아' };

function renderMaternity(r) {
  let html = `<h2>계산 결과</h2><p>출산전후휴가 ${r.days}일 동안 받는 돈 (고용보험 + 회사)</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi('고용보험 급여', won(r.insured))}
    ${kpi('회사 지급', won(r.employerTotal))}
    ${kpi('휴가 기간', `${esc(r.start)} ~ ${esc(r.end)}`)}
    ${kpi('평소 임금 대비', r.fullWage ? `${num((r.total / r.fullWage) * 100, 1)}%` : '-')}
  </div>`;
  r.warnings.forEach((w) => { html += `<div class="note">${esc(w)}</div>`; });
  const empLabel = r.company === 'priority' ? `1~${r.employerDays}일 차액` : `1~${r.employerDays}일 통상임금 100%`;
  html += `<div class="table-scroll"><table><thead><tr><th>구간</th><th>지급 주체</th><th class="num">금액</th></tr></thead><tbody>
  <tr><td>${r.firstInsured}~${r.lastInsured}일 (${r.insuredDays}일)</td><td>고용보험</td><td class="num">${won(r.insured)}</td></tr>
  ${r.company === 'priority' ? `<tr><td>${empLabel}</td><td>회사</td><td class="num">${won(r.topUp)}</td></tr>` : `<tr><td>${empLabel}</td><td>회사</td><td class="num">${won(r.employerFull)}</td></tr>`}
  </tbody><tfoot><tr><td colspan="2">합계 (평소 ${r.days}일 임금 ${won(r.fullWage)})</td><td class="num">${won(r.total)}</td></tr></tfoot></table></div>`;
  const steps = [
    `휴가 일수: ${TYPE[r.type]} 출산 → ${r.days}일, 출산 후 ${r.type === 'multiple' ? 60 : 45}일 이상 (${L('법령/근로기준법/제74조', '근로기준법 제74조①')}). 처음 ${r.employerDays}일은 유급 (같은 조④)`,
    `시간급 통상임금 = ${won(r.wage)} ÷ ${num(r.hr.hours)}시간 = ${won2(r.hr.hourly)}${r.hr.floored ? ` → 최저임금 ${won(r.hr.minWage)}보다 낮아 최저임금으로 (월 ${won(r.monthlyWage)})` : ` (휴가 시작일 최저임금 ${won(r.hr.minWage)} 이상)`} — ${L('법령/고용보험법시행령/제101조', '시행령 제101조2호')}`,
    `1일 통상임금 = 월 ${won(r.monthlyWage)} ÷ 30 = ${won2(r.dailyWage)}, 1일 상한 = ${won(r.capMonthly)} ÷ 30 = ${won2(r.capDaily)} (${GOSHI}) → 1일 급여 ${won2(Math.min(r.dailyWage, r.capDaily))}${r.capBinding ? ' (상한 적용)' : ''}`,
    r.company === 'priority'
      ? `우선지원대상기업: 고용보험이 ${r.days}일 전부 지급 = ${won(r.insured)} (${L('법령/고용보험법/제76조', '고용보험법 제76조①1호')}). 처음 ${r.employerDays}일은 회사가 (평소 1일 ${won2(r.realDaily)} − 급여) × ${r.employerDays}일 = ${won(r.topUp)}`
      : `대규모기업: 회사가 처음 ${r.employerDays}일 통상임금 ${won2(r.realDaily)} × ${r.employerDays}일 = ${won(r.employerFull)}, 고용보험은 ${r.firstInsured}일째부터 ${r.insuredDays}일분 = ${won(r.insured)} (${L('법령/고용보험법/제76조', '고용보험법 제76조①1호 단서')})`,
    `${r.employerDays}일 이후 기간은 회사의 유급 의무가 없어 통상임금이 상한보다 많아도 차액이 없습니다 (취업규칙·단체협약으로 더 줄 수 있음).`,
    '합계는 원 미만 절사. 고용보험 급여는 비과세(소득세법 제12조3호마목), 회사 지급분은 근로소득입니다.',
  ];
  html += basisBlock('계산 근거 펼치기', steps, true);
  return html;
}

function renderSpouse(r) {
  let html = `<h2>계산 결과</h2><p>배우자 출산전후휴가 ${r.used}일 동안 받는 돈</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi('고용보험 급여', won(r.insured))}
    ${kpi('회사 지급', won(r.employerTotal))}
    ${kpi('1일 통상임금', won2(r.realDaily))}
    ${kpi('20일 상한', won(r.cap20))}
  </div>`;
  r.warnings.forEach((w) => { html += `<div class="note">${esc(w)}</div>`; });
  const steps = [
    `배우자 출산전후휴가 20일 유급, 출산예정일 50일 전부터 출산일 후 120일까지, 3회 분할 (${L('법령/남녀고용평등과일ㆍ가정양립지원에관한법률/제18조의2', '남녀고용평등법 제18조의2')}, 2026.9.18. 시행)`,
    `시간급 통상임금 = ${won(r.wage)} ÷ ${num(r.hr.hours)}시간 = ${won2(r.hr.hourly)}${r.hr.floored ? ` → 최저임금 ${won(r.hr.minWage)} 적용` : ''}; 1일 통상임금 = 시간급 × ${num(r.dailyHours, 1)}시간 = ${won2(r.dailyWage)}`,
    r.company === 'priority'
      ? `우선지원대상기업: 고용보험 = min(${won2(r.dailyWage)}, 1일 상한 ${won2(r.capDaily)}) × ${r.used}일 = ${won(r.insured)} (20일 상한 ${won(r.cap20)}, ${GOSHI}; ${L('법령/고용보험법/제76조', '고용보험법 제76조①2호')})`
      : '대규모기업: 고용보험 급여 없음 (고용보험법 제76조①2호 단서: 우선지원대상기업으로 한정)',
    `회사 지급 = 평소 ${r.used}일 임금 ${won(r.fullWage)} − 고용보험 급여 ${won(r.insured)} = ${won(r.employerTotal)} (급여가 나오면 그 한도에서 회사 책임 면제, 제18조의2②)`,
  ];
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">급여는 휴가가 끝난 뒤 한꺼번에 신청합니다. 1일 소정근로시간이 8시간보다 짧은 단시간 근로자는 실제 시간을 넣으세요.</p>';
  return html;
}

const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };

bindCalculator({
  defaults: { kind: 'maternity', company: 'priority', wage: '3000000', startDate: '2026-09-01', birthType: 'single', spouseDays: '20', dailyHours: '8', monthlyHours: '209' },
  compute: (v) => calcMaternityLeave(v),
  render: (r) => (r.kind === 'spouse' ? renderSpouse(r) : renderMaternity(r)),
  onChange: (form) => {
    const spouse = form.querySelector('[name=kind]:checked')?.value === 'spouse';
    show('mat-wrap', !spouse);
    show('sp-wrap', spouse);
  },
});
