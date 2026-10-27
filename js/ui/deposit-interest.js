import { calcDeposit } from '../lib/deposit.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

function render(r) {
  const t = r.tax;
  const taxLines = [];
  if (r.taxType === 'general') taxLines.push(`소득세 ${won(t.income)} (이자 × 14%, 10원 미만 절사)`, `지방소득세 ${won(t.local)} (소득세 × 10%, 10원 미만 절사)`);
  if (r.taxType === 'preferential') taxLines.push(`소득세 ${won(t.income)} (이자 × 9%, 조세특례제한법 제89조)`, `농어촌특별세 ${won(t.farm)} (감면세액 = 이자 × 14% − 낸 소득세 ${won(t.income)}의 10%, 농어촌특별세법 제5조④)`);
  if (r.taxType === 'custom') taxLines.push(`세금 ${won(t.custom)} (이자 × ${num(r.customTaxRate, 2)}%)`);
  if (r.taxType === 'exempt') taxLines.push('비과세: 세금 0원');
  let html = `<h2>계산 결과</h2><p>만기 실수령액 (${esc(r.taxName)})</p><p class="big">${won(r.maturityNet)}</p>
  <div class="kpis">
    ${kpi(r.kind === 'deposit' ? '원금' : `납입 원금 (${r.months}회)`, won(r.totalPrincipal))}
    ${kpi('세전 이자', won(r.interest))}
    ${kpi('세금', won(r.taxTotal))}
    ${kpi('세후 이자', won(r.netInterest))}
  </div>`;
  if (r.overInsurance) html += '<div class="note">원금과 이자를 합친 금액이 예금자보호 한도 1억원(예금자보호법 시행령 제18조⑦, 2025.9.1. 시행)을 넘습니다. 금융회사를 나누면 각각 한도가 적용됩니다.</div>';
  const i = r.annualRate / 12;
  const formula = r.kind === 'deposit'
    ? (r.compounding === 'monthly' ? `원금 ${won(r.amount)} × ((1 + ${num(i, 6)}%)^${r.months} − 1)` : `원금 ${won(r.amount)} × ${num(r.annualRate, 4)}% × ${r.months} ÷ 12`)
    : (r.compounding === 'monthly' ? `매월 ${won(r.amount)}의 회차별 월복리 이자 합 (첫 회 ${r.months}개월 ~ 마지막 회 1개월)` : `${won(r.amount)} × ${num(r.annualRate, 4)}% ÷ 12 × ${r.months} × ${r.months + 1} ÷ 2`);
  html += basisBlock('계산 근거 펼치기', [
    `세전 이자 = ${formula} = ${won(r.interest)} (원 미만 버림)`,
    ...taxLines,
    `세후 이자 = ${won(r.interest)} − ${won(r.taxTotal)} = ${won(r.netInterest)}`,
    `만기 실수령액 = ${won(r.totalPrincipal)} + ${won(r.netInterest)} = ${won(r.maturityNet)}`,
    r.kind === 'savings' ? `세후 이자 ÷ 납입 원금 합계를 연으로 환산하면 ${num(r.netYieldOnPrincipal * 100, 2)}% (적금은 평균 예치 잔액이 원금 합계의 절반 남짓이라 약정 금리보다 낮게 보입니다)` : `세후 수익률 연 ${num(r.netYieldOnPrincipal * 100, 3)}%`,
  ], true);
  return html;
}

bindCalculator({
  defaults: { kind: 'deposit', amount: '10000000', annualRate: '3', months: '12', compounding: 'simple', taxType: 'general' },
  compute: (v) => calcDeposit(v),
  render,
  onChange: (form) => {
    document.getElementById('custom-wrap').hidden = form.querySelector('[name=taxType]:checked')?.value !== 'custom';
  },
});
