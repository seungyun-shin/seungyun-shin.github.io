import { calcLoan } from '../lib/loan.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

function table(r) {
  const rows = r.schedule.map((x) => `<tr${x.grace ? ' class="muted"' : ''}><td>${x.n}${x.grace ? '*' : ''}</td><td class="num">${num(x.payment)}</td><td class="num">${num(x.principal)}</td><td class="num">${num(x.interest)}</td><td class="num">${num(x.balance)}</td></tr>`).join('');
  return `<details class="basis"><summary>월별 상환표 펼치기 (${r.months}회)</summary><div class="table-scroll"><table class="schedule">
<thead><tr><th>회</th><th class="num">상환액</th><th class="num">원금</th><th class="num">이자</th><th class="num">잔액</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td>계</td><td class="num">${num(r.totalPayment)}</td><td class="num">${num(r.principal)}</td><td class="num">${num(r.totalInterest)}</td><td></td></tr></tfoot></table></div><p class="small muted">단위: 원${r.graceMonths ? ' · * 거치기간(이자만 냄)' : ''}</p></details>`;
}

function render(r) {
  const headline = r.method === 'equalPayment'
    ? ['월 상환액 (원리금)', won(r.regularPayment)]
    : r.method === 'equalPrincipal'
      ? ['첫 상환 달 상환액 (이후 매달 감소)', won(r.firstRepayPayment)]
      : ['월 이자 (만기에 원금 상환)', won(r.firstPayment)];
  let html = `<h2>계산 결과 — ${esc(r.methodName)}</h2><p>${headline[0]}</p><p class="big">${headline[1]}</p>
  <div class="kpis">
    ${kpi('총이자', won(r.totalInterest))}
    ${kpi('총 상환액', won(r.totalPayment))}
    ${r.graceMonths ? kpi(`거치기간 ${r.graceMonths}개월 월 이자`, won(r.graceInterest)) : kpi('첫 달 상환액', won(r.firstPayment))}
    ${kpi('마지막 달 상환액', won(r.lastPayment))}
  </div>`;
  if (r.interestCapExceeded) html += '<div class="note">연 20%를 넘는 이율입니다. 금전대차 계약의 최고이자율은 연 20%이고 넘는 부분의 이자 약정은 무효입니다 (이자제한법 제2조, 최고이자율에 관한 규정).</div>';
  html += table(r);
  html += basisBlock('계산 근거 펼치기', [
    `월 이율 = 연 ${num(r.annualRate, 4)}% ÷ 12 = ${num(r.monthlyRate * 100, 6)}%`,
    `대출 기간 ${r.months}개월 = 거치 ${r.graceMonths}개월 + 상환 ${r.repayMonths}개월`,
    r.method === 'equalPayment'
      ? `원리금균등 월 상환액 = 원금 × i(1+i)^${r.repayMonths} ÷ ((1+i)^${r.repayMonths} − 1) = ${won(r.regularPayment)} (원 미만 반올림)`
      : r.method === 'equalPrincipal'
        ? `원금균등 월 원금 = ${won(r.principal)} ÷ ${r.repayMonths} = ${won(r.regularPrincipal)} (원 미만 반올림), 이자는 남은 원금 × 월 이율`
        : `만기일시: 매달 이자 ${won(r.firstPayment)}, 마지막 달에 원금 ${won(r.principal)}을 함께 상환`,
    '월 이자 = 남은 원금 × 월 이율 (원 미만 반올림). 끝수는 마지막 달 원금에서 정리합니다.',
    '실제 은행은 실제 일수(일 단위)로 이자를 계산하는 경우가 많아 달마다 몇 원~몇백 원 다를 수 있습니다.',
  ]);
  return html;
}

bindCalculator({
  defaults: { principal: '100000000', annualRate: '4.5', months: '360', graceMonths: '0', method: 'equalPayment' },
  validUntil: '9999-12-31',
  compute: (v) => calcLoan(v),
  render,
});
