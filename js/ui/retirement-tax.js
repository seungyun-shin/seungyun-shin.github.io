import { calcRetirementTax } from '../lib/retirement-tax.js';
import { bindCalculator, won, num, kpi, basisBlock, esc, todayStr } from './common.js';

const p = (r, d = 2) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;

function render(r) {
  let html = `<h2>계산 결과</h2><p>퇴직소득세 + 지방소득세 (일반 계좌로 받을 때 원천징수)</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi('퇴직소득세', won(r.incomeTax))}
    ${kpi('지방소득세', won(r.localTax))}
    ${kpi('세후 수령액', won(r.net))}
    ${kpi('퇴직급여 대비', p(r.effectiveRate))}
  </div>`;
  for (const w of r.warnings) html += `<div class="note">${esc(w)}</div>`;
  html += `<h3>IRP(연금계좌)로 받으면</h3>
  <ul>
    <li>지금 떼는 세금: <strong>0원</strong> — 연금 외로 찾기 전까지 원천징수하지 않음 (소득세법 제146조②, 지방세법 제103조의16). 이미 뗐다면 60일 안에 IRP에 넣고 환급 신청</li>
    <li>IRP를 해지해 한꺼번에 찾으면: ${won(r.total)} (미룬 세금을 그때 냄)</li>
    ${r.pension.slice(0, 2).map((x) => `<li>연금으로 받으면(실제 수령연차 ${esc(x.period)}): 약 ${won(x.incomeTax + x.localTax)} — 연금외수령 세율의 ${p(x.ratio, 0)} (소득세법 제129조①5호의3)</li>`).join('')}
  </ul>
  <p class="small muted">연금 수령 세액은 이연된 퇴직소득 전체를 그 연차 구간 안에 연금수령한도 이내로 받는다고 본 대략치입니다. 연금외수령 원천징수세율 ≈ 퇴직소득세 ÷ 퇴직소득금액 = ${p(r.withholdingRate, 3)}.</p>`;
  const steps = [];
  steps.push(r.mode === 'dates'
    ? `근속연수: ${r.hireDate} ~ ${r.retireDate} → ${num(r.years)}년 (1년 미만 끝수는 1년, 소득세법 제48조①·시행령 제105조)`
    : `근속연수: ${num(r.years)}년 (입력값)`);
  steps.push(`퇴직소득금액 = ${won(r.pay)}${r.nonTaxable ? ` − 비과세 ${won(r.nonTaxable)}` : ''} = ${won(r.income)}`);
  steps.push(`근속연수공제 ${won(r.serviceDeductionFull)}${r.serviceDeduction < r.serviceDeductionFull ? ` → 퇴직소득금액까지만 ${won(r.serviceDeduction)} (제48조②)` : ''} (제48조①1호)`);
  steps.push(`환산급여 = (${won(r.income)} − ${won(r.serviceDeduction)}) × 12 ÷ ${num(r.years)} = ${won(Math.floor(r.converted))}`);
  steps.push(`환산급여공제 ${won(Math.floor(r.convertedDeduction))} (제48조①2호) → 과세표준 ${won(r.base)} (1원 미만 절사)`);
  steps.push(`환산산출세액 = 과세표준 × 기본세율 = ${won(Math.floor(r.convTax))} (제55조①)`);
  steps.push(`퇴직소득 산출세액 = ${won(Math.floor(r.convTax))} ÷ 12 × ${num(r.years)} = ${won(r.calcTax)} → 원천징수 ${won(r.incomeTax)} (10원 미만 절사, 제55조②)`);
  steps.push(`지방소득세 = 과세표준 × 기본세율의 10분의 1 ÷ 12 × ${num(r.years)} = ${won(r.localCalc)} → ${won(r.localTax)} (지방세법 제92조④)`);
  html += basisBlock('계산 근거 펼치기', steps, true);
  return html;
}

bindCalculator({
  defaults: () => ({ pay: '50000000', mode: 'dates', hireDate: '2016-03-02', retireDate: todayStr(), years: '10' }),
  compute: (v) => calcRetirementTax(v),
  render,
  onChange: (form) => {
    const years = form.querySelector('[name=mode]:checked')?.value === 'years';
    document.getElementById('dates-wrap').hidden = years;
    document.getElementById('years-wrap').hidden = !years;
  },
});
