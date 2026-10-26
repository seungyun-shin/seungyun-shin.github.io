import { calcInheritanceTax, LAW } from '../lib/inheritance-tax.js';
import { bindCalculator, won, pct, kpi, basisBlock, esc } from './common.js';

const lawLink = (label, short = false) => {
  const m = String(label).match(/^(상속세 및 증여세법(?: 시행령)?) 제(\d+)조(의\d+)?/);
  if (!m) return esc(label);
  const name = m[1].replace(/ /g, '');
  const text = short ? String(label).replace('상속세 및 증여세법 ', '') : label;
  return `<a href="https://www.law.go.kr/법령/${name}/제${m[2]}조${m[3] || ''}" target="_blank" rel="noopener">${esc(text)}</a>`;
};
const lawLinkS = (l) => lawLink(l, true);
// KPI 칸이 좁은 화면에서 줄바꿈되지 않도록 억·만원 단위로
const eok = (n) => {
  const x = Math.round(Number(n) || 0);
  if (x < 1e8) return won(x);
  const e = Math.floor(x / 1e8); const m = Math.floor((x % 1e8) / 1e4);
  return `${e.toLocaleString('ko-KR')}억${m ? ` ${m.toLocaleString('ko-KR')}만` : ''}원`;
};
// 배우자 법정상속분 1.5 : 1 → 3/(3 + 2 × 공동상속인 수)
const shareText = (n) => (n ? `3/${3 + 2 * n}` : '1 (단독)');

function render(r) {
  let html = `<h2>계산 결과</h2><p>예상 상속세 (납부할 세액)</p><p class="big">${won(r.payable)}</p>
  <div class="kpis">
    ${kpi('과세가액', eok(r.taxable))}
    ${kpi('상속공제', eok(r.deduction))}
    ${kpi('과세표준', eok(r.base))}
    ${kpi('상속재산 대비', pct(r.effectiveRate, 2))}
  </div>`;
  r.warnings.forEach((w) => { html += `<div class="note">${esc(w)}</div>`; });
  if (r.belowMin) html += `<p class="ok">과세표준이 50만원 미만이라 상속세가 없습니다 (${lawLink('상속세 및 증여세법 제25조②')}).</p>`;
  const lumpName = { lump: '일괄공제', 'lump-nofile': '일괄공제 (무신고)', itemized: '기초공제 + 인적공제', 'itemized-sole': '기초공제 + 인적공제 (배우자 단독상속)' }[r.lumpChoice];
  const ded = [
    [lumpName, r.basicDed, r.lumpChoice.startsWith('lump') ? LAW.lumpSum : LAW.personal],
    ['배우자 상속공제', r.spouseDed, LAW.spouse],
    ['금융재산 상속공제', r.finDed, LAW.financial],
    ['동거주택 상속공제', r.houseDed, LAW.house],
  ].filter(([, a]) => a);
  html += `<div class="table-scroll"><table><thead><tr><th>항목</th><th class="num">금액</th><th>근거</th></tr></thead><tbody>
  <tr><td>상속재산 (추정상속재산 포함)</td><td class="num">${won(r.estate)}</td><td></td></tr>
  <tr><td>공과금·채무</td><td class="num">−${won(r.publicCharges + r.debts)}</td><td class="small">${lawLinkS(LAW.debts)}</td></tr>
  <tr><td>장례비용</td><td class="num">−${won(r.funeral)}</td><td class="small">${lawLinkS(LAW.funeral)}</td></tr>
  ${r.gifts ? `<tr><td>사전증여재산 가산</td><td class="num">+${won(r.gifts)}</td><td class="small">${lawLinkS(LAW.priorGift)}</td></tr>` : ''}
  <tr><td><strong>과세가액</strong></td><td class="num"><strong>${won(r.taxable)}</strong></td><td></td></tr>
  ${ded.map(([n, a, l]) => `<tr><td>${esc(n)}</td><td class="num">−${won(a)}</td><td class="small">${lawLinkS(l)}</td></tr>`).join('')}
  ${r.limited ? `<tr><td>종합한도 초과분 (공제 못 받음)</td><td class="num">+${won(r.sumDed - r.deduction)}</td><td class="small">${lawLinkS(LAW.limit)}</td></tr>` : ''}
  <tr><td><strong>과세표준</strong></td><td class="num"><strong>${won(r.base)}</strong></td><td></td></tr>
  <tr><td>산출세액</td><td class="num">${won(r.computedTax)}</td><td class="small">${lawLinkS(LAW.rates)}</td></tr>
  ${r.giftCredit ? `<tr><td>증여세액공제</td><td class="num">−${won(r.giftCredit)}</td><td class="small">${lawLinkS(LAW.giftCredit)}</td></tr>` : ''}
  <tr><td>신고세액공제 3%</td><td class="num">−${won(r.filingCredit)}</td><td class="small">${lawLinkS(LAW.filing)}</td></tr>
  </tbody><tfoot><tr><td>납부할 세액</td><td class="num">${won(r.payable)}</td><td></td></tr></tfoot></table></div>`;

  const P = r.personal;
  const steps = [
    `과세가액 = 상속재산 ${won(r.estate)} − 공과금 ${won(r.publicCharges)} − 채무 ${won(r.debts)} − 장례비 ${won(r.funeral)} (500만~1천만원 + 봉안 500만원) + 사전증여 ${won(r.gifts)} (상속인 10년 ${won(r.giftsToHeirs)}, 그 외 5년 ${won(r.giftsToOthers)}) = ${won(r.taxable)}`,
    `기초공제 2억원 + 인적공제 ${won(P.total)} (자녀 ${won(P.child)}, 미성년자 ${won(P.minor)}, 65세 이상 ${won(P.elderly)}, 장애인 ${won(P.disabled)}) = ${won(r.basicPlus)} ${r.lumpChoice === 'itemized-sole' ? '→ 배우자 단독상속이라 일괄공제 불가 (제21조②)' : r.lumpChoice === 'lump-nofile' ? '→ 무신고 시 일괄공제 5억원 (제21조① 단서)' : r.lumpChoice === 'lump' ? '< 5억원 → 일괄공제 5억원' : '> 5억원 → 기초+인적공제'}`,
  ];
  if (r.spouse) {
    const s = r.spouseInfo;
    steps.push(`배우자공제 한도 = (상속재산 − 공과금·채무 − 비상속인 유증 + 상속인 사전증여) ${won(s.baseForLimit)} × 법정상속분 ${shareText(r.coHeirs)} − 배우자 사전증여 과세표준 = ${won(s.legalLimit)} → 30억원과 비교해 ${won(s.limit)}`);
    steps.push(`배우자 실제 상속 ${won(s.actual)} → ${s.actual < s.min ? '5억원 미만이라 최소 5억원' : `min(실제, 한도) (최소 5억원)`} = ${won(r.spouseDed)} (${lawLink(LAW.spouse)})`);
  }
  steps.push(`금융재산공제: 순금융재산 ${won(r.netFinancial)} → ${won(r.finDed)} (2천만원 이하 전액, 1억원까지 2천만원, 초과 20%, 한도 2억원)`);
  if (r.houseDed) steps.push(`동거주택 상속공제: 주택가액 100%, 6억원 한도 → ${won(r.houseDed)}`);
  steps.push(`공제 합계 ${won(r.sumDed)}, 종합한도 = 과세가액 − 비상속인 유증 − ${r.limitGift ? `사전증여(증여공제 차감) ${won(r.limitGift)}` : '사전증여분(과세가액 5억원 이하면 차감 안 함)'} = ${won(r.aggLimit)} → 공제 ${won(r.deduction)}`);
  steps.push(`산출세액 = ${won(r.base)} × ${pct(r.rate, 0)} − 누진공제 ${won(r.progressiveDeduct)} = ${won(r.computedTax)}`);
  if (r.giftCredit) steps.push(`증여세액공제 ${won(r.giftCredit)} (사전증여분 증여세 산출세액, 한도 = 산출세액 × 증여 과세표준 ÷ 상속 과세표준)`);
  steps.push(r.fileOnTime ? `신고세액공제 = (산출세액 − 증여세액공제) × 3% = ${won(r.filingCredit)}` : '기한 내 신고하지 않으면 신고세액공제가 없고 무신고·납부지연 가산세가 붙습니다 (가산세는 계산하지 않음)');
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">재산 평가(시가·기준시가), 가업·영농상속공제, 세대생략 할증, 상속인별 세액 안분은 반영하지 않습니다. 상속세는 상속인들이 받은 재산 비율로 나눠 내되 연대납세의무가 있습니다.</p>';
  return html;
}

const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };

bindCalculator({
  defaults: { assets: '1500000000', financialAssets: '300000000', debts: '0', publicCharges: '0', funeral: '0', spouse: true, spouseActual: '500000000', children: '2', ascendantHeirs: '0', elderly: '0', fileOnTime: true },
  compute: (v) => calcInheritanceTax(v),
  render,
  onChange: (form) => show('spouse-wrap', form.querySelector('[name=spouse]')?.checked),
});
