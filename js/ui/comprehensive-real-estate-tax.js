import { calcCompTax } from '../lib/comprehensive-real-estate-tax.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const p = (r, d = 4) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;

function render(r) {
  let html = `<h2>계산 결과</h2><p>2026년 12월 고지 주택분 종합부동산세 + 농어촌특별세</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi('종합부동산세', won(r.compTax))}
    ${kpi('농어촌특별세 (20%)', won(r.farmTax))}
    ${kpi('과세표준', won(r.base))}
    ${kpi('공제한 재산세', won(r.propCredit))}
  </div>`;
  for (const w of r.warnings) html += `<div class="note">${esc(w)}</div>`;
  html += r.installable
    ? `<div class="note">분납 가능: 12월 15일까지 ${won(r.firstPay)}을 내고, 종부세 ${won(r.installable)} + 농어촌특별세 ${won(r.farmInstallable)}은 납부기한이 지난 날부터 6개월 안에 낼 수 있습니다. 납부기한까지 분납 신청서를 내세요(종합부동산세법 제20조, 시행령 제16조).</div>`
    : (r.compTax ? '<div class="note">납부기간: 12월 1일~15일 (종합부동산세법 제16조). 종부세가 250만원 이하라 분납 대상이 아닙니다.</div>' : '');

  const steps = [];
  steps.push(`공시가격 합계 = ${r.prices.map(won).join(' + ')} = ${won(r.sum)} (${num(r.count)}채)`);
  steps.push(`과세표준 = (${won(r.sum)} − ${r.oneHouse ? '1세대 1주택자 공제' : '공제'} ${won(r.deduction)}) × ${p(r.fair)} = ${won(r.base)} (제8조①, 시행령 제2조의4, 1원 미만 절사)`);
  steps.push(`세율: ${r.threePlus ? '3주택 이상 (제9조①2호)' : '2주택 이하 (제9조①1호)'} → 산출세액 = ${won(r.bracketBase)} + (${won(r.base)} − ${won(r.bracketFrom)}) × ${p(r.bracketRate)} = ${won(r.calcTax)}`);
  r.houses.forEach((h, i) => steps.push(`주택 ${i + 1} 재산세: ${won(h.price)} × ${p(h.ratio)} = 과세표준 ${won(h.propBase)} → 재산세 ${won(h.propertyTax)} `));
  steps.push(`재산세 부과세액 합계 = ${won(r.paid)}${r.paid !== r.estPaid ? ` (입력한 고지액, 계산값 ${won(r.estPaid)})` : ' (계산값, 도시지역분 제외)'}`);
  steps.push(`분자 = 종부세 과세표준 ${won(r.base)} × 재산세 공정시장가액비율 ${p(r.propRatio)} × 0.4% = ${won(r.numerator)}`);
  steps.push(r.count > 1
    ? `분모 = 주택을 합산해 표준세율로 계산한 재산세 상당액: 공시가격 합계 ${won(r.sum)} × ${p(r.houses[0].ratio)} = ${won(r.denomBase)} → ${won(r.denominator)} (시행령 제4조의3①, 신고서 작성방법 ⑧)`
    : `분모 = 표준세율 재산세 상당액: ${won(r.sum)} × ${p(r.houses[0].ratio)} = ${won(r.denomBase)} → ${won(r.denominator)} (시행령 제4조의3①, 신고서 작성방법 ⑧)`);
  steps.push(`공제할 재산세 = ${won(r.paid)} × ${won(r.numerator)} ÷ ${won(r.denominator)} = ${won(r.propCredit)} (제9조③, 시행령 제4조의3①) → ${won(r.afterProp)}`);
  if (r.oneHouse) steps.push(`1세대 1주택자 세액공제 = ${won(r.afterProp)} × (고령자 ${p(r.ageRate)} + 장기보유 ${p(r.holdRate)}${r.ageRate + r.holdRate > r.creditRate ? ` → 한도 ${p(r.creditRate)}` : ''}) = ${won(r.credit)} (제9조⑤~⑧) → ${won(r.beforeCap)}`);
  if (r.cap) {
    steps.push(`세부담상한: 작년 상당액 = 재산세 ${won(r.cap.prevPropertyTax)} + 종부세 ${won(r.cap.prevCompTax)} = ${won(r.cap.prevTotal)} × 150% = ${won(r.cap.limit)}`);
    steps.push(`올해 총세액 = 재산세 ${won(r.paid)} + 종부세 ${won(r.beforeCap)} = ${won(r.cap.curTotal)} → 초과 ${won(r.cap.excess)} 공제 (제10조, 시행령 제5조)`);
  } else {
    steps.push('세부담상한: 작년 공시가격을 넣지 않아 계산하지 않음');
  }
  steps.push(`종합부동산세 = ${won(r.compTax)} (10원 미만 절사) · 농어촌특별세 = ${won(r.compTax)} × 20% = ${won(r.farmTax)} (농어촌특별세법 제5조①8호)`);
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">재산세 고지액을 모르면 <a href="/property-tax/">주택 재산세 계산기</a>로 주택별 재산세를 먼저 확인하세요.</p>';
  return html;
}

bindCalculator({
  defaults: { price1: '2000000000', oneHouse: true, age: '65', holdYears: '10' },
  compute: (v) => calcCompTax(v),
  render,
  onChange: (form) => {
    document.getElementById('one-wrap').hidden = !form.querySelector('[name=oneHouse]').checked;
  },
});
