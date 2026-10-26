import { calcFreelancerTax } from '../lib/freelancer-tax.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const pct = (r, d = 1) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;
const settle = (n) => (n < 0 ? `환급 ${won(-n)}` : n > 0 ? `추가납부 ${won(n)}` : '0원');

function render(r) {
  const ind = r.industry;
  let html = `<h2>계산 결과 — 추정</h2><p>종합소득세 + 지방소득세 정산 (추정)</p><p class="big">${settle(r.totalDiff)}</p>
  <div class="kpis">
    ${kpi('소득세', settle(r.diff))}
    ${kpi('지방소득세', settle(r.localDiff))}
    ${kpi('결정세액 (소득세)', won(r.decided))}
    ${kpi('이미 떼인 3% (소득세)', won(r.withheld))}
  </div>
  <p class="small muted">${esc(ind.code)} ${esc(ind.name)} · ${r.methodName} 추계 · ${r.bookType} · 실효세율 ${pct(r.effectiveRate, 2)}</p>`;
  html += '<div class="note">이 결과는 장부 없이 경비율로 신고한다고 보고 계산한 <strong>추정치</strong>입니다. 장부를 써서 실제 경비로 신고하거나, 다른 소득·공제가 있으면 결과가 달라집니다.</div>';
  if (r.penalty) html += `<div class="note">직전 연도 수입이 4,800만원 이상이라 장부 없이 신고하면 무기장가산세 ${won(r.penalty)}(산출세액의 20%, 소득세법 제81조의5)가 붙는 것으로 계산했습니다.</div>`;
  if (r.bookType === '복식부기의무자') html += '<div class="note">직전 연도 수입이 7,500만원 이상인 복식부기의무자입니다. 장부·재무제표 없이 신고하면 신고하지 않은 것으로 보아(소득세법 제70조④) 무신고가산세 등이 더 붙을 수 있습니다 — 이 계산기는 반영하지 않습니다. 세무사와 확인하세요.</div>';
  const t = 40000000;
  const steps = [];
  if (r.method === 'simple') {
    steps.push(`단순경비율 대상: ${r.isNew ? '신규 사업자' : `직전 연도 수입 ${won(r.prevRevenue)} < 3,600만원`}, 올해 수입 ${won(r.revenue)} < 7,500만원 (시행령 제143조④)`);
    steps.push(`경비 = ${won(Math.min(r.revenue, t))} × ${pct(ind.simpleBase)}${r.revenue > t ? ` + ${won(r.revenue - t)} × ${pct(ind.simpleExcess)}(초과율)` : ''} = ${won(r.simpleExpense)} (경비율 고시 제4조)`);
    steps.push(`소득금액 = ${won(r.revenue)} − ${won(r.simpleExpense)} = ${won(r.income)}`);
  } else {
    steps.push(`기준경비율 대상: 직전 연도 수입 ${won(r.prevRevenue)} ≥ 3,600만원${r.revenue >= 75000000 ? ' 또는 올해 수입 7,500만원 이상' : ''}`);
    steps.push(`기준경비율 소득금액 = ${won(r.revenue)} − 주요경비 ${won(r.majorExpenses)} − ${won(r.revenue)} × ${pct(r.stdRateApplied, 2)}${r.bookType === '복식부기의무자' ? '(기준경비율의 1/2)' : ''} = ${won(r.standardRaw)}`);
    steps.push(`배율 비교: 단순경비율 소득금액 ${won(r.simpleIncome)} × ${num(r.multiplier, 1)} = ${won(r.capByMultiplier)} → ${r.standardCapped ? '배율 금액 적용' : '기준경비율 금액 적용'} → 소득금액 ${won(r.income)} (시행령 제143조③, 시행규칙 제67조)`);
  }
  steps.push(`소득공제 = 기본공제 ${r.persons}명 × 150만원${r.pension ? ` + 연금보험료 ${won(r.pension)}` : ''} = ${won(r.deductions)} → 과세표준 ${won(r.taxBase)}`);
  steps.push(`산출세액 ${won(r.computed)} (소득세법 제55조 기본세율) − 표준세액공제 ${won(r.credit)}${r.penalty ? ` + 무기장가산세 ${won(r.penalty)}` : ''} = 결정세액 ${won(r.decided)}`);
  steps.push(`소득세 정산 = ${won(r.decided)} − 기납부 ${won(r.withheld)}${r.withheldGiven ? '(입력값)' : '(수입 × 3%)'} = ${settle(r.diff)} (10원 미만 절사)`);
  steps.push(`지방소득세 = 결정세액 × 10% ≈ ${won(r.localDecided)} − 기납부 ${won(r.localWithheld)} = ${settle(r.localDiff)} (추정)`);
  html += basisBlock('계산 근거 펼치기', steps, true);
  return html;
}

bindCalculator({
  defaults: { industry: '940909', revenue: '30000000', prevRevenue: '20000000', isNew: false, persons: '1', pension: '0', majorExpenses: '0' },
  // 원천징수세액 칸을 비우면 '' 로 넘겨 수입 × 3%로 계산 (금액 칸은 빈 값이 0으로 읽힘)
  compute: (v) => calcFreelancerTax({ ...v, withheld: document.getElementById('withheld').value.trim() === '' ? '' : v.withheld }),
  render,
});
