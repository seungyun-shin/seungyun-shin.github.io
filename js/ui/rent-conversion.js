import { calcRentConversion } from '../lib/rent.js';
import { RATES } from '../rates/2026.js';
import { bindCalculator, won, num, kpi, basisBlock } from './common.js';

const pct = (n) => `${num(n, 4)}%`;

function capLine(r) {
  return `전환율 상한 = min(연 ${pct(r.cap.fixed)}, 기준금리 ${pct(r.cap.baseRate)} + 2%p = ${pct(r.cap.byBase)}) = <strong>${pct(r.cap.cap)}</strong> (주택임대차보호법 제7조의2, 시행령 제9조)`;
}

function render(r) {
  let html = '<h2>계산 결과</h2>';
  if (r.mode === 'toMonthly') {
    html += `<p>바꾼 뒤 월세 (보증금 ${won(r.depositAfter)})</p><p class="big">${won(r.rentAfter)}</p>
    <div class="kpis">${kpi('월세로 바꾼 보증금', won(r.converted))}${kpi('늘어난 월세', won(r.addRent))}${kpi('적용 전환율', pct(r.rate))}${kpi('법정 상한 월세', won(r.capRentAfter))}</div>`;
    if (r.overCap) html += `<div class="note">입력한 전환율 ${pct(r.rate)}가 법정 상한 ${pct(r.cap.cap)}보다 높습니다. 보증금을 월세로 바꿀 때 월세는 상한 기준 ${won(r.capRentAfter)}을 넘을 수 없고, 넘게 낸 금액은 반환을 청구할 수 있습니다(제10조의2).</div>`;
    html += basisBlock('계산 근거 펼치기', [
      capLine(r),
      `늘어나는 월세 = ${won(r.converted)} × ${pct(r.rate)} ÷ 12 = ${won(r.addRent)} (원 미만 버림)${r.rateGiven ? '' : ' — 전환율을 비워 법정 상한으로 계산'}`,
      `바꾼 뒤 월세 = 현재 월세 ${won(r.rentBefore)} + ${won(r.addRent)} = ${won(r.rentAfter)}`,
    ], true);
  } else if (r.mode === 'toDeposit') {
    html += `<p>바꾼 뒤 보증금 (월세 ${won(r.rentAfter)})</p><p class="big">${won(r.depositAfter)}</p>
    <div class="kpis">${kpi('줄인 월세', won(r.rentCut))}${kpi('늘어난 보증금', won(r.addDeposit))}${kpi('적용 전환율', pct(r.rate))}${kpi('법정 상한(참고)', pct(r.cap.cap))}</div>`;
    html += basisBlock('계산 근거 펼치기', [
      `늘어나는 보증금 = 줄인 월세 ${won(r.rentCut)} × 12 ÷ ${pct(r.rate)} = ${won(r.addDeposit)} (원 미만 버림)${r.rateGiven ? '' : ' — 전환율을 비워 법정 상한과 같은 비율로 계산'}`,
      '법정 상한(제7조의2)은 보증금을 월세로 바꾸는 경우에만 정해져 있습니다. 월세를 보증금으로 바꾸는 비율은 당사자가 정합니다.',
      capLine(r),
    ], true);
  } else {
    html += `<p>이 조건의 전환율</p><p class="big">${pct(r.impliedRate)}</p>
    <div class="kpis">${kpi('줄어드는 보증금', won(r.converted))}${kpi('늘어나는 월세', won(r.addRent))}${kpi('법정 상한', pct(r.cap.cap))}${kpi('상한 기준 늘어나는 월세', won(r.capRent))}</div>`;
    html += r.overCap
      ? `<div class="note">법정 상한 ${pct(r.cap.cap)}보다 높습니다. 상한으로 계산하면 늘어나는 월세는 ${won(r.capRent)}이고, 요구액은 월 ${won(r.overBy)} 많습니다.</div>`
      : `<p class="ok">법정 상한 ${pct(r.cap.cap)} 이하입니다.</p>`;
    html += basisBlock('계산 근거 펼치기', [
      `전환율 = 늘어나는 월세 ${won(r.addRent)} × 12 ÷ 줄어드는 보증금 ${won(r.converted)} = ${pct(r.impliedRate)}`,
      capLine(r),
    ], true);
  }
  html += `<p class="small muted">기준금리 기본값 ${num(RATES.rent.bokBaseRate.value * 100, 2)}%는 ${RATES.rent.bokBaseRate.checked}에 한국은행 누리집에서 확인한 값입니다. 그 뒤 바뀌었으면 '기준금리' 칸을 고치세요.</p>`;
  return html;
}

const show = (id, on) => { document.getElementById(id).hidden = !on; };

bindCalculator({
  defaults: { mode: 'toMonthly', depositBefore: '300000000', rentBefore: '0', depositAfter: '100000000', rentAfter: '', baseRate: String(+(RATES.rent.bokBaseRate.value * 100).toFixed(2)) },
  validUntil: '9999-12-31',
  compute: (v) => calcRentConversion(v),
  render,
  onChange: (form) => {
    const m = form.querySelector('[name=mode]:checked')?.value || 'toMonthly';
    show('depAfter-wrap', m !== 'toDeposit');
    show('rentAfter-wrap', m !== 'toMonthly');
    show('rate-wrap', m !== 'rate');
  },
});
