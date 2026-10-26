// 근로소득 간이세액표(소득세법 시행령 별표 2, 2026.2.27. 개정, 2026.3.1. 이후 원천징수분) 계산식 구현
// 별표 2 비고 1은 "근로소득공제, 기본공제, 특별소득공제 및 특별세액공제 중 일부, 연금보험료공제,
// 근로소득세액공제와 해당 세율을 반영하여 계산한 금액"이라고만 밝히므로, 아래 계산식은
// 공식 표 7,117칸과 대조해 맞춘 것이다 (test/kani-table.test.js 참고).
//   - 월급여 구간의 '중간값' × 12 = 연간 총급여
//   - 연금보험료공제: 4.5% × min(월급여, 4,490,000원) × 12  ← 표 작성에 쓰인 고정 가정 (2026년 실제 요율 4.75%와 다름)
//   - 근로소득세액공제: 표 작성 가정(산출세액 50만원 기준 55%/30%, 한도 66만/63만/50만원)  ← 현행 소득세법 제59조와 다름
//   - 월 세액 10원 미만 절사, 1,000원 미만은 0원(소액부징수)
// 공식 표에 정해진 숫자를 그대로 재현하는 것이 목적이므로, 원천징수 실무와 같은 값을 낸다.

import { RATES } from '../rates/2026.js';

const CD = RATES.incomeTax.childDeduction.value;

export const KANI = {
  version: '소득세법 시행령 별표 2 (2026. 2. 27. 개정, 2026. 3. 1. 이후 원천징수분부터 적용)',
  sourceUrl: 'https://www.law.go.kr/LSW/flDownload.do?gubun=&flSeq=169798151&bylClsCd=110201',
  minPay: 770000,
  childDeduction: { one: CD.one, two: CD.two, extra: CD.extraPerChild }, // 별표 2 비고 3 (8세 이상 20세 이하 자녀)
  pensionRate: 0.045,
  pensionCap: 4490000,
};

// 공식 표와 계산식이 10원 차이 나는 17칸(계산 결과가 10원 경계 직하 0.06~0.6원 차이) → 표 값으로 보정
// key: `${구간하한(천원)}:${공제대상가족수}`
const TABLE_CORRECTIONS = new Set([
  '1160:1', '1360:1', '1375:1', '1390:1', '1405:1', '2680:1', '2750:1',
  '1360:2', '1375:2', '1390:2', '1405:2',
  '2270:3', '2270:5', '2520:4', '2520:6', '2700:5', '2700:7',
]);

export function earnedIncomeDeduction(g) {
  let d;
  if (g <= 5e6) d = g * 0.7;
  else if (g <= 15e6) d = 3.5e6 + (g - 5e6) * 0.4;
  else if (g <= 45e6) d = 7.5e6 + (g - 15e6) * 0.15;
  else if (g <= 1e8) d = 12e6 + (g - 45e6) * 0.05;
  else d = 14.75e6 + (g - 1e8) * 0.02;
  return Math.min(d, 2e7); // 소득세법 제47조, 한도 2천만원
}

/** 소득세법 제55조 기본세율 (2023년 이후) */
export const TAX_BRACKETS = [
  [14e6, 0.06, 0], [50e6, 0.15, 1.26e6], [88e6, 0.24, 5.76e6], [150e6, 0.35, 15.44e6],
  [300e6, 0.38, 19.94e6], [500e6, 0.40, 25.94e6], [1e9, 0.42, 35.94e6], [Infinity, 0.45, 65.94e6],
];
export function basicTax(base) {
  for (const [lim, r, q] of TAX_BRACKETS) if (base <= lim) return Math.max(0, base * r - q);
  return 0;
}

/** 별표 2 비고 1의 "특별소득공제 및 특별세액공제 중 일부" 계산식 */
export function specialDeduction(g, n) {
  const [base, r] = n === 1 ? [3.1e6, [0.04, 0.015, 0.005]] : n === 2 ? [3.6e6, [0.04, 0.02, 0.01]] : [5e6, [0.07, 0.05, 0.03]];
  let s;
  if (g <= 3e7) s = base + g * r[0];
  else if (g <= 4.5e7) s = base + g * r[0] - (g - 3e7) * 0.05;
  else if (g <= 7e7) s = base + g * r[1];
  else s = base + g * r[2];
  if (n >= 3 && g > 4e7) s += (g - 4e7) * 0.04;
  return s;
}

/** 표 작성에 쓰인 근로소득세액공제 (현행 제59조와 다름 — 표 재현용) */
function tableEarnedIncomeCredit(t, g) {
  const c = t <= 5e5 ? t * 0.55 : 275000 + (t - 5e5) * 0.3;
  const lim = g <= 5.5e7 ? 660000 : g <= 7e7 ? 630000 : Math.max(630000 - (g - 7e7) * 0.5, 500000);
  return Math.min(c, lim);
}

/** 월급여 m(구간 중간값), 공제대상가족 n(1~11)일 때 표 세액과 산식 내역 */
export function formulaCell(m, n) {
  const g = m * 12;
  const eid = earnedIncomeDeduction(g);
  const personal = 1.5e6 * n;
  const pension = KANI.pensionRate * Math.min(m, KANI.pensionCap) * 12;
  const special = specialDeduction(g, n);
  const base = Math.max(g - eid - personal - pension - special, 0);
  const t = basicTax(base);
  const credit = tableEarnedIncomeCredit(t, g);
  const decided = Math.max(t - credit, 0);
  let monthly = Math.floor(decided / 12 / 10 + 1e-7) * 10; // 부동소수 오차 보정
  if (monthly < 1000) monthly = 0;
  return { m, n, g, eid, personal, pension, special, base, t, credit, decided, monthly };
}

/** 월급여(원)가 속한 표 구간 [하한, 상한) (천원 단위) — 10,000천원 미만 */
export function tableRow(pay) {
  const k = Math.floor(pay / 1000); // 천원
  let lo; let w;
  if (k < 1500) { w = 5; lo = 770 + Math.floor((k - 770) / 5) * 5; } else if (k < 3000) { w = 10; lo = Math.floor(k / 10) * 10; } else { w = 20; lo = Math.floor(k / 20) * 20; }
  return [lo, lo + w];
}

/** 공제대상가족 1~11명의 표 세액 (자녀공제 전) */
function cellTax(pay, n) {
  if (pay < KANI.minPay) return { tax: 0, row: null, detail: null };
  if (pay < 1e7) {
    const [lo, hi] = tableRow(pay);
    const detail = formulaCell(((lo + hi) / 2) * 1000, n);
    let tax = detail.monthly;
    if (TABLE_CORRECTIONS.has(`${lo}:${n}`)) tax += 10;
    return { tax, row: [lo, hi], detail };
  }
  const at10m = formulaCell(1e7, n);
  if (pay === 1e7) return { tax: at10m.monthly, row: [10000, 10000], detail: at10m };
  const x = pay;
  let add;
  if (x <= 14e6) add = (x - 1e7) * 0.98 * 0.35 + 25000;
  else if (x <= 28e6) add = 1397000 + (x - 14e6) * 0.98 * 0.38;
  else if (x <= 30e6) add = 6610600 + (x - 28e6) * 0.98 * 0.40;
  else if (x <= 45e6) add = 7394600 + (x - 30e6) * 0.40;
  else if (x <= 87e6) add = 13394600 + (x - 45e6) * 0.42;
  else add = 31034600 + (x - 87e6) * 0.45;
  const tax = Math.floor((at10m.monthly + add) / 10) * 10;
  return { tax, row: null, detail: at10m, over10m: { base10m: at10m.monthly, add: Math.floor(add) } };
}

/**
 * 간이세액표에 따른 월 원천징수 소득세·지방소득세
 * @param {number} pay 월급여액 (비과세·학자금 제외)
 * @param {number} family 공제대상가족 수 (본인 포함, 1 이상)
 * @param {number} children 8세 이상 20세 이하 자녀 수 (공제대상가족에 포함된 인원)
 * @param {number} ratio 원천징수 비율 0.8 | 1 | 1.2 (시행령 제194조①)
 */
export function withholdingTax(pay, family = 1, children = 0, ratio = 1) {
  const n = Math.max(1, Math.floor(Number(family) || 1));
  const kids = Math.max(0, Math.min(Math.floor(Number(children) || 0), n));
  const p = Math.max(0, Math.floor(Number(pay) || 0));
  let base;
  let info;
  if (n <= 11) {
    info = cellTax(p, n);
    base = info.tax;
  } else {
    // 비고 4: 11명 세액 − (10명 세액 − 11명 세액) × 11명 초과 인원
    const t11 = cellTax(p, 11); const t10 = cellTax(p, 10);
    base = Math.max(0, t11.tax - (t10.tax - t11.tax) * (n - 11));
    info = t11;
  }
  const cd = KANI.childDeduction;
  const childDed = kids === 0 ? 0 : kids === 1 ? cd.one : kids === 2 ? cd.two : cd.two + (kids - 2) * cd.extra;
  const afterChild = Math.max(0, base - childDed);
  const r = [0.8, 1, 1.2].includes(Number(ratio)) ? Number(ratio) : 1;
  const incomeTax = Math.floor((afterChild * r) / 10) * 10;
  const localTax = Math.floor((incomeTax * 0.1) / 10) * 10;
  return { pay: p, family: n, children: kids, tableTax: base, childDed, ratio: r, incomeTax, localTax, row: info.row, detail: info.detail, over10m: info.over10m };
}
