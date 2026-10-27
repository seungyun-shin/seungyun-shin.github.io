import { calcPropertyTax } from '../lib/property-tax.js';
import { bindCalculator, won, kpi, basisBlock, esc } from './common.js';

const p = (r, d = 4) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;

function render(r) {
  let html = `<h2>계산 결과</h2><p>2026년 주택분 재산세 등 한 해 합계</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi('7월 16~31일 납부', won(r.july.total))}
    ${kpi('9월 16~30일 납부', won(r.sept.total))}
    ${kpi('재산세', won(r.mainTax))}
    ${kpi('공시가격 대비', p(r.effectiveRate, 3))}
  </div>
  <div class="table-scroll"><table>
  <thead><tr><th>세목 (한 해)</th><th class="num">7월</th><th class="num">9월</th></tr></thead>
  <tbody>
  ${[['재산세', 'mainTax', won(r.mainTax)], ['도시지역분', 'urbanTax', r.urban ? won(r.urbanTax) : '해당 없음'], ['지방교육세', 'eduTax', won(r.eduTax)], ['지역자원시설세', 'fireTax', r.buildingValue ? won(r.fireTax) : '건축물 가액 미입력']]
    .map(([name, k, year]) => `<tr><td>${name}<div class="small muted">${year}</div></td><td class="num" style="white-space:nowrap">${won(r.july[k])}</td><td class="num" style="white-space:nowrap">${won(r.sept[k])}</td></tr>`).join('')}
  <tr><td><strong>합계</strong><div class="small muted">${won(r.total)}</div></td><td class="num" style="white-space:nowrap"><strong>${won(r.july.total)}</strong></td><td class="num" style="white-space:nowrap"><strong>${won(r.sept.total)}</strong></td></tr>
  </tbody></table></div>`;
  for (const w of r.warnings) html += `<div class="note">${esc(w)}</div>`;
  if (r.lumpSumPossible) html += '<div class="note">재산세(도시지역분 포함) 한 해 세액이 20만원 이하라 조례에 따라 7월에 한꺼번에 고지될 수 있습니다(지방세법 제115조①3호 단서).</div>';
  if (r.julyInstallable || r.septInstallable) html += `<div class="note">분할납부 가능: 7월분 중 ${won(r.julyInstallable)}, 9월분 중 ${won(r.septInstallable)}을 납부기한이 지난 날부터 3개월 안에 나눠 낼 수 있습니다. 납부기한까지 신청하세요(지방세법 제118조, 시행령 제116조).</div>`;

  const steps = [];
  steps.push(`공정시장가액비율: ${r.oneHouse ? `1세대 1주택, 공시가격 ${won(r.price)} → ${p(r.ratio)}` : `${p(r.ratio)} (1세대 1주택 아님)`} (지방세법 시행령 제109조①2호)`);
  steps.push(`과세표준 = ${won(r.price)} × ${p(r.ratio)} = ${won(r.rawBase)} (1원 미만 절사)`);
  if (r.baseCapAmount !== null) {
    steps.push(`과세표준상한액 = 작년 공시가격 × ${p(r.ratio)} + ${won(r.rawBase)} × 5% = ${won(r.baseCapAmount)} → ${r.capped ? `상한 적용, 과세표준 ${won(r.base)}` : '상한보다 작아 그대로'} (제110조③, 시행령 제109조의2)`);
  }
  steps.push(`재산세 = ${won(r.base)}에 ${r.special ? '1세대 1주택 특례세율 (제111조의2①)' : '표준세율 (제111조①3호나목)'} 적용 = ${won(r.calcMain)} (10원 미만 절사)`);
  if (r.mainCapAmount !== null) steps.push(`종전 세부담상한: 작년 재산세 × ${p(r.legacyRate, 0)} = ${won(r.mainCapAmount)} → 재산세 ${won(r.mainTax)}${r.urbanCapAmount !== null ? `, 도시지역분 상한 ${won(r.urbanCapAmount)}` : ''} (종전 제122조, 법률 제19230호 부칙 제15조)`);
  steps.push(r.urban ? `도시지역분 = ${won(r.base)} × 0.14% = ${won(r.calcUrban)}${r.urbanTax < r.calcUrban ? ` → 상한 ${won(r.urbanTax)}` : ''} (제112조①2호)` : '도시지역분: 적용대상 지역이 아님');
  steps.push(`지방교육세 = 재산세 ${won(r.mainTax)} × 20% = ${won(r.eduTax)} (제151조①6호)`);
  steps.push(r.buildingValue
    ? `지역자원시설세 = 건축물 ${won(r.buildingValue)} × ${p(r.ratio)} = ${won(r.fireBase)}에 누진세율 = ${won(r.fireTax)} (제146조③1호·④)`
    : '지역자원시설세: 건축물 시가표준액을 넣지 않아 계산하지 않음 (고지서 금액을 확인하세요)');
  steps.push('7월분 = 세목별 한 해 세액의 2분의 1(10원 미만 절사), 9월분 = 나머지 (제115조①3호)');
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">공시가격 합계가 9억원(1세대 1주택자 12억원)을 넘으면 12월에 종합부동산세가 따로 고지됩니다. <a href="/comprehensive-real-estate-tax/">종합부동산세 계산기</a></p>';
  return html;
}

bindCalculator({
  defaults: { price: '500000000', buildingValue: '', oneHouse: true, urban: true, prevPrice: '', legacy: false, prevTax: '', prevUrbanTax: '' },
  compute: (v) => calcPropertyTax(v),
  render,
});
