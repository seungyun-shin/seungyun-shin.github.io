// 육아휴직급여 — 고용보험법 시행령 제95조(일반), 6+6 부모육아휴직제 특례, 한부모 특례 (2025-01-01 시행 체계)
import { RATES } from '../rates/2026.js';

const P = () => RATES.parental;

/** 일반 육아휴직급여: i번째 달(1부터) */
export function generalMonth(i, wage) {
  const g = P().general.value;
  const band = i <= 3 ? g[0] : i <= 6 ? g[1] : g[2];
  const raw = wage * band.rate;
  const amt = Math.max(P().floor.value, Math.min(raw, band.cap));
  return { month: i, rate: band.rate, cap: band.cap, amount: Math.floor(amt), rule: band.label };
}

/** 한부모 특례: 1~3개월 100%·상한 300만원, 이후 일반과 같음 */
export function singleParentMonth(i, wage) {
  if (i > 3) return generalMonth(i, wage);
  const cap = P().singleParentCap.value;
  return { month: i, rate: 1, cap, amount: Math.floor(Math.max(P().floor.value, Math.min(wage, cap))), rule: '한부모 특례(1~3개월)' };
}

/** 6+6 특례: i번째 달(1~6), 상한 250/250/300/350/400/450만원, 통상임금 100% */
export function sixSixMonth(i, wage) {
  const caps = P().sixSixCaps.value;
  const cap = caps[i - 1];
  return { month: i, rate: 1, cap, amount: Math.floor(Math.max(P().floor.value, Math.min(wage, cap))), rule: '6+6 부모육아휴직제 특례' };
}

/**
 * @param {object} p
 * @param {'general'|'sixsix'|'single'} p.mode
 * @param {number} p.wageA 부모 A(본인) 월 통상임금
 * @param {number} p.monthsA 사용 개월 수
 * @param {number} [p.wageB] 부모 B 월 통상임금 (6+6)
 * @param {number} [p.monthsB] 부모 B 사용 개월 수 (6+6)
 */
export function calcParentalLeave(p) {
  const mode = p.mode || 'general';
  const mA = Math.max(0, Math.min(18, Math.floor(Number(p.monthsA) || 0)));
  const wA = Math.max(0, Number(p.wageA) || 0);
  if (!mA) throw new Error('육아휴직 사용 개월 수를 입력하세요.');
  if (!wA) throw new Error('월 통상임금을 입력하세요.');
  const warnings = [];
  const plan = (wage, months, otherMonths) => {
    const rows = [];
    const overlap = mode === 'sixsix' ? Math.min(6, months, otherMonths) : 0;
    for (let i = 1; i <= months; i++) {
      if (mode === 'sixsix' && i <= overlap) rows.push(sixSixMonth(i, wage));
      else if (mode === 'single') rows.push(singleParentMonth(i, wage));
      else rows.push(generalMonth(i, wage));
    }
    return { rows, total: rows.reduce((s, r) => s + r.amount, 0), overlap };
  };
  let a; let b = null;
  if (mode === 'sixsix') {
    const mB = Math.max(0, Math.min(18, Math.floor(Number(p.monthsB) || 0)));
    const wB = Math.max(0, Number(p.wageB) || 0);
    if (!mB || !wB) throw new Error('6+6은 배우자의 통상임금과 사용 개월 수도 입력해야 합니다.');
    a = plan(wA, mA, mB);
    b = plan(wB, mB, mA);
    if (mA > 12 && mB < 3) warnings.push('부모 모두 3개월 이상 사용해야 1년 6개월까지 연장할 수 있습니다.');
    if (mB > 12 && mA < 3) warnings.push('부모 모두 3개월 이상 사용해야 1년 6개월까지 연장할 수 있습니다.');
  } else {
    a = plan(wA, mA, 0);
    if (mA > 12 && mode !== 'single') warnings.push('12개월을 넘는 기간(최대 18개월)은 부모가 각각 3개월 이상 육아휴직을 쓰거나, 한부모·중증장애아동 부모인 경우에만 쓸 수 있습니다.');
  }
  return { mode, a, b, total: a.total + (b ? b.total : 0), warnings };
}
