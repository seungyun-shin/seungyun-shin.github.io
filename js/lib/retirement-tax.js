// 퇴직소득세 (거주자, 2020년 이후 퇴직 방식)
//   퇴직소득금액: 소득세법 제22조③ — 퇴직급여 합계(비과세 제외)
//   근속연수: 시행령 제105조① — 근로 제공 시작일부터 퇴직한 날까지, 1년 미만 기간은 1년(법 제48조①)
//   근속연수공제: 제48조①1호 (②: 퇴직소득금액이 공제액보다 적으면 그 금액)
//   환산급여 = (퇴직소득금액 − 근속연수공제) × 12 ÷ 근속연수, 환산급여공제: 제48조①2호
//   퇴직소득 산출세액: 제55조② — 과세표준에 기본세율(제55조①) → ÷ 12 × 근속연수
//   지방소득세: 지방세법 제92조④ — 같은 과세표준에 표준세율(기본세율의 10분의 1) → ÷ 12 × 근속연수
//   IRP 이전: 제146조②, 지방세법 제103조의16 — 연금외수령 전까지 원천징수·특별징수하지 않음
//   연금수령: 제129조①5호의3 — 연금외수령 원천징수세율의 70%(10년 이하)·60%(10년 초과 20년 이하)·50%
//   끝수: 과세표준 1원 미만 절사(국고금관리법 제47조②), 납부세액 10원 미만 절사(같은 조①)
import { RATES } from '../rates/2026.js';
import { basicTax } from './income-tax.js';
import { parseDate, fmtDate, anniversaryAfterMonths, cmp } from './date.js';

const R = RATES.retirement;
const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor1 = (x) => Math.floor(x + 1e-6);
const floor10 = (x) => Math.floor(x / 10 + 1e-7) * 10;

/** 근속연수공제 (제48조①1호) */
export function serviceDeduction(years) {
  const t = R.serviceDeduction.value.find((b) => years <= b.upTo);
  return t.base + t.perYear * (years - t.over);
}

/** 환산급여공제 (제48조①2호) */
export function convertedDeduction(conv) {
  if (!(conv > 0)) return 0;
  const t = R.convertedDeduction.value.find((b) => conv <= b.upTo);
  return t.base + (conv - t.over) * t.rate;
}

/** 근속연수: 입사일 ~ 퇴사일(마지막 근무일, 포함), 1년 미만 끝수는 1년 */
export function serviceYearsBetween(hireDate, retireDate) {
  const hire = parseDate(hireDate);
  const end = parseDate(retireDate);
  if (cmp(end, hire) < 0) throw new Error('퇴사일이 입사일보다 빠릅니다.');
  let n = 1;
  while (cmp(anniversaryAfterMonths(hire, 12 * n), end) <= 0) n++;
  return n;
}

/**
 * @param {object} p
 * @param {number} p.pay 퇴직급여 (세전, 퇴직금·퇴직연금 일시금 등)
 * @param {number} [p.nonTaxable] 비과세 퇴직소득
 * @param {'dates'|'years'} [p.mode] 근속연수 입력 방식
 * @param {string} [p.hireDate] 입사일 (mode=dates)
 * @param {string} [p.retireDate] 퇴사일 = 마지막 근무일 (mode=dates)
 * @param {number} [p.years] 근속연수 (mode=years, 1 이상 정수)
 */
export function calcRetirementTax(p) {
  const pay = Math.round(toNum(p.pay));
  const nonTaxable = Math.round(toNum(p.nonTaxable));
  if (!(pay > 0)) throw new Error('퇴직급여를 입력하세요.');
  if (pay > 1e13) throw new Error('퇴직급여가 너무 큽니다.');
  if (!(nonTaxable >= 0) || nonTaxable > pay) throw new Error('비과세 금액은 0 이상, 퇴직급여 이하로 입력하세요.');
  const mode = p.mode === 'years' ? 'years' : 'dates';
  let years;
  if (mode === 'years') {
    years = toNum(p.years);
    if (!Number.isInteger(years) || years < 1 || years > 80) throw new Error('근속연수는 1 이상의 정수(년)로 입력하세요. 1년 미만 끝수는 1년으로 올립니다.');
  } else {
    years = serviceYearsBetween(p.hireDate, p.retireDate);
    if (years > 80) throw new Error('근속연수가 너무 깁니다.');
  }

  const income = pay - nonTaxable; // 퇴직소득금액
  const sdFull = serviceDeduction(years);
  const sd = Math.min(sdFull, income); // 제48조②
  const converted = ((income - sd) * R.conversion.value) / years; // 환산급여
  const cd = Math.min(convertedDeduction(converted), converted);
  const base = floor1(Math.max(0, converted - cd)); // 퇴직소득과세표준 (1원 미만 절사)
  const convTax = basicTax(base); // 환산산출세액
  const calcTax = floor1((convTax / R.conversion.value) * years); // 퇴직소득 산출세액
  const incomeTax = floor10(calcTax); // 원천징수 납부세액
  const localCalc = floor1(((convTax * R.localIncomeTax.value) / R.conversion.value) * years);
  const localTax = floor10(localCalc);
  const total = incomeTax + localTax;

  // 연금수령 시 원천징수 (연금외수령 원천징수세율 × 70%·60%) — 전액을 해당 연차 구간에 나눠 받는다고 가정한 합계
  const pw = R.pensionWithholding.value;
  const pension = pw.map((x) => {
    const tax = floor10(incomeTax * x.ratio);
    return { period: x.period, ratio: x.ratio, incomeTax: tax, localTax: floor10(tax * RATES.incomeTax.localTaxRate.value), saved: 0 };
  });
  for (const x of pension) x.saved = total - x.incomeTax - x.localTax;

  const warnings = [];
  if (mode === 'dates') {
    const hire = parseDate(p.hireDate);
    if (cmp(anniversaryAfterMonths(hire, 12), parseDate(p.retireDate)) > 0) {
      warnings.push('근속 1년 미만이면 법정 퇴직금 대상이 아닙니다(근로자퇴직급여 보장법 제4조). 회사 규정 등으로 받은 퇴직급여라면 근속연수 1년으로 계산했습니다.');
    }
  }
  if (incomeTax === 0) warnings.push('환산급여가 환산급여공제 이하라 퇴직소득세가 없습니다.');

  return {
    pay, nonTaxable, income, mode, years,
    hireDate: mode === 'dates' ? fmtDate(parseDate(p.hireDate)) : '',
    retireDate: mode === 'dates' ? fmtDate(parseDate(p.retireDate)) : '',
    serviceDeductionFull: sdFull,
    serviceDeduction: sd,
    converted,
    convertedDeduction: cd,
    base,
    convTax,
    calcTax,
    incomeTax,
    localCalc,
    localTax,
    total,
    net: pay - total,
    effectiveRate: total / pay,
    // 연금외수령 원천징수세율 ≈ 이연퇴직소득세 ÷ 이연퇴직소득 (시행령 제202조의2)
    withholdingRate: income > 0 ? incomeTax / income : 0,
    pension,
    pension10: pension[0],
    pension20: pension[1],
    warnings,
  };
}
