import { calcYearEnd, LAW } from '../lib/year-end-tax.js';
import { TAX_BRACKETS } from '../lib/income-tax.js';
import { bindCalculator, won, pct, kpi, basisBlock, esc } from './common.js';

const lawLink = (label) => {
  const m = String(label).match(/^(소득세법|조세특례제한법|지방세법) 제(\d+)조(의\d+)?/);
  if (!m) return esc(label);
  const name = m[1].replace(/ /g, '');
  return `<a href="https://www.law.go.kr/법령/${name}/제${m[2]}조${m[3] || ''}" target="_blank" rel="noopener">${esc(label)}</a>`;
};

function bracketText(base) {
  for (const [lim, r, q] of TAX_BRACKETS) {
    if (base <= lim) return `${won(base)} × ${pct(r, 0)}${q ? ` − 누진공제 ${won(q)}` : ''}`;
  }
  return '';
}

function render(r) {
  const c = r.chosen;
  const refund = r.total < 0;
  const head = r.total === 0 ? '추가납부·환급 없음' : refund ? '예상 환급액 (소득세+지방소득세)' : '예상 추가납부액 (소득세+지방소득세)';
  let html = `<h2>계산 결과</h2>
  <p>${head}</p><p class="big">${won(Math.abs(r.total))}${r.total !== 0 ? ` <small>${refund ? '환급' : '추가납부'}</small>` : ''}</p>
  <div class="kpis">
    ${kpi('결정세액 (소득세)', won(r.decided))}
    ${kpi('지방소득세', won(r.localDecided))}
    ${kpi('기납부 소득세', won(r.prepaid.tax) + (r.prepaid.mode === 'estimate' ? ' <span class="small muted">추정</span>' : ''))}
    ${kpi('실효세율 (결정세액÷총급여)', pct(r.decided / r.salary, 2))}
  </div>
  <div class="table-scroll"><table style="font-size:13px"><thead><tr><th class="nowrap">구분</th><th class="num">결정</th><th class="num">기납부</th><th class="num">차감</th></tr></thead><tbody>
  <tr><td class="nowrap">소득세</td><td class="num">${won(r.decided)}</td><td class="num">${won(r.prepaid.tax)}</td><td class="num">${won(r.diff)}</td></tr>
  <tr><td class="nowrap">지방소득세</td><td class="num">${won(r.localDecided)}</td><td class="num">${won(r.prepaid.local)}</td><td class="num">${won(r.diffLocal)}</td></tr>
  </tbody><tfoot><tr><td>합계</td><td class="num">${won(r.decided + r.localDecided)}</td><td class="num">${won(r.prepaid.tax + r.prepaid.local)}</td><td class="num">${won(r.total)}</td></tr></tfoot></table></div>`;
  html += `<p class="small muted">차감 = 결정 − 기납부. 양수는 추가납부, 음수는 환급입니다.</p>`;
  if (r.smallExempt) html += `<p class="small muted">소득세 추가납부액이 1천원 미만이라 징수하지 않습니다 (${lawLink('소득세법 제86조')}).</p>`;
  if (!c.itemized) html += `<p class="ok">특별공제를 받는 것보다 <strong>표준세액공제 13만원</strong>이 유리해 표준세액공제로 계산했습니다 (항목별 공제 시 결정세액 ${won(r.itemized.decided)}).</p>`;

  // 소득공제 내역
  const card = r.card;
  const dedRows = [
    ['근로소득공제', r.eid, LAW.eid],
    ['인적공제 (기본·추가)', r.personal.amount, LAW.personal],
    ['연금보험료공제 (국민연금)', r.insurance.pension, LAW.pension],
    ['건강·장기요양·고용보험료', c.itemized ? r.insurance.health + r.insurance.employment : 0, LAW.insurance],
    ['주택임차차입금 원리금', c.itemized ? r.housing.rentLoan : 0, LAW.rentLoan],
    ['장기주택저당차입금 이자', c.itemized ? r.housing.mortgage : 0, LAW.mortgage],
    ['주택청약종합저축', r.housing.sub, LAW.subscription],
    ['신용카드 등 사용액', card.amount, LAW.card],
  ];
  if (c.aggExcess) dedRows.push(['소득공제 종합한도 초과액', -c.aggExcess, LAW.aggregate]);
  html += `<h3>소득공제</h3><div class="table-scroll"><table><thead><tr><th>항목</th><th class="num">공제액</th><th>근거</th></tr></thead><tbody>
  <tr><td>총급여</td><td class="num">${won(r.salary)}</td><td></td></tr>
  ${dedRows.filter(([, a]) => a).map(([n, a, l]) => `<tr><td>${n}</td><td class="num">${a < 0 ? '+' + won(-a) : '−' + won(a)}</td><td class="small">${lawLink(l)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td>과세표준</td><td class="num">${won(c.base)}</td><td></td></tr></tfoot></table></div>`;

  // 세액공제 내역
  const creds = c.credits.filter((x) => x.amount > 0);
  html += `<h3>세액공제</h3><div class="table-scroll"><table><thead><tr><th>항목</th><th class="num">적용액</th><th>근거</th></tr></thead><tbody>
  <tr><td>산출세액</td><td class="num">${won(c.tax)}</td><td class="small">${lawLink(LAW.rates)}</td></tr>
  ${creds.map((x) => `<tr><td>${x.name}${x.applied < x.amount ? `<div class="small muted">공제액 ${won(x.amount)} 중 산출세액 한도까지</div>` : ''}</td><td class="num">−${won(x.applied)}</td><td class="small">${lawLink(x.law)}</td></tr>`).join('')}
  </tbody><tfoot><tr><td>결정세액</td><td class="num">${won(r.decided)}</td><td></td></tr></tfoot></table></div>`;
  const lost = creds.reduce((s, x) => s + x.amount - x.applied, 0);
  if (lost > 0) html += `<p class="small muted">세액공제 합계가 산출세액보다 커서 ${won(lost)}은 적용되지 않습니다 (${lawLink(LAW.cap)}). 기부금 한도·산출세액 초과분은 10년간 이월할 수 있습니다.</p>`;

  // 계산 근거
  const P = r.personal;
  const pers = [`기본공제 150만원 × ${r.family}명 = ${won(P.basic)}`];
  if (P.elderly) pers.push(`경로우대 ${won(P.elderly)}`);
  if (P.disabled) pers.push(`장애인 ${won(P.disabled)}`);
  if (P.woman) pers.push(`부녀자 ${won(P.woman)}`);
  if (P.singleParent) pers.push(`한부모 ${won(P.singleParent)}`);
  const steps = [
    `근로소득공제 ${won(r.eid)} (${lawLink(LAW.eid)}, 한도 2천만원) → 근로소득금액 = ${won(r.salary)} − ${won(r.eid)} = ${won(r.earned)}`,
    `인적공제: ${pers.join(' + ')}${P.raw > P.amount ? ` → 근로소득금액 한도로 ${won(P.amount)}` : ''}${P.womanRequested && !P.woman && !P.singleParent ? ' (근로소득금액 3천만원 초과라 부녀자 공제 제외)' : ''}`,
    `4대보험 ${r.insurance.mode === 'auto' ? `자동 추정 (월 ${won(r.insurance.estimate.monthly)}, 2026년 요율, 국민연금 7월 상·하한 변경 반영)` : '직접 입력'}: 국민연금 ${won(r.insurance.pension)}, 건강·장기요양 ${won(r.insurance.health)}, 고용 ${won(r.insurance.employment)}`,
  ];
  if (r.housing.rentLoanRaw || r.housing.subRaw || r.housing.mortgage) {
    steps.push(`주택자금: 임차차입금 원리금 40% ${won(r.housing.rentLoanRaw)} + 청약 40% ${won(r.housing.subRaw)}${r.housing.subEligible ? '' : ' (총급여 7천만원 초과라 청약 공제 없음)'} → 합계 400만원 한도 적용 후 ${won(r.housing.rentLoan + r.housing.sub)}; 장기주택저당 이자 ${won(r.housing.mortgage)} (한도 ${won(r.housing.mortgageCap)}, 청약·임차 공제와 합산)`);
  }
  if (card.total) {
    if (card.case === 'below') steps.push(`신용카드 등 ${won(card.total)}이 최저사용금액(총급여 25%) ${won(card.minUse)} 이하라 공제 없음`);
    else {
      steps.push(`신용카드 등 사용액 ${won(card.total)} − 최저사용금액 ${won(card.minUse)}: 공제율 적용액 ${won(card.gross)} − 최저사용금액분 ${won(card.minus)} = 공제가능 ${won(card.possible)}`);
      steps.push(`카드 한도: 기본 ${won(card.baseLimit)}${card.kids ? ` (20세 이하 자녀 ${card.kids}명 반영)` : ''} + 추가 ${won(card.extra)} (전통시장·대중교통${card.under7 ? '·문화체육' : ''} 공제액 ${won(card.extraLimit)}까지) = ${won(card.amount)}`);
      if (card.cultureAsDebit) steps.push('총급여 7천만원 초과: 문화체육 사용분은 별도 공제율이 없어 체크카드·현금영수증(30%) 결제로 보고 계산');
    }
  }
  steps.push(`산출세액 = ${bracketText(c.base)} = ${won(c.tax)} (${lawLink(LAW.rates)})`);
  steps.push(`근로소득세액공제 ${won(c.eic.raw)} (130만원까지 55%, 초과분 30%) → 총급여 ${won(r.salary)}의 한도 ${won(c.eic.limit)} → ${won(c.eic.amount)}`);
  if (r.kidsA || c.birth) steps.push(`자녀세액공제: 2006~2016년생 ${r.kidsA}명 ${won(c.child)}${c.birth ? ` + 출산·입양 ${won(c.birth)}` : ''} (2026년은 9세 이상, 2017년생 제외)`);
  else if (r.kidsB) steps.push(`2017~2018년생 자녀 ${r.kidsB}명은 2026년 자녀세액공제 대상이 아닙니다 (법률 제21548호 부칙 제2조)`);
  if (c.paBase) steps.push(`연금계좌 ${won(c.paBase)} × ${pct(c.paRate, 0)} = ${won(c.pensionAcct)}`);
  if (c.med.spent) steps.push(`의료비: 총급여 3% ${won(c.med.threshold)} 차감 후 대상액 일반 ${won(c.med.general)} · 본인 등 ${won(c.med.special)} · 미숙아 ${won(c.med.premature)} · 난임 ${won(c.med.infertility)} → ${won(c.med.amount)}`);
  if (c.edu.target) steps.push(`교육비 대상액 ${won(c.edu.target)} × 15% = ${won(c.edu.amount)} (취학전·초중고 1명당 300만원, 대학생 900만원 한도 적용)`);
  if (c.pol.allowed || c.home.allowed) steps.push(`정치자금 ${won(c.pol.allowed)} → ${won(c.pol.amount)}, 고향사랑 ${won(c.home.allowed)} → ${won(c.home.amount)} (10만원까지 100/110)`);
  if (c.don.target || c.don.carryForward) steps.push(`특례 ${won(c.don.specialAllowed)} + 일반 ${won(c.don.generalAllowed)} (일반 한도 ${won(c.don.generalLimit)}) → 1천만원까지 15%, 초과 30% = ${won(c.don.amount)}${c.don.carryForward ? `, 한도 초과 ${won(c.don.carryForward)}은 다음 해로 이월` : ''}`);
  if (c.rent) steps.push(`월세 min(지급액, 1천만원) × ${pct(c.rentRate, 0)} = ${won(c.rent)}`);
  else if (!c.rentEligible) steps.push('총급여 8천만원 초과라 월세 세액공제 대상이 아닙니다');
  steps.push(`결정세액 ${won(r.decided)} → 지방소득세 = 결정세액 × 10% = ${won(r.localDecided)} (${lawLink(LAW.local)})`);
  if (r.prepaid.mode === 'estimate') {
    const e = r.prepaid.estimate;
    steps.push(`기납부세액 추정: 월급여 ${won(e.monthly)}, 공제대상가족 ${r.family}명, 8~20세 자녀 ${r.kaniKids}명 → 1~2월 ${won(e.janFeb)} × 2 (개정 전 자녀공제 ${won(e.oldDed)}) + 3~12월 ${won(e.marDec)} × 10 = ${won(e.tax)}`);
  }
  steps.push(`차감징수세액 = 결정세액 − 기납부세액 = ${won(r.diff)} (원 미만 절사, 추가납부 1천원 미만은 0)`);
  html += basisBlock('계산 근거 펼치기', steps);
  html += '<p class="small muted">중도 입사·이직, 종전 근무지 합산, 감면(중소기업 취업자 등), 외국인 단일세율, 우리사주·벤처투자 공제는 반영하지 않습니다. 공제 요건(무주택·부양가족 소득 등)은 직접 확인하세요.</p>';
  return html;
}

const show = (id, on) => { const el = document.getElementById(id); if (el) el.hidden = !on; };

bindCalculator({
  defaults: {
    salary: '50000000', prepaidMode: 'estimate', basicCount: '1', elderly: '0', disabled: '0',
    kidsCredit: '0', kids2017: '0', kidsYoung: '0', birthOrder: '0', birthCount: '1',
    insuranceMode: 'auto', mortgageType: 'other15',
    cardCredit: '15000000', cardDebit: '5000000',
  },
  // 2026년 귀속 연말정산은 2027년 1~2월 정산, 5월 종합소득세 확정신고까지 쓰인다
  validUntil: '2027-05-31',
  compute: (v) => calcYearEnd(v),
  render,
  onChange: (form) => {
    show('prepaid-wrap', form.querySelector('[name=prepaidMode]:checked')?.value === 'manual');
    show('ins-wrap', form.querySelector('[name=insuranceMode]:checked')?.value === 'manual');
  },
});
