// 연봉 실수령액 (월 기준) — 4대보험 근로자 부담분 + 간이세액표 원천징수세액
import { socialInsurance } from './insurance.js';
import { withholdingTax } from './income-tax.js';

/**
 * @param {object} p
 * @param {number} p.annualSalary 연봉(세전, 비과세 포함)
 * @param {boolean} [p.severanceIncluded] 퇴직금 포함 연봉이면 13으로 나눔
 * @param {number} [p.nonTaxable=200000] 월 비과세액(식대 등)
 * @param {number} [p.family=1] 공제대상가족 수(본인 포함)
 * @param {number} [p.children=0] 8세 이상 20세 이하 자녀 수
 * @param {number} [p.ratio=1] 원천징수 비율
 * @param {string} [p.date] 적용일 (국민연금 상·하한)
 * @param {string} [p.size] 고용보험 규모 (사업주 부담 계산용)
 */
export function takeHome(p) {
  const annual = Math.max(0, Number(p.annualSalary) || 0);
  if (!annual) throw new Error('연봉을 입력하세요.');
  const divisor = p.severanceIncluded ? 13 : 12;
  const monthly = Math.floor(annual / divisor);
  const nonTax = Math.min(monthly, Math.max(0, Number(p.nonTaxable ?? 200000) || 0));
  const ins = socialInsurance({ monthlyPay: monthly, nonTaxable: nonTax, date: p.date, size: p.size });
  const taxable = monthly - nonTax;
  const tax = withholdingTax(taxable, p.family, p.children, p.ratio);
  const deductions = ins.employeeTotal + tax.incomeTax + tax.localTax;
  const net = monthly - deductions;
  return {
    annual, divisor, monthly, nonTax, taxable,
    ins, tax,
    deductions, net,
    netAnnual: net * 12,
    netRatio: monthly ? net / monthly : 0,
  };
}

/** 원하는 월 실수령액에 필요한 연봉(근사, 1만원 단위) — 이분 탐색 */
export function salaryForNet(targetNet, opts = {}) {
  let lo = 0; let hi = 2e9;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const r = takeHome({ ...opts, annualSalary: Math.max(1, mid) });
    if (r.net >= targetNet) hi = mid; else lo = mid;
  }
  return Math.ceil(hi / 10000) * 10000;
}
