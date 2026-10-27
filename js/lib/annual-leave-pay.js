// 연차수당 (미사용 연차유급휴가 보상) — 근로기준법 제60조·제61조
//   연차수당 = 미사용 연차 일수 × 1일 통상임금 (제60조⑤: 취업규칙 등에서 정하는 통상임금 또는 평균임금)
//   1일 통상임금 = 월 통상임금 ÷ 월 통상임금 산정 기준시간 수(시행령 제6조②4호, 주 40시간 209시간) × 1일 소정근로시간 (연차 계산기와 같은 함수)
//   1년 미만 근로자: 1개월 개근 시 1일 (제60조②), 최초 1년이 끝나면 소멸 (제60조⑦)
//   사용촉진(제61조①·②)을 거쳐 사용 기간 만료로 소멸한 휴가 → 보상 의무 없음
//   퇴직: 금품청산 14일 (제36조)
import { RATES } from '../rates/2026.js';
import { dailyOrdinaryWage } from './annual-leave.js';

const AL = RATES.annualLeave;
const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const bool = (x) => x === true || x === 'true' || x === '1';
const halfStep = (n) => Math.abs(n * 2 - Math.round(n * 2)) < 1e-9;

/** 1일 통상임금 */
export function dailyWageOf(p) {
  const type = p.wageType || 'monthly';
  const dailyHours = toNum(p.dailyHours, 8);
  if (!(dailyHours > 0 && dailyHours <= 24)) throw new Error('1일 소정근로시간은 0보다 크고 24 이하로 입력하세요.');
  if (type === 'hourly') {
    const h = toNum(p.hourlyWage);
    if (!(h > 0)) throw new Error('시간급 통상임금을 입력하세요.');
    return { type, daily: h * dailyHours, dailyHours, hourlyWage: h };
  }
  if (type === 'daily') {
    const d = toNum(p.dailyWage);
    if (!(d > 0)) throw new Error('1일 통상임금을 입력하세요.');
    return { type, daily: d, dailyHours };
  }
  const m = toNum(p.monthlyWage);
  const monthlyHours = toNum(p.monthlyHours, RATES.minWage.monthlyHours.value.fullTime);
  if (!(m > 0)) throw new Error('월 통상임금을 입력하세요.');
  if (!(monthlyHours > 0 && monthlyHours <= 400)) throw new Error('월 통상임금 산정 기준시간을 확인하세요.');
  return { type: 'monthly', daily: dailyOrdinaryWage(m, { monthlyHours, dailyHours }), dailyHours, monthlyHours, monthlyWage: m };
}

/**
 * @param {object} p
 * @param {'monthly'|'hourly'|'daily'} [p.wageType]
 * @param {number} [p.monthlyWage] 월 통상임금
 * @param {number} [p.monthlyHours=209] 월 통상임금 산정 기준시간 수
 * @param {number} [p.dailyHours=8] 1일 소정근로시간
 * @param {number} [p.hourlyWage] 시간급 통상임금
 * @param {number} [p.dailyWage] 1일 통상임금 직접 입력
 * @param {'days'|'firstYear'} [p.mode] 미사용 일수 직접 입력 / 1년 미만 근로자(개근한 달 수로 계산)
 * @param {number} [p.unusedDays] 미사용 연차 일수 (0.5일 단위)
 * @param {number} [p.monthsWorked] 1년 미만: 개근한 달 수 (0~11)
 * @param {number} [p.usedDays] 1년 미만: 이미 쓴 일수
 * @param {'retire'|'expire'} [p.situation] 퇴사 정산 / 재직 중 사용 기간 만료
 * @param {boolean} [p.promoted] 회사가 제61조 사용촉진 절차를 모두 밟았다
 */
export function calcAnnualLeavePay(p) {
  const w = dailyWageOf(p);
  const mode = p.mode === 'firstYear' ? 'firstYear' : 'days';
  const situation = p.situation === 'expire' ? 'expire' : 'retire';
  const promoted = bool(p.promoted);
  const acc = AL.accrual.value;

  let unusedDays;
  let accrued = null;
  let usedDays = null;
  if (mode === 'firstYear') {
    const months = toNum(p.monthsWorked);
    if (!Number.isInteger(months) || months < 0 || months > acc.firstYearMax) {
      throw new Error(`1년 미만 근로자는 개근한 달마다 ${acc.firstYearPerMonth}일씩, 최대 ${acc.firstYearMax}일입니다. 개근한 달 수를 0~${acc.firstYearMax} 사이 정수로 입력하세요.`);
    }
    accrued = months * acc.firstYearPerMonth;
    usedDays = toNum(p.usedDays);
    if (!(usedDays >= 0) || !halfStep(usedDays)) throw new Error('사용한 일수는 0 이상, 0.5일 단위로 입력하세요.');
    if (usedDays > accrued) throw new Error(`사용한 일수(${usedDays}일)가 발생한 일수(${accrued}일)보다 많습니다.`);
    unusedDays = accrued - usedDays;
  } else {
    unusedDays = toNum(p.unusedDays);
    if (!(unusedDays >= 0) || !halfStep(unusedDays)) throw new Error('미사용 연차 일수는 0 이상, 0.5일 단위로 입력하세요.');
    if (unusedDays > 400) throw new Error('미사용 연차 일수가 너무 큽니다.');
  }

  const allowance = Math.floor(unusedDays * w.daily + 1e-6); // 원 미만 절사 (연차 계산기와 같게)
  const exempt = situation === 'expire' && promoted;
  const payable = exempt ? 0 : allowance;

  const warnings = [];
  if (exempt) {
    warnings.push(mode === 'firstYear'
      ? '1년 미만 근로자의 휴가도 회사가 근로기준법 제61조②의 사용촉진(최초 1년이 끝나기 3개월 전 서면 촉구, 1개월 전까지 사용 시기 지정 통보)을 모두 했는데 쓰지 않아 소멸했다면 수당을 줄 의무가 없습니다.'
      : '회사가 근로기준법 제61조①의 사용촉진(사용 기간 끝나기 6개월 전 서면 촉구, 2개월 전까지 사용 시기 지정 통보)을 모두 했는데 쓰지 않아 소멸했다면 수당을 줄 의무가 없습니다.');
    warnings.push('촉구·지정 통보가 서면이 아니거나 기한을 지키지 않았다면, 또는 회사가 지정한 날에 출근을 지시하는 등 휴가를 쓸 수 없게 했다면 면제되지 않을 수 있습니다.');
  } else if (situation === 'retire' && promoted) {
    warnings.push('사용촉진을 했더라도 사용 기간이 끝나기 전에 퇴직하면 남은 휴가는 수당으로 정산하는 것으로 계산했습니다(제61조는 1년간 쓰지 않아 소멸한 휴가에 대한 면제 규정). 고용노동부 행정해석 원문은 확인하지 못했습니다(확인 필요).');
  }
  if (situation === 'retire' && mode === 'firstYear' && accrued === acc.firstYearMax) {
    warnings.push('1년을 채우고 다음 날에도 근로관계가 있으면 15일이 더 생깁니다. 입사일·퇴사일로 정확히 따져 보려면 연차 계산기를 쓰세요.');
  }

  return {
    ...w,
    mode, situation, promoted,
    accrued, usedDays, unusedDays,
    allowance,
    exempt,
    payable,
    deadlineDays: AL.settlementDays.value,
    warnings,
  };
}
