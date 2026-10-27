import { calcAcquisitionTax } from '../lib/acquisition-tax.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const p = (r, d = 4) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;

function render(r) {
  let html = `<h2>계산 결과</h2><p>취득세·지방교육세·농어촌특별세 합계</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi(`취득세 (${p(r.rate)})`, won(r.acqTax))}
    ${kpi('지방교육세', won(r.eduTax))}
    ${kpi('농어촌특별세', r.over85 ? won(r.farmTax) : '비과세 (85㎡ 이하)')}
    ${kpi('가격 대비', p(r.effectiveRate, 3))}
  </div>`;
  for (const w of r.warnings) html += `<div class="note">${esc(w)}</div>`;
  const steps = [];
  steps.push(r.heavy
    ? `중과: ${esc(r.heavyLabel)} → 4% + 중과기준세율 2% × ${r.rate > 0.1 ? '400%' : '200%'} = ${p(r.rate)} (지방세법 제13조의2①)`
    : r.price <= 6e8 ? `취득가액 ${won(r.price)} ≤ 6억원 → 1% (제11조①8호가목)`
      : r.price > 9e8 ? `취득가액 ${won(r.price)} > 9억원 → 3% (제11조①8호다목)`
        : `(${won(r.price)} × 2 ÷ 3억원 − 3) × 1/100 = ${p(((r.price * 2) / 3e8 - 3) / 100, 6)} → 넷째 자리 반올림 ${p(r.baseRate)} (제11조①8호나목)`);
  steps.push(`취득세 = ${won(r.price)} × ${p(r.rate)} = ${won(r.acqBefore)}${r.relief ? ` − 생애최초 감면 ${won(r.relief)} = ${won(r.acqTax)} (지방세특례제한법 제36조의3)` : ''}`);
  steps.push(r.heavy
    ? `지방교육세 = ${won(r.price)} × (4% − 2%) × 20% = ${won(r.eduTax)} (제151조①1호나목)`
    : `지방교육세 = ${won(r.price)} × ${p(r.baseRate)} × 50% × 20% = ${won(r.eduTax)} (제151조①1호)`);
  steps.push(r.over85
    ? `농어촌특별세 = ${won(r.price)} × ${p(r.farmRate)}${r.farmOnRelief ? ` + 감면세액 ${won(r.relief)} × 20%` : ''} = ${won(r.farmTax)} (농어촌특별세법 제5조①${r.farmOnRelief ? '1호·' : ''}6호)`
    : '농어촌특별세: 전용 85㎡ 이하 국민주택규모라 비과세 (농어촌특별세법 제4조, 시행령 제4조⑤)');
  steps.push('세목마다 10원 미만 절사 (지방세기본법 제59조 → 국고금관리법 제47조)');
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += `<p class="small muted">이 계산은 개인의 주택 매매(유상취득) 기준이며 ${num(r.houses)}주택 · ${r.adjusted ? '조정대상지역' : '조정대상지역 외'}로 입력한 값입니다. 신고·납부 기한은 취득일부터 60일입니다(지방세법 제20조①).</p>
  <p class="small muted">취득한 뒤에는 해마다 보유세를 냅니다: <a href="/property-tax/">재산세 계산기</a>(공시가격 기준) · <a href="/comprehensive-real-estate-tax/">종합부동산세 계산기</a></p>`;
  return html;
}

bindCalculator({
  defaults: { price: '700000000', houses: '1', adjusted: false, temporary: false, lowValue: false, over85: false, firstHome: false, firstHomeSmall: false },
  compute: (v) => calcAcquisitionTax(v),
  render,
  onChange: (form) => {
    document.getElementById('small-wrap').hidden = !form.querySelector('[name=firstHome]').checked;
  },
});
