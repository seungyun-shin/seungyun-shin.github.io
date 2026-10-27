// 주택분 종합부동산세·농어촌특별세 (개인)
//   과세표준: 종합부동산세법 제8조① — (공시가격 합계 − 1세대 1주택자 12억원 / 그 밖의 자 9억원) × 공정시장가액비율 60%(시행령 제2조의4)
//   세율: 제9조①1호(2주택 이하)·2호(3주택 이상) 누진세율
//   재산세 공제: 제9조③, 시행령 제4조의3① — 재산세 부과세액 합계 × (종부세 과세표준 × 재산세 공정시장가액비율 × 0.4%)
//                ÷ (주택을 합산하여 주택분 재산세 표준세율로 계산한 재산세 상당액)
//                분모는 시행규칙 신고서 작성방법 ⑧: [재산세 과세표준(= ② 감면 후 공시가격 합계 × 재산세 공정시장가액비율) × 세율 − 누진공제액]
//                → 공시가격 합계에 표준세율 누진표를 한 번 적용 (1주택이면 주택별 계산과 같음)
//   1세대 1주택자 세액공제: 제9조⑤~⑨ — 고령자 20·30·40%, 장기보유 20·40·50%, 합계 80% 한도
//   세부담상한: 제10조, 시행령 제5조 — (재산세 + 종부세)가 직전 연도 총세액상당액의 150%를 넘는 부분은 없는 것으로 봄
//   농어촌특별세: 농어촌특별세법 제5조①8호 — 납부할 종부세액 × 20%
//   납부: 제16조 12월 1~15일, 분납 제20조·시행령 제16조(250만원 초과, 6개월 이내)
//   끝수: 과세표준 1원 미만, 납부세액 10원 미만 절사 (국고금관리법 제47조). 중간 단계는 원 미만 절사(확인 필요)
import { RATES } from '../rates/2026.js';
import { calcPropertyTax, fairRatio, standardTax } from './property-tax.js';

const T = RATES.compTax;
const v = (k) => T[k].value;

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor10 = (x) => Math.floor(x / 10 + 1e-9) * 10;
const floor1 = (x) => Math.floor(x + 1e-9);
const bool = (x) => x === true || x === 'true' || x === '1' || x === 1;

/** 제9조① 누진세율 */
export function compRate(base, threePlus) {
  const table = threePlus ? v('rates3') : v('rates');
  for (const t of table) if (base <= t.upTo) return { tax: t.base + (base - t.from) * t.rate, rate: t.rate, from: t.from, base: t.base };
  throw new Error('세율표 오류');
}

/** 1세대 1주택자 세액공제율 (제9조⑥·⑧, ⑤ 합계 80%) */
export function oneHouseCreditRate(age, holdYears) {
  const pick = (list, key, x) => list.reduce((r, t) => (x >= t[key] ? t.rate : r), 0);
  const ageRate = pick(v('ageCredit'), 'minAge', age);
  const holdRate = pick(v('holdCredit'), 'minYears', holdYears);
  return { ageRate, holdRate, rate: Math.min(ageRate + holdRate, v('creditCap')) };
}

/**
 * 한 해 치 계산 (세부담상한 제외). 세부담상한의 직전 연도 세액상당액도 같은 함수로 구한다(시행령 제5조②).
 * @returns 과세표준·산출세액·재산세 공제·세액공제·종부세
 */
export function compCore({ prices, oneHouse, age, holdYears, paidPropertyTax, prevPrices }) {
  const sum = prices.reduce((s, x) => s + x, 0);
  const deduction = oneHouse ? v('deduction').oneHouse : v('deduction').general;
  const fair = v('fairRatio');
  const base = Math.max(0, floor1((sum - deduction) * fair));
  const threePlus = prices.length >= 3;
  const r = compRate(base, threePlus);
  const calcTax = floor1(r.tax);

  // 주택별 재산세 (지방세법 제112조①1호 본세). prevPrices 가 있으면 과세표준상한을 적용한 부과세액
  const houses = prices.map((price, i) => {
    const pt = calcPropertyTax({ price, oneHouse, urban: false, prevPrice: prevPrices ? prevPrices[i] : 0 });
    const ratio = fairRatio(price, oneHouse);
    return { price, ratio, propBase: pt.base, propertyTax: pt.mainTax, standardTax: floor1(standardTax(floor1(price * ratio))) };
  });
  const estPaid = houses.reduce((s, h) => s + h.propertyTax, 0);
  const paid = paidPropertyTax > 0 ? paidPropertyTax : estPaid;
  // 분자: 종부세 과세표준 × 재산세 공정시장가액비율 × 0.4% (1주택자는 그 주택의 비율, 다주택은 60%)
  const propRatio = oneHouse ? houses[0].ratio : fairRatio(1, false);
  const numerator = floor1(base * propRatio * v('propTaxCredit').topRate);
  // 분모: 주택을 합산하여 표준세율로 계산한 재산세 상당액 (시행령 제4조의3①, 작성방법 ⑧ — ②는 공시가격 합계)
  const denomBase = floor1(houses.reduce((s, h) => s + h.price * h.ratio, 0));
  const denominator = floor1(standardTax(denomBase));
  const propCredit = denominator > 0 ? Math.min(paid, floor1((paid * numerator) / denominator)) : 0;
  const afterProp = Math.max(0, calcTax - propCredit);

  const cr = oneHouse ? oneHouseCreditRate(age, holdYears) : { ageRate: 0, holdRate: 0, rate: 0 };
  const credit = floor1(afterProp * cr.rate);
  const tax = afterProp - credit;
  return {
    sum, deduction, fair, base, threePlus, bracketRate: r.rate, bracketFrom: r.from, bracketBase: r.base, calcTax,
    houses, estPaid, paid, propRatio, numerator, denomBase, denominator, propCredit, afterProp,
    ageRate: cr.ageRate, holdRate: cr.holdRate, creditRate: cr.rate, credit, tax,
  };
}

/**
 * @param {object} p
 * @param {number[]} [p.prices] 주택별 올해 공시가격 (또는 price1~price5)
 * @param {boolean} [p.oneHouse] 1세대 1주택자 (주택 1채일 때만)
 * @param {number} [p.age] 6월 1일 현재 만 나이 (1세대 1주택자)
 * @param {number} [p.holdYears] 6월 1일 현재 보유기간(년)
 * @param {number} [p.paidPropertyTax] 고지된 주택분 재산세(도시지역분 제외) 합계 — 비우면 계산값
 * @param {number[]} [p.prevPrices] 주택별 작년 공시가격 (또는 prev1~prev5) — 세부담상한·과세표준상한
 */
export function calcCompTax(p) {
  const list = (arr, key) => (Array.isArray(arr) ? arr : [1, 2, 3, 4, 5].map((i) => p[`${key}${i}`]));
  const rawPrices = list(p.prices, 'price').map((x) => Math.round(toNum(x)));
  const rawPrev = list(p.prevPrices, 'prev').map((x) => Math.round(toNum(x)));
  if (rawPrices.some((x) => !Number.isFinite(x) || x < 0) || rawPrev.some((x) => !Number.isFinite(x) || x < 0)) throw new Error('공시가격은 0 이상의 숫자로 입력하세요.');
  const idx = rawPrices.map((x, i) => (x > 0 ? i : -1)).filter((i) => i >= 0);
  const prices = idx.map((i) => rawPrices[i]);
  const prevPrices = idx.map((i) => rawPrev[i] || 0);
  if (!prices.length) throw new Error('주택 공시가격을 1채 이상 입력하세요.');
  if (prices.some((x) => x > 1e12)) throw new Error('공시가격이 너무 큽니다.');
  const warnings = [];
  let oneHouse = bool(p.oneHouse);
  if (oneHouse && prices.length > 1) {
    oneHouse = false;
    warnings.push('1세대 1주택자 공제(12억원)·세액공제는 주택이 1채일 때만 적용합니다. 일시적 2주택·상속주택·지방 저가주택 특례(제8조④)는 계산하지 않아 일반 기준(9억원)으로 계산했습니다.');
  }
  const age = Math.floor(toNum(p.age, 0));
  const holdYears = Math.floor(toNum(p.holdYears, 0));
  if (oneHouse && (!Number.isFinite(age) || age < 0 || age > 130)) throw new Error('나이는 0~130 사이 정수로 입력하세요.');
  if (oneHouse && (!Number.isFinite(holdYears) || holdYears < 0 || holdYears > 100)) throw new Error('보유기간은 0 이상의 정수로 입력하세요.');
  const paidPropertyTax = Math.round(toNum(p.paidPropertyTax));
  if (!Number.isFinite(paidPropertyTax) || paidPropertyTax < 0) throw new Error('재산세는 0 이상의 숫자로 입력하세요.');

  const hasPrev = prevPrices.every((x) => x > 0);
  if (prevPrices.some((x) => x > 0) && !hasPrev) warnings.push('작년 공시가격을 모든 주택에 넣어야 세부담상한을 계산합니다. 일부만 있어 세부담상한을 빼고 계산했습니다.');
  const cur = compCore({ prices, oneHouse, age, holdYears, paidPropertyTax, prevPrices: hasPrev ? prevPrices : null });

  // 세부담상한 (제10조, 시행령 제5조)
  let cap = null;
  if (hasPrev) {
    const prev = compCore({ prices: prevPrices, oneHouse, age: age - 1, holdYears: holdYears - 1, paidPropertyTax: 0, prevPrices: null });
    const prevTotal = prev.estPaid + prev.tax; // 직전 연도 재산세액상당액(과세표준상한 제외) + 종부세액상당액
    const curTotal = cur.paid + cur.tax;
    const limit = floor1(prevTotal * v('burdenCap'));
    const excess = Math.max(0, Math.min(cur.tax, curTotal - limit));
    cap = { prevPropertyTax: prev.estPaid, prevCompTax: prev.tax, prevTotal, curTotal, limit, excess };
  }
  const beforeCap = cur.tax;
  const compTax = floor10(beforeCap - (cap ? cap.excess : 0));
  const farmTax = floor10(compTax * v('farmRate'));
  const total = compTax + farmTax;

  const pay = v('payment');
  const installable = compTax <= pay.installmentOver ? 0 : compTax <= pay.installmentHalf ? compTax - pay.installmentOver : floor10(compTax / 2);
  const farmInstallable = compTax > 0 ? floor10((farmTax * installable) / compTax) : 0;

  if (cur.base === 0) warnings.push(`공시가격 합계가 공제금액(${oneHouse ? '12억원' : '9억원'}) 이하라 주택분 종합부동산세가 없습니다.`);
  if (cap && cap.excess > 0) warnings.push('세부담상한(직전 연도 재산세·종부세 상당액의 150%)이 적용되어 종부세가 줄었습니다(종합부동산세법 제10조).');
  if (paidPropertyTax > 0 && Math.abs(paidPropertyTax - cur.estPaid) > 10) warnings.push('입력한 재산세(고지서 금액)로 재산세 공제를 계산했습니다. 이 계산기의 재산세 추정값과 다르면 조례 감면·과세표준상한 등의 차이일 수 있습니다.');

  return {
    ...cur, prices, prevPrices: hasPrev ? prevPrices : null, count: prices.length, oneHouse, age, holdYears,
    cap, beforeCap, compTax, farmTax, total, installable, farmInstallable,
    firstPay: total - installable - farmInstallable,
    warnings,
  };
}
