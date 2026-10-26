import { takeHome, salaryForNet } from '../lib/salary.js';
import { bindCalculator, won, num, pct, kpi, basisBlock, todayStr } from './common.js';

function taxBreakdown(t) {
  const d = t.detail;
  if (!d) return ['월급여가 77만원 미만이라 간이세액표상 소득세가 없습니다.'];
  const items = [];
  if (t.row) {
    items.push(t.row[0] === 10000 ? '월급여 10,000천원 행 적용' : `월급여 ${num(t.pay)}원 → 간이세액표 ${num(t.row[0])}~${num(t.row[1])}천원 구간, 중간값 ${num(d.m)}원으로 계산`);
  } else {
    items.push(`월급여 10,000천원 초과: 10,000천원 세액 ${won(t.over10m.base10m)} + 초과분 가산 ${won(t.over10m.add)} (별표 2 계산식)`);
  }
  items.push(
    `연간 총급여 ${won(d.g)} − 근로소득공제 ${won(d.eid)} − 인적공제 ${won(d.personal)} (150만원 × ${t.family}명) − 연금보험료공제 ${won(d.pension)} − 특별소득공제 등 ${won(d.special)} = 과세표준 ${won(d.base)}`,
    `산출세액 ${won(d.t)} − 근로소득세액공제 ${won(d.credit)} = 결정세액 ${won(d.decided)} → ÷ 12, 10원 미만 절사 = 표 세액 ${won(t.tableTax)}`,
  );
  if (t.childDed) items.push(`8세 이상 20세 이하 자녀 ${t.children}명 공제 −${won(t.childDed)} (별표 2 비고 3)`);
  if (t.ratio !== 1) items.push(`원천징수 비율 ${t.ratio * 100}% 선택 (시행령 제194조)`);
  items.push(`지방소득세 = 소득세 ${won(t.incomeTax)} × 10% = ${won(t.localTax)}`);
  items.push('간이세액표의 연금보험료공제(4.5%, 월 449만원 한도)와 세액공제 한도는 표를 만들 때 정한 고정값입니다. 실제 2026년 국민연금 요율(4.75%)과 다르지만, 회사는 이 표대로 원천징수합니다.');
  return items;
}

function render(r, v) {
  const i = r.ins;
  const rows = [
    ['국민연금', i.np.employee], ['건강보험', i.hi.employee], ['장기요양보험', i.hi.ltcEmployee], ['고용보험', i.ei.employee],
    ['소득세 (간이세액표)', r.tax.incomeTax], ['지방소득세', r.tax.localTax],
  ];
  let html = `<h2>계산 결과</h2>
  <p>월 예상 실수령액</p><p class="big">${won(r.net)}</p>
  <div class="kpis">
    ${kpi('월 세전 급여', won(r.monthly))}
    ${kpi('월 공제 합계', won(r.deductions))}
    ${kpi('연 실수령액(×12)', won(r.netAnnual))}
    ${kpi('실수령 비율', pct(r.netRatio, 1))}
  </div>
  <div class="table-scroll"><table><thead><tr><th>공제 항목 (월)</th><th class="num">금액</th></tr></thead><tbody>
  ${rows.map(([n, a]) => `<tr><td>${n}</td><td class="num">${won(a)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td>공제 합계</td><td class="num">${won(r.deductions)}</td></tr></tfoot></table></div>`;
  if (r.divisor === 13) html += '<p class="small muted">퇴직금 포함 연봉이라 연봉을 13으로 나눠 월급을 계산했습니다.</p>';
  html += basisBlock('4대보험 계산 근거', [
    `월 급여 ${won(r.monthly)} = 연봉 ${won(r.annual)} ÷ ${r.divisor}`,
    `보험료·세금 기준 보수 = ${won(r.monthly)} − 비과세 ${won(r.nonTax)} = ${won(r.taxable)}`,
    `국민연금: 기준소득월액 ${won(i.np.base)} × 4.75%${i.np.clamp === 'max' ? ' (상한 적용)' : ''}`,
    '건강보험 3.595%, 장기요양 = 건강보험료 × 13.14%, 고용보험 0.9% (각 10원 미만 절사)',
  ]);
  html += basisBlock('소득세 계산 근거 (간이세액표)', taxBreakdown(r.tax));
  if (Number(v.targetNet) > 0) {
    const need = salaryForNet(Number(v.targetNet), { severanceIncluded: v.severanceIncluded, nonTaxable: v.nonTaxable, family: v.family, children: v.children, ratio: v.ratio, date: todayStr() });
    html += `<h3>역산</h3><p>월 실수령액 ${won(v.targetNet)}을 받으려면 연봉 약 <strong>${won(need)}</strong>이 필요합니다 (같은 조건, 1만원 단위).</p>`;
  }
  html += '<p class="small muted">연말정산 결과(의료비·카드·연금저축 공제 등)에 따라 실제 1년 세금은 달라집니다. 매달 떼는 금액은 간이세액표 기준입니다.</p>';
  return html;
}

bindCalculator({
  defaults: { annualSalary: '40000000', nonTaxable: '200000', family: '1', children: '0', ratio: '1' },
  compute: (v) => {
    const fam = Number(v.family) || 1;
    if (fam < 1) throw new Error('공제대상가족은 본인을 포함해 1명 이상입니다.');
    if ((Number(v.children) || 0) > fam - 1) throw new Error('자녀 수는 공제대상가족 수(본인 포함)보다 적어야 합니다.');
    return takeHome({
      annualSalary: v.annualSalary, severanceIncluded: v.severanceIncluded, nonTaxable: v.nonTaxable,
      family: fam, children: Number(v.children) || 0, ratio: Number(v.ratio) || 1, date: todayStr(),
    });
  },
  render,
});
