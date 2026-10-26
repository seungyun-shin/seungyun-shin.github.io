// 주휴수당 — 근로기준법 제55조①(1주 평균 1회 이상 유급휴일), 시행령 제30조①(1주 소정근로일 개근),
// 제18조③(4주 평균 1주 소정근로시간 15시간 미만이면 미적용), 시행령 별표 2(단시간근로자 1일 소정근로시간).
// 1일 소정근로시간 = 4주 소정근로시간 ÷ 4주간 통상근로자 총 소정근로일수.
// 통상근로자가 주 5일·40시간이면 (주 소정근로시간 ÷ 40) × 8시간과 같다 (고용노동부 빠른상담 예시와 일치).
// 끝수: 법령에 정한 것이 없어 원 미만 버림. 모든 기준은 RATES.weeklyHoliday, RATES.minWage.
import { RATES } from '../rates/2026.js';

const W = RATES.weeklyHoliday.rule.value;
export const MIN_WAGE_YEARS = [2026, 2027];

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor1 = (x) => Math.floor(x + 1e-6);

/** 연도별 시간급 최저임금 (고시값) */
export function minWageFor(year) {
  const y = Number(year);
  const r = RATES.minWage[`y${y}`];
  if (!r) throw new Error(`${year}년 최저임금은 이 계산기에 없습니다. ${MIN_WAGE_YEARS.join('·')}년만 고를 수 있습니다.`);
  return { year: y, hourly: r.value.hourly, monthly209: r.value.monthly209, source: r.note };
}

/** 주 소정근로시간에 대한 주휴(유급휴일) 시간. 15시간 미만이면 0 */
export function weeklyHolidayHours(weeklyHours) {
  if (weeklyHours < W.minWeeklyHours) return 0;
  return (Math.min(weeklyHours, W.fullTimeWeeklyHours) / W.fullTimeWeeklyHours) * W.fullTimeDailyHours;
}

/**
 * @param {object} p
 * @param {number} p.weeklyHours 1주 소정근로시간 (근로계약서상, 4주 평균)
 * @param {number} p.hourlyWage 시급(원)
 * @param {number} [p.year] 최저임금 비교 연도 2026 | 2027
 * @param {boolean} [p.attended] 그 주 소정근로일 개근 여부 (기본 true)
 */
export function calcWeeklyHolidayPay(p) {
  const weeklyHours = toNum(p.weeklyHours);
  const hourlyWage = toNum(p.hourlyWage);
  const year = toNum(p.year, 2026);
  const attended = !(p.attended === false || p.attended === 'false' || p.attended === '0');
  if (!(weeklyHours > 0)) throw new Error('1주 소정근로시간을 입력하세요.');
  if (weeklyHours > W.fullTimeWeeklyHours) throw new Error('소정근로시간은 법정근로시간(1주 40시간, 근로기준법 제50조) 안에서 정한 시간이라 40시간을 넘을 수 없습니다. 연장근로는 빼고 넣으세요.');
  if (!(hourlyWage > 0)) throw new Error('시급을 입력하세요.');
  const mw = minWageFor(year);

  const eligibleByHours = weeklyHours >= W.minWeeklyHours;
  const eligible = eligibleByHours && attended;
  const dailyHours = eligibleByHours ? weeklyHolidayHours(weeklyHours) : 0;
  const weeklyPay = eligible ? floor1(dailyHours * hourlyWage) : 0;
  const weeklyBasePay = floor1(weeklyHours * hourlyWage);
  // 한 달 평균: 1년 평균 주수(365 ÷ 7) ÷ 12 (최저임금법 시행령 제5조①3호와 같은 방식)
  const weeksPerMonth = RATES.minWage.monthlyHours.value.weeksPerYear / 12;
  const monthlyPay = floor1(weeklyPay * weeksPerMonth);
  const belowMinWage = hourlyWage < mw.hourly;
  return {
    weeklyHours, hourlyWage, year, attended,
    eligibleByHours, eligible,
    dailyHours,
    weeklyPay,
    weeklyBasePay,
    weeklyTotal: weeklyBasePay + weeklyPay,
    weeksPerMonth,
    monthlyPay,
    minWage: mw.hourly,
    belowMinWage,
    // 최저임금으로 계산한 주휴수당 (시급이 최저임금보다 낮을 때 비교용)
    weeklyPayAtMinWage: eligibleByHours ? floor1(dailyHours * mw.hourly) : 0,
    shortfallPerWeek: belowMinWage ? floor1((weeklyHours + (eligible ? dailyHours : 0)) * (mw.hourly - hourlyWage)) : 0,
  };
}
