// 시급 ↔ 월급 ↔ 연봉 변환과 최저임금 비교
// 월 기준시간 = (1주 소정근로시간 + 주휴시간) × 1년 평균 주수(365 ÷ 7) ÷ 12  (최저임금법 시행령 제5조①3호)
//   주 40시간 → 48 × 365 ÷ 7 ÷ 12 = 208.57 → 209시간 (고용노동부 최저임금 고시의 월 환산 기준시간)
//   주 40시간 미만의 끝수 처리 규정은 찾지 못해 반올림하고(RATES.minWage.hoursRounding [미확인]), 직접 입력도 받는다.
// 최저임금 위반 판단: 월급(최저임금 산입 임금) ÷ 월 기준시간 < 시간급 최저임금 (수습 3개월 이내는 90%, 시행령 제3조)
import { RATES } from '../rates/2026.js';
import { minWageFor, weeklyHolidayHours } from './weekly-holiday.js';

const MW = RATES.minWage;
export const MODES = { hourly: '시급', monthly: '월급', annual: '연봉' };

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** 주 소정근로시간 → 월 기준시간 (주휴 포함) */
export function monthlyBaseHours(weeklyHours) {
  const holiday = weeklyHolidayHours(weeklyHours);
  const exact = ((weeklyHours + holiday) * MW.monthlyHours.value.weeksPerYear) / 12;
  return { holiday, weeklyPaidHours: weeklyHours + holiday, exact, rounded: Math.round(exact + 1e-9) };
}

/**
 * @param {object} p
 * @param {'hourly'|'monthly'|'annual'} p.mode 입력한 금액의 단위
 * @param {number} p.amount 금액(원). 월급·연봉은 세전, 최저임금 산입 임금 기준
 * @param {number} [p.weeklyHours] 1주 소정근로시간 (기본 40)
 * @param {number} [p.monthlyHours] 월 기준시간 직접 입력 (비우면 계산)
 * @param {number} [p.year] 2026 | 2027
 * @param {boolean} [p.probation] 1년 이상 계약·수습 3개월 이내 (단순노무직 제외)
 */
export function calcWageConvert(p) {
  const mode = p.mode || 'hourly';
  const amount = toNum(p.amount);
  const weeklyHours = toNum(p.weeklyHours, 40);
  const customHours = toNum(p.monthlyHours, 0);
  const year = toNum(p.year, 2026);
  const probation = p.probation === true || p.probation === 'true' || p.probation === '1';
  if (!MODES[mode]) throw new Error('변환 기준이 올바르지 않습니다.');
  if (!(amount > 0)) throw new Error('금액을 입력하세요.');
  if (!(weeklyHours > 0) || weeklyHours > 40) throw new Error('1주 소정근로시간은 0시간 초과 40시간 이하로 입력하세요 (근로기준법 제50조).');
  if (!(customHours >= 0) || customHours > 400) throw new Error('월 기준시간은 0~400시간 사이로 입력하세요.');
  const mw = minWageFor(year);

  const h = monthlyBaseHours(weeklyHours);
  const hours = customHours > 0 ? customHours : h.rounded;
  let hourly; let monthly; let annual;
  if (mode === 'hourly') {
    hourly = amount;
    monthly = Math.round(hourly * hours);
    annual = monthly * 12;
  } else if (mode === 'monthly') {
    monthly = Math.round(amount);
    hourly = monthly / hours;
    annual = monthly * 12;
  } else {
    annual = Math.round(amount);
    monthly = Math.round(annual / 12);
    hourly = annual / 12 / hours;
  }
  const minHourly = probation ? mw.hourly * MW.probation.value : mw.hourly;
  const minMonthly = Math.round(minHourly * hours);
  const belowMin = hourly < minHourly - 1e-9;
  return {
    mode, amount, weeklyHours, year, probation,
    holidayHours: h.holiday,
    weeklyPaidHours: h.weeklyPaidHours,
    exactHours: h.exact,
    hours,
    customHours: customHours > 0,
    hourly,
    hourlyRounded: Math.round(hourly),
    monthly,
    annual,
    minHourly,
    minMonthly,
    minAnnual: minMonthly * 12,
    belowMin,
    shortMonthly: belowMin ? Math.max(0, Math.round((minHourly - hourly) * hours)) : 0,
    marginPct: (hourly / minHourly - 1),
  };
}
