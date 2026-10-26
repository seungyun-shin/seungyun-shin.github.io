import { calcGiftTax } from '../lib/gift-tax.js';
import { bindCalculator, won, pct, kpi, basisBlock, esc } from './common.js';

function render(r) {
  let html = `<h2>계산 결과</h2><p>예상 납부 증여세</p><p class="big">${won(r.payable)}</p>`;
  html += `<div class="kpis">
    ${kpi('증여재산 (10년 합산)', won(r.total))}
    ${kpi('공제 합계', won(r.basicDeduction + r.mbDeduction))}
    ${kpi('과세표준', won(r.base))}
    ${kpi('이번 증여 대비 세율', pct(r.effectiveRate, 2))}
  </div>`;
  if (r.belowMin && r.base > 0) html += '<p class="ok">과세표준이 50만원 미만이라 증여세가 없습니다 (상증법 제55조②).</p>';
  html += basisBlock('계산 근거 펼치기', [
    `관계: ${esc(r.relationName)} — 증여재산공제 한도 ${won(r.limit)} (10년 합산${r.usedElsewhere ? `, 다른 증여자에게서 이미 쓴 ${won(r.usedElsewhere)} 차감` : ''})`,
    `증여재산 = 이번 ${won(r.amount)} + 10년 내 합산 ${won(r.prior)} = ${won(r.total)}`,
    `증여재산공제 ${won(r.basicDeduction)}${r.mbDeduction ? ` + 혼인·출산 공제 ${won(r.mbDeduction)}` : ''}`,
    `과세표준 ${won(r.base)} × ${pct(r.rate, 0)} − 누진공제 ${won(r.progressiveDeduct)} = 산출세액 ${won(r.computedTax)}`,
    r.surchargeRate ? `세대생략 할증 ${pct(r.surchargeRate, 0)}: +${won(r.surcharge)} (제57조)` : '세대생략 할증 없음',
    r.priorCredit ? `기납부세액공제 −${won(r.priorCredit)} (10년 내 합산분에 이미 낸 세액)` : '기납부세액 없음',
    `신고세액공제 3% −${won(r.filingCredit)} (증여일이 속한 달 말일부터 3개월 안에 신고, 제69조)`,
    `납부세액 = ${won(r.payable)}`,
  ], true);
  html += '<p class="small muted">부동산·비상장주식처럼 시가 산정이 필요한 재산, 부담부증여, 창업자금·가업승계 특례, 영리법인을 통한 증여는 계산하지 않습니다. 실제 신고 전 세무사와 확인하세요.</p>';
  return html;
}

bindCalculator({
  defaults: { relation: 'ascendantToAdult', amount: '100000000', fileOnTime: true },
  compute: (v) => calcGiftTax({ ...v, fileOnTime: v.fileOnTime }),
  render,
  onChange: (form) => {
    const rel = form.querySelector('[name=relation]')?.value;
    const asc = rel === 'ascendantToAdult' || rel === 'ascendantToMinor';
    document.getElementById('asc-wrap').hidden = !asc;
  },
});
