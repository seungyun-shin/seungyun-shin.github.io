import { calcCarTax } from '../lib/car-tax.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const p = (r, d = 2) => `${(r * 100).toLocaleString('ko-KR', { maximumFractionDigits: d })}%`;
const MONTH = { 1: '1월 16~31일', 3: '3월 16~31일', 6: '6월 16~30일', 9: '9월 16~30일' };

function render(r) {
  const pp = r.prepay;
  let html = `<h2>계산 결과</h2><p>${r.taxYear}년 자동차세 + 지방교육세 (연간, 연납 안 할 때)</p><p class="big">${won(r.total)}</p>
  <div class="kpis">
    ${kpi('자동차세', won(r.carTax))}
    ${kpi('지방교육세 (30%)', won(r.eduTax))}
    ${kpi('6월 고지 (1~6월분)', won(r.half1 + r.eduHalves[0]))}
    ${kpi('12월 고지 (7~12월분)', won(r.half2 + r.eduHalves[1]))}
  </div>`;
  if (pp) {
    html += `<h3>${MONTH[pp.month]} 연납</h3><div class="kpis">
      ${kpi('연납 때 낼 금액', `<strong>${won(pp.paidTotal)}</strong>`)}
      ${pp.regular ? kpi('6월 정기분 (별도)', won(pp.regular)) : ''}
      ${kpi('연간 합계', won(pp.yearTotal))}
      ${kpi('절약', `${won(pp.saved)} <small class="muted small">(${p(pp.effectiveRate)})</small>`)}
    </div>`;
  }
  for (const w of r.warnings) html += `<div class="note">${esc(w)}</div>`;
  const steps = [];
  if (r.fuel === 'electric') {
    steps.push(`그 밖의 승용자동차(전기·태양열·알코올) 비영업용 연세액 ${won(r.annualBase)} (지방세법 제127조①3호), 차령 경감 없음`);
  } else {
    steps.push(`연세액 A = ${num(r.cc)}cc × ${won(r.perCc)} = ${won(r.annualBase)} (제127조①1호)`);
    steps.push(`차령: 최초 등록 ${r.regYear}년 ${r.regMonth}월 → 상반기 ${r.age1}년, 하반기 ${r.age2}년 (시행령 제122조②)`);
    steps.push(r.relief1 || r.relief2
      ? `기분세액 = A/2 − A/2 × 5% × (차령 − 2): 상반기 ${p(r.relief1)} 경감 ${won(r.half1)}, 하반기 ${p(r.relief2)} 경감 ${won(r.half2)} (제127조①2호, 차령 12년 초과는 12년)`
      : `차령 2년 이하라 경감 없음 → 상·하반기 각 ${won(r.half1)}`);
  }
  steps.push(`지방교육세 = 자동차세 × 30% → 상반기 ${won(r.eduHalves[0])}, 하반기 ${won(r.eduHalves[1])} (제151조①7호)`);
  if (pp) {
    const f = pp.month === 6
      ? `하반기분 ${won(pp.base)} × ${p(pp.rate)}`
      : `${pp.month === 9 ? '하반기분' : '연세액'} ${won(pp.base)} × ${pp.days}일/${pp.denom}일 × ${p(pp.rate)}`;
    steps.push(`연납 공제 = ${f} = ${won(pp.deduction)} (제128조③, 이자율 ${pp.userRate ? '직접 입력' : '시행령 제125조⑥'})`);
    steps.push(`연납 자동차세 ${won(pp.paidTax)} + 지방교육세 ${won(pp.paidEdu)} = ${won(pp.paidTotal)} (10원 미만 절사)`);
  }
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">비영업용 승용차, 표준세율, 1년 내내 소유한 경우 기준입니다. 조례로 세율을 올린 지역·감면 대상은 고지서와 다를 수 있습니다.</p>';
  return html;
}

bindCalculator({
  defaults: { fuel: 'engine', cc: '1998', regDate: '2022-03-15', taxYear: '2026', prepayMonth: '1', prepayRatePct: '' },
  compute: (v) => calcCarTax(v),
  render,
  validUntil: '2027-12-31',
  onChange: (form) => {
    document.getElementById('cc-wrap').hidden = form.querySelector('[name=fuel]:checked')?.value === 'electric';
  },
});
