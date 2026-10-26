// 4대보험료 계산 (직장가입자, 월 기준) — 순수 함수
import { RATES, npsLimitsOn } from '../rates/2026.js';

export const floor10 = (x) => Math.floor((x + 1e-9) / 10) * 10;

export const SIZE_OPTIONS = {
  under150: '150인 미만',
  priority150plus: '150인 이상 우선지원대상기업',
  from150to999: '150인 이상 1,000인 미만',
  over1000: '1,000인 이상·국가·지방자치단체',
};

/**
 * 국민연금 (근로자분/사업주분)
 * @param {number} monthlyIncome 비과세 제외 월 소득
 * @param {string} date 적용일 YYYY-MM-DD (기준소득월액 상·하한 판정)
 */
export function nationalPension(monthlyIncome, date) {
  const lim = npsLimitsOn(date).value;
  const truncated = Math.floor(Math.max(0, monthlyIncome) / 1000) * 1000; // 천원 미만 절사
  let base = truncated;
  let clamp = null;
  if (base < lim.min) { base = lim.min; clamp = 'min'; }
  if (base > lim.max) { base = lim.max; clamp = 'max'; }
  if (monthlyIncome <= 0) { base = 0; clamp = null; }
  const r = RATES.nps.rateEmployee.value;
  const employee = floor10(base * r);
  const employer = floor10(base * RATES.nps.rateEmployer.value);
  return { base, clamp, limits: lim, rate: r, employee, employer, total: employee + employer };
}

/** 건강보험 + 장기요양 */
export function healthInsurance(monthlyIncome) {
  const rate = RATES.nhis.rateEmployee.value;
  const capHalf = RATES.nhis.premiumCapTotal.value / 2;
  const floorHalf = RATES.nhis.premiumFloorTotal.value / 2;
  let employee = floor10(Math.max(0, monthlyIncome) * rate);
  let clamp = null;
  if (monthlyIncome > 0 && employee < floorHalf) { employee = floorHalf; clamp = 'min'; }
  if (employee > capHalf) { employee = capHalf; clamp = 'max'; }
  if (monthlyIncome <= 0) employee = 0;
  const employer = employee;
  const ratio = RATES.ltc.ratioToHealth.value;
  const ltcEmployee = floor10(employee * ratio);
  const ltcEmployer = ltcEmployee;
  return {
    rate, employee, employer, clamp, ltcRatio: ratio,
    ltcEmployee, ltcEmployer,
  };
}

/** 고용보험 */
export function employmentInsurance(monthlyIncome, size = 'under150', { exempt = false } = {}) {
  const w = Math.max(0, monthlyIncome);
  const stabilityRate = RATES.ei.stabilityEmployer.value[size] ?? RATES.ei.stabilityEmployer.value.under150;
  const employee = exempt ? 0 : floor10(w * RATES.ei.unemploymentEmployee.value);
  const employerUnemp = exempt ? 0 : floor10(w * RATES.ei.unemploymentEmployer.value);
  const employerStability = floor10(w * stabilityRate);
  return { employee, employerUnemp, employerStability, employer: employerUnemp + employerStability, stabilityRate };
}

/** 산재보험 (사업주 전액) — rate는 사업종류별 요율, 출퇴근재해 요율을 더한다 */
export function industrialAccident(monthlyIncome, industryRate = RATES.iaci.averageByIndustry.value) {
  const w = Math.max(0, monthlyIncome);
  const r = Number(industryRate) + RATES.iaci.commute.value;
  const employer = floor10(w * r);
  // 산재보험과 함께 징수되는 임금채권부담금·석면피해구제분담금 (사업주 부담)
  const wageClaim = floor10(w * RATES.iaci.wageClaim.value);
  const asbestos = floor10(w * RATES.iaci.asbestos.value);
  return { rate: r, industryRate: Number(industryRate), employer, wageClaim, asbestos, employerAll: employer + wageClaim + asbestos };
}

/**
 * 4대보험 전체.
 * @param {object} p
 * @param {number} p.monthlyPay 월 보수(세전, 비과세 포함 금액)
 * @param {number} [p.nonTaxable=0] 월 비과세 금액(식대 등). 보험료 산정 보수에서 제외
 * @param {string} [p.date] 적용일
 * @param {string} [p.size]
 * @param {number} [p.industryRate] 산재 사업종류별 요율(소수, 예 0.0141)
 * @param {boolean} [p.age60plus] 만 60세 이상 → 국민연금 의무가입 제외(선택)
 * @param {boolean} [p.age65EI] 65세 이후 신규 고용 → 고용보험 실업급여 보험료 제외
 */
export function socialInsurance(p) {
  const pay = Math.max(0, Number(p.monthlyPay) || 0);
  const nonTax = Math.min(pay, Math.max(0, Number(p.nonTaxable) || 0));
  const income = pay - nonTax;
  const date = p.date || RATES.checkedOn;
  const np = p.age60plus ? { base: 0, clamp: null, limits: npsLimitsOn(date).value, rate: 0, employee: 0, employer: 0, total: 0, excluded: true } : nationalPension(income, date);
  const hi = healthInsurance(income);
  const ei = employmentInsurance(income, p.size || 'under150', { exempt: !!p.age65EI });
  const ia = industrialAccident(income, p.industryRate ?? RATES.iaci.averageByIndustry.value);
  const employeeTotal = np.employee + hi.employee + hi.ltcEmployee + ei.employee;
  const employerTotal = np.employer + hi.employer + hi.ltcEmployer + ei.employer + ia.employerAll;
  return {
    pay, nonTax, income, date,
    np, hi, ei, ia,
    employeeTotal, employerTotal,
    total: employeeTotal + employerTotal,
  };
}
