// 자동차세(자동차 소유분) — 비영업용 승용자동차
//   연세액: 지방세법 제127조①1호 — 배기량 × 시시당 세액 (1,000cc 이하 80원, 1,600cc 이하 140원, 초과 200원)
//   차령 경감: 제127조①2호 — 각 기분세액 = A/2 − (A/2 × 5/100)(n − 2), 차령 3년 이상, 12년 초과는 12년
//   차령: 시행령 제122조② — 기산일 1~6월이면 과세연도 − 기산연도 + 1, 7~12월이면 제1기분 −0, 제2기분 +1
//   전기·태양열·알코올(그 밖의 승용자동차): 제127조①3호 — 연 100,000원, 차령 경감 없음 (시행령 제123조2호)
//   지방교육세: 제151조①7호 — 자동차세액의 30%
//   연납 공제: 제128조③, 시행령 제125조⑥ 이자율 5%
//   끝수: 10원 미만 절사 (지방세기본법 제59조 → 국고금관리법 제47조)
import { RATES } from '../rates/2026.js';
import { parseDate, diffDays, daysInYear } from './date.js';

const CT = RATES.carTax;
const v = (k) => CT[k].value;
const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor10 = (x) => Math.floor(x / 10 + 1e-7) * 10;

export const TAX_YEARS = [2026, 2027];
export const PREPAY_MONTHS = [0, 1, 3, 6, 9];

/** 시시당 세액 (제127조①1호 비영업용) */
export function perCcRate(cc) {
  return v('perCc').find((b) => cc <= b.upTo).perCc;
}

/** 기분별 차령 [제1기분, 제2기분] (시행령 제122조②) */
export function carAges(regYear, regMonth, taxYear) {
  const base = taxYear - regYear;
  if (regMonth <= v('ageRule').firstHalfEndMonth) return [base + 1, base + 1];
  return [base, base + 1];
}

/** 차령 n의 경감률 (0 ~ 0.5) */
export function ageReliefRate(n) {
  const a = v('ageRelief');
  if (n < a.startAge) return 0;
  return a.rate * (Math.min(n, a.capAge) - 2);
}

/**
 * @param {object} p
 * @param {'engine'|'electric'} [p.fuel] 내연기관·하이브리드(배기량) / 전기·수소 등 그 밖의 승용자동차
 * @param {number} [p.cc] 배기량
 * @param {string} p.regDate 차령기산일(최초 등록일) YYYY-MM-DD
 * @param {number} [p.taxYear=2026]
 * @param {number} [p.prepayMonth=0] 연납 신고납부 달 (0 = 안 함, 1·3·6·9)
 * @param {number} [p.prepayRatePct] 연납 이자율(%) 직접 입력 (비우면 시행령 값)
 */
export function calcCarTax(p) {
  const fuel = p.fuel === 'electric' ? 'electric' : 'engine';
  const taxYear = toNum(p.taxYear, 2026);
  if (!TAX_YEARS.includes(taxYear)) throw new Error(`과세연도는 ${TAX_YEARS.join('·')}년만 계산합니다.`);
  const prepayMonth = toNum(p.prepayMonth, 0);
  if (!PREPAY_MONTHS.includes(prepayMonth)) throw new Error('연납은 1월·3월·6월·9월 중에서 고르세요.');
  const reg = parseDate(p.regDate);
  const regYear = reg.getUTCFullYear();
  const regMonth = reg.getUTCMonth() + 1;
  if (regYear > taxYear) throw new Error('최초 등록일이 과세연도보다 늦습니다.');
  const cc = fuel === 'engine' ? Math.round(toNum(p.cc)) : 0;
  if (fuel === 'engine' && !(cc >= 1 && cc <= 20000)) throw new Error('배기량(cc)을 1 이상으로 입력하세요.');

  const warnings = [];
  let annualBase; // A
  let rate = 0;
  let ages = [0, 0];
  let relief = [0, 0];
  let halves;
  if (fuel === 'electric') {
    annualBase = v('otherPassenger');
    halves = [floor10(annualBase / 2), floor10(annualBase / 2)];
  } else {
    rate = perCcRate(cc);
    annualBase = cc * rate;
    ages = carAges(regYear, regMonth, taxYear);
    relief = ages.map(ageReliefRate);
    halves = relief.map((r) => floor10(annualBase / 2 - (annualBase / 2) * r));
  }
  const edu = v('eduTax');
  const eduHalves = halves.map((h) => floor10(h * edu));
  const carTax = halves[0] + halves[1];
  const eduTax = eduHalves[0] + eduHalves[1];
  const total = carTax + eduTax;

  // 연납 공제 (제128조③)
  const userRate = p.prepayRatePct !== undefined && p.prepayRatePct !== '' && p.prepayRatePct !== null;
  const prepayRate = userRate ? toNum(p.prepayRatePct) / 100 : v('prepayRate');
  if (!(prepayRate >= 0 && prepayRate <= v('prepayPeriods').cap)) throw new Error('연납 이자율은 0~10% 사이로 입력하세요.');
  let prepay = null;
  if (prepayMonth) {
    const pp = v('prepayPeriods');
    const due = parseDate(`${taxYear}-${{ 1: pp.janDue, 3: pp.marDue, 6: pp.junDue, 9: pp.sepDue }[prepayMonth]}`);
    const yearEnd = parseDate(`${taxYear}-12-31`);
    const days = diffDays(due, yearEnd); // 납부기한 다음 날 ~ 12월 31일
    const yDays = daysInYear(taxYear);
    let deduction;
    let covered; // 이번에 한꺼번에 내는 자동차세(공제 전)
    let formula;
    if (prepayMonth === 1 || prepayMonth === 3) {
      deduction = carTax * (days / yDays) * prepayRate;
      covered = carTax;
      formula = { base: carTax, days, denom: yDays };
    } else if (prepayMonth === 6) {
      deduction = halves[1] * prepayRate;
      covered = carTax;
      formula = { base: halves[1], days: 0, denom: 0 };
    } else {
      deduction = halves[1] * (days / pp.secondHalfDays) * prepayRate;
      covered = halves[1];
      formula = { base: halves[1], days, denom: pp.secondHalfDays };
    }
    const capBase = prepayMonth === 1 || prepayMonth === 3 ? carTax * (days / yDays) : halves[1] * (prepayMonth === 9 ? days / pp.secondHalfDays : 1);
    deduction = Math.min(deduction, capBase * pp.cap);
    const paidTax = floor10(covered - deduction);
    const paidEdu = floor10(paidTax * edu);
    const regular = prepayMonth === 9 ? halves[0] + eduHalves[0] : 0; // 9월 연납은 상반기분을 6월에 따로 냄
    const yearTax = paidTax + (prepayMonth === 9 ? halves[0] : 0);
    const yearEdu = paidEdu + (prepayMonth === 9 ? eduHalves[0] : 0);
    prepay = {
      month: prepayMonth, rate: prepayRate, userRate, days, ...formula,
      deduction,
      taxSaved: covered - paidTax,
      paidTax, paidEdu, paidTotal: paidTax + paidEdu,
      regular,
      yearTax, yearEdu, yearTotal: yearTax + yearEdu,
      saved: total - (yearTax + yearEdu),
      effectiveRate: (total - (yearTax + yearEdu)) / total,
    };
    if (taxYear === 2027 && !userRate) warnings.push('2027년 연납 이자율은 아직 확인하지 못했습니다(확인 필요). 현행 지방세법 시행령 제125조⑥의 5%로 계산했고, 개정되면 이자율 칸에 직접 넣어 다시 계산하세요.');
  }
  if (carTax <= v('lumpSumMax') && prepayMonth !== 6) warnings.push('연세액이 10만원 이하라 시·군·구가 6월(제1기분)에 1년 치를 한꺼번에 부과할 수 있습니다. 이때는 하반기분 세액 × 5%를 공제하므로 연납에서 \'6월\'을 고른 금액과 같습니다(지방세법 제128조④, 시행령 제125조⑥).');
  if (regYear === taxYear) warnings.push('과세연도에 새로 등록한 차는 등록일부터 일할 계산해 부과합니다(지방세법 제128조②). 이 계산은 1년 내내 소유한 경우의 금액입니다.');
  if (fuel === 'engine' && ages[1] >= v('ageRelief').startAge) {
    if (ages[0] !== ages[1]) warnings.push(`하반기에 최초 등록한 차라 상반기 차령 ${ages[0]}년, 하반기 차령 ${ages[1]}년으로 경감률이 다릅니다(지방세법 시행령 제122조②).`);
  }

  return {
    fuel, cc, perCc: rate, taxYear, regYear, regMonth,
    annualBase,
    ages, age1: ages[0], age2: ages[1],
    relief, relief1: relief[0], relief2: relief[1],
    halves, half1: halves[0], half2: halves[1],
    eduHalves,
    carTax, eduTax, total,
    reliefAmount: fuel === 'engine' ? annualBase - carTax : 0,
    prepay,
    warnings,
  };
}
