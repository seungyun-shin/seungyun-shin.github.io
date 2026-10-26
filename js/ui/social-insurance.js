import { socialInsurance } from '../lib/insurance.js';
import { RATES } from '../rates/2026.js';
import { bindCalculator, won, pct, kpi, basisBlock, todayStr } from './common.js';

function render(r) {
  const np = r.np; const hi = r.hi; const ei = r.ei; const ia = r.ia;
  const npNote = np.excluded ? '만 60세 이상 — 의무가입 제외' : `기준소득월액 ${won(np.base)}${np.clamp === 'max' ? ' (상한 적용)' : np.clamp === 'min' ? ' (하한 적용)' : ''}`;
  const rows = [
    ['국민연금', np.employee, np.employer, npNote],
    ['건강보험', hi.employee, hi.employer, `보수월액 × ${pct(RATES.nhis.rateEmployee.value)}${hi.clamp === 'max' ? ' (상한 적용)' : hi.clamp === 'min' ? ' (하한 적용)' : ''}`],
    ['장기요양보험', hi.ltcEmployee, hi.ltcEmployer, `건강보험료 × ${pct(hi.ltcRatio, 2)}`],
    ['고용보험(실업급여)', ei.employee, ei.employerUnemp, '각 0.9%'],
    ['고용안정·직업능력개발', 0, ei.employerStability, `사업주만 ${pct(ei.stabilityRate, 2)}`],
    ['산재보험', 0, ia.employer, `사업주만 ${pct(ia.rate, 3)} (업종요율 + 출퇴근 0.06%)`],
    ['임금채권부담금·석면분담금', 0, ia.wageClaim + ia.asbestos, '사업주만 0.09% + 0.006%'],
  ];
  const trs = rows.map(([n, e, b, note]) => `<tr><td>${n}<div class="small muted">${note}</div></td><td class="num">${won(e)}</td><td class="num">${won(b)}</td></tr>`).join('');
  return `<h2>계산 결과 (월)</h2>
  <p>근로자 부담 합계</p><p class="big">${won(r.employeeTotal)}</p>
  <div class="kpis">
    ${kpi('보험료 산정 보수', won(r.income))}
    ${kpi('사업주 부담 합계', won(r.employerTotal))}
    ${kpi('근로자 + 사업주', won(r.total))}
    ${kpi('근로자 부담률', pct(r.income ? r.employeeTotal / r.income : 0, 2))}
  </div>
  <div class="table-scroll"><table><thead><tr><th>항목</th><th class="num">근로자</th><th class="num">사업주</th></tr></thead><tbody>${trs}</tbody>
  <tfoot><tr><td>합계</td><td class="num">${won(r.employeeTotal)}</td><td class="num">${won(r.employerTotal)}</td></tr></tfoot></table></div>
  ${basisBlock('계산 근거 펼치기', [
    `적용일 ${r.date}: 국민연금 기준소득월액 하한 ${won(np.limits.min)} · 상한 ${won(np.limits.max)} (${r.date >= '2026-07-01' ? '2026.7.1.~2027.6.30.' : '2025.7.1.~2026.6.30.'})`,
    `보험료 산정 보수 = 월 급여 ${won(r.pay)} − 비과세 ${won(r.nonTax)} = ${won(r.income)}`,
    `국민연금 = 기준소득월액(천원 미만 절사, 상·하한 적용) × 4.75% → 10원 미만 절사 (국민연금법 부칙 제4조, 제117조)`,
    `건강보험 = 보수월액 × 7.19% ÷ 2 → 10원 미만 절사 (국민건강보험법 시행령 제44조)`,
    `장기요양 = 건강보험료 × (0.9448% ÷ 7.19%) ≈ 13.14% (노인장기요양보험법 제9조)`,
    `고용보험 = 보수 × 0.9% (근로자), 사업주는 0.9% + 규모별 고용안정·직능 요율`,
    `산재보험 요율은 업종마다 다릅니다. 입력한 요율 ${pct(ia.industryRate, 3)}에 출퇴근재해 0.06%를 더했습니다.`,
    '근로자·사업주 몫을 각각 10원 미만 절사했습니다. 공단 고지액과 10원 단위 차이가 날 수 있습니다.',
  ])}`;
}

bindCalculator({
  defaults: () => ({ monthlyPay: '3000000', nonTaxable: '200000', date: todayStr() > '2026-12-31' ? '2026-12-31' : todayStr(), size: 'under150', industryRate: '1.41' }),
  compute: (v) => {
    if (!v.monthlyPay) throw new Error('월 급여를 입력하세요.');
    if (v.date && (v.date < '2026-01-01' || v.date > '2026-12-31')) throw new Error('이 계산기는 2026년(2026-01-01~2026-12-31) 요율만 반영합니다. 적용일을 2026년 안으로 입력하세요.');
    return socialInsurance({
      monthlyPay: v.monthlyPay, nonTaxable: v.nonTaxable, date: v.date || todayStr(), size: v.size,
      industryRate: (Number(v.industryRate) || 1.41) / 100, age60plus: v.age60plus, age65EI: v.age65EI,
    });
  },
  render,
});
