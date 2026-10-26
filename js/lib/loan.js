// 대출 원리금 계산 — 원리금균등·원금균등·만기일시, 거치기간
// 월 이자 = 대출 잔액 × 연이율 ÷ 12 (원 미만 반올림). 실제 은행은 일수(실제 일수 ÷ 365)로 이자를 계산하는 경우가 많아
// 달마다 몇 원~몇백 원 차이가 날 수 있다. 법령에 정해진 상환액 산식은 없다(수학 공식).

export const METHODS = {
  equalPayment: '원리금균등',
  equalPrincipal: '원금균등',
  bullet: '만기일시',
};

const toNum = (v, d = 0) => {
  if (v === '' || v == null) return d;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** 원리금균등 월 상환액 (반올림 전) */
export function annuityPayment(principal, monthlyRate, months) {
  if (months <= 0) throw new Error('상환 개월 수는 1 이상이어야 합니다.');
  if (monthlyRate === 0) return principal / months;
  const f = (1 + monthlyRate) ** months;
  return (principal * monthlyRate * f) / (f - 1);
}

/**
 * @param {object} i
 * @param {number} i.principal 대출 원금(원)
 * @param {number} i.annualRate 연 이율(%) 예: 4.5
 * @param {number} i.months 대출 기간(개월, 거치기간 포함)
 * @param {number} [i.graceMonths] 거치기간(개월) — 이자만 내는 기간. 만기일시에는 의미 없음
 * @param {'equalPayment'|'equalPrincipal'|'bullet'} i.method
 */
export function calcLoan(i) {
  const principal = Math.round(toNum(i.principal));
  const annualRate = toNum(i.annualRate);
  const months = toNum(i.months);
  const method = i.method || 'equalPayment';
  let grace = toNum(i.graceMonths, 0);
  if (!METHODS[method]) throw new Error(`상환 방식이 올바르지 않습니다: ${method}`);
  if (!(principal > 0)) throw new Error('대출 원금을 입력하세요.');
  if (!(annualRate >= 0) || annualRate > 100) throw new Error('연 이율은 0~100% 사이로 입력하세요.');
  if (!Number.isInteger(months) || months < 1 || months > 600) throw new Error('대출 기간은 1~600개월(50년) 사이의 정수로 입력하세요.');
  if (!Number.isInteger(grace) || grace < 0) throw new Error('거치기간은 0 이상의 정수(개월)로 입력하세요.');
  if (method === 'bullet') grace = 0;
  if (grace >= months) throw new Error('거치기간은 대출 기간보다 짧아야 합니다.');

  const r = annualRate / 100 / 12;
  const repayMonths = months - grace;
  const regularPayment = method === 'equalPayment' ? Math.round(annuityPayment(principal, r, repayMonths)) : null;
  const regularPrincipal = method === 'equalPrincipal' ? Math.round(principal / repayMonths) : null;

  const schedule = [];
  let balance = principal;
  for (let n = 1; n <= months; n++) {
    const interest = Math.round(balance * r);
    let princ;
    if (n <= grace) princ = 0;
    else if (n === months) princ = balance; // 마지막 달에 끝수 정리
    else if (method === 'equalPayment') princ = Math.min(balance, Math.max(0, regularPayment - interest));
    else if (method === 'equalPrincipal') princ = Math.min(balance, regularPrincipal);
    else princ = 0; // 만기일시
    balance -= princ;
    schedule.push({ n, payment: princ + interest, principal: princ, interest, balance, grace: n <= grace });
  }

  const totalInterest = schedule.reduce((s, x) => s + x.interest, 0);
  const firstRepay = schedule[grace];
  return {
    principal, annualRate, months, graceMonths: grace, repayMonths, method, methodName: METHODS[method],
    monthlyRate: r,
    regularPayment, regularPrincipal,
    graceInterest: grace ? schedule[0].interest : 0,
    firstPayment: schedule[0].payment,
    firstRepayPayment: firstRepay.payment,
    lastPayment: schedule[months - 1].payment,
    maxPayment: Math.max(...schedule.map((x) => x.payment)),
    totalInterest,
    totalPayment: principal + totalInterest,
    interestCapExceeded: annualRate > 20,
    schedule,
  };
}
