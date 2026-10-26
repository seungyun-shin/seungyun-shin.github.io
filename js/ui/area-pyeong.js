import { calcArea, areaTable } from '../lib/area.js';
import { bindCalculator, num, kpi, basisBlock } from './common.js';

const m2 = (n) => `${num(n, 2)}㎡`;
const py = (n) => `${num(n, 2)}평`;

function render(r) {
  let html = '<h2>계산 결과</h2>';
  if (r.m2 !== undefined) {
    html += r.unit === 'm2'
      ? `<p>${m2(r.value)}는</p><p class="big">${py(r.pyeongRound)}</p>`
      : `<p>${py(r.value)}은</p><p class="big">${m2(r.m2Round)}</p>`;
  }
  if (r.exclusive) {
    html += `<div class="kpis">
      ${kpi('전용면적', `${m2(r.exclusive)}<br><small class="muted">${py(r.exclusivePyeong)}</small>`)}
      ${kpi('공급면적', `${m2(r.supply)}<br><small class="muted">${py(r.supplyPyeong)}</small>`)}
      ${kpi('계약면적', `${m2(r.contract)}<br><small class="muted">${py(r.contractPyeong)}</small>`)}
      ${kpi('전용률', r.hasCommon ? `${num(r.exclusiveRatio * 100, 1)}%` : '공용면적 미입력')}
    </div>`;
  }
  const lines = [];
  if (r.m2 !== undefined) lines.push(r.unit === 'm2' ? `${m2(r.value)} × 121 ÷ 400 = ${num(r.pyeong, 4)}평` : `${py(r.value)} × 400 ÷ 121 = ${num(r.m2, 4)}㎡`);
  if (r.exclusive) {
    lines.push(`공급면적 = 전용 ${m2(r.exclusive)} + 주거공용 ${m2(r.residentialCommon)} = ${m2(r.supply)}`);
    lines.push(`계약면적 = 공급 ${m2(r.supply)} + 그 밖의 공용 ${m2(r.otherCommon)} = ${m2(r.contract)}`);
    if (r.hasCommon) lines.push(`전용률 = ${m2(r.exclusive)} ÷ ${m2(r.supply)} = ${num(r.exclusiveRatio * 100, 2)}%`);
  }
  lines.push('1평 = 400/121㎡ ≈ 3.3058㎡. 화면 값은 소수 둘째 자리 반올림.');
  html += basisBlock('계산 근거 펼치기', lines, true);
  const t = areaTable().map((x) => `<tr><td class="num">${m2(x.m2)}</td><td class="num">${py(x.pyeong)}</td></tr>`).join('');
  html += `<details class="basis"><summary>자주 찾는 면적 환산표</summary><div class="table-scroll"><table><thead><tr><th class="num">㎡</th><th class="num">평</th></tr></thead><tbody>${t}</tbody></table></div></details>`;
  return html;
}

bindCalculator({
  defaults: { value: '84', unit: 'm2' },
  validUntil: '9999-12-31',
  compute: (v) => calcArea(v),
  render,
});
