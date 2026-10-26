// 실업급여(구직급여) — 고용보험법 제40조·제45조~제50조, 시행령 제68조, 별표 1
// 순수 함수만 둔다 (DOM 의존 없음). 모든 기준값은 src/rates/2026.js 의 RATES.unemployment 에서 읽는다.
import { RATES } from '../rates/2026.js';
import { parseDate, fmtDate, addDays, diffDays, monthsBefore, anniversaryAfterMonths } from './date.js';

const U = RATES.unemployment;
const v = (k) => U[k].value;
const fl = (x) => Math.floor(x + 1e-6);

export const LAW = {
  eligibility: '고용보험법 제40조',
  base: '고용보험법 제45조',
  daily: '고용보험법 제46조',
  period: '고용보험법 제48조',
  waiting: '고용보험법 제49조',
  days: '고용보험법 제50조',
  cap: '고용보험법 시행령 제68조',
  restriction: '고용보험법 제58조',
};

export const INSURED_BANDS = ['under1', '1to3', '3to5', '5to10', 'over10'];
export const INSURED_LABELS = { under1: '1년 미만', '1to3': '1년 이상 3년 미만', '3to5': '3년 이상 5년 미만', '5to10': '5년 이상 10년 미만', over10: '10년 이상' };

/** 소정급여일수 (별표 1) */
export function benefitDays(band, age, disabled = false) {
  const i = Math.max(0, INSURED_BANDS.indexOf(band));
  const t = v('benefitDays');
  return (disabled || Number(age) >= 50 ? t.over50 : t.under50)[i];
}

/** 이직일 기준 기초일액 상한 (시행령 제68조, 부칙 제4조) */
export function baseCapOn(date) {
  const d = typeof date === 'string' ? date : fmtDate(date);
  let cap = null;
  for (const c of v('baseCap')) if (d >= c.from) cap = c.cap;
  return cap;
}

/** 1일 소정근로시간: 소수점 올림, 8시간 한도 (급여기초임금일액 산정규정 제3조) */
export function dailyHoursFor(h) {
  const x = Number(h) > 0 ? Number(h) : 8;
  return Math.min(v('dailyHoursRule').max, Math.ceil(x - 1e-9));
}

/** 최저구직급여일액 = 시간급 최저임금 × 1일 소정근로시간 × 80% */
export function floorDaily(hourlyMinWage, hours) {
  return fl(hourlyMinWage * dailyHoursFor(hours) * v('benefitRate').floorRate);
}

/**
 * @param {object} p
 * @param {string} p.lastWorkDate 이직일(마지막 근무일)
 * @param {number} [p.wages3m] 이직 전 3개월 임금총액 (세전)
 * @param {number} [p.periodDays] 3개월 총일수 (비우면 이직일 기준 자동)
 * @param {number} [p.annualBonus] 직전 1년 상여금 (3/12 가산)
 * @param {number} [p.annualLeavePay] 직전 1년 연차수당 (3/12 가산)
 * @param {number} [p.monthlyOrdinary] 월 통상임금 (평균임금보다 크면 적용)
 * @param {number} [p.monthlyHours=209]
 * @param {number} [p.dailyHours=8] 이직 전 1일 소정근로시간
 * @param {number} p.age 이직일 현재 만 나이
 * @param {boolean} [p.disabled] 장애인
 * @param {string} p.insured 피보험기간 구간
 * @param {boolean} [p.unit180] 18개월 중 피보험 단위기간 180일 이상
 * @param {boolean} [p.involuntary] 비자발적 이직(또는 정당한 자진퇴사 사유)
 */
export function calcUnemployment(p) {
  if (!p.lastWorkDate) throw new Error('이직일(마지막 근무일)을 입력하세요.');
  const last = parseDate(p.lastWorkDate);
  const s = fmtDate(last);
  if (s < '2026-01-01' || s > '2027-12-31') throw new Error('이 계산기는 2026년 1월 1일~2027년 12월 31일 이직자만 계산합니다 (상한액·최저임금이 다릅니다).');
  const wages3m = Math.max(0, Number(p.wages3m) || 0);
  if (!wages3m && !(Number(p.monthlyOrdinary) > 0)) throw new Error('3개월 임금총액을 입력하세요.');
  const age = Number(p.age);
  if (!Number.isFinite(age) || age <= 0) throw new Error('이직일 현재 나이를 입력하세요.');
  const warnings = [];

  // 평균임금 (근로기준법 제2조①6호): 이직일 다음 날 이전 3개월
  const next = addDays(last, 1);
  const periodStart = monthsBefore(next, 3);
  const autoDays = diffDays(periodStart, next);
  const periodDays = Number(p.periodDays) > 0 ? Math.floor(Number(p.periodDays)) : autoDays;
  const bonusAdd = (Number(p.annualBonus) || 0) * 3 / 12;
  const leaveAdd = (Number(p.annualLeavePay) || 0) * 3 / 12;
  const total = wages3m + bonusAdd + leaveAdd;
  const avgDaily = fl(total / periodDays);

  const hours = dailyHoursFor(p.dailyHours);
  const monthlyHours = Number(p.monthlyHours) > 0 ? Number(p.monthlyHours) : 209;
  const rawHours = Number(p.dailyHours) > 0 ? Number(p.dailyHours) : 8;
  // 통상임금 일급 = 시간급 × 1일 소정근로시간 (근로기준법 시행령 제6조③)
  const ordinaryDaily = Number(p.monthlyOrdinary) > 0 ? fl((Number(p.monthlyOrdinary) / monthlyHours) * rawHours) : 0;
  const useOrdinary = ordinaryDaily > avgDaily;
  const rawBase = useOrdinary ? ordinaryDaily : avgDaily;
  const cap = baseCapOn(s);
  const base = Math.min(rawBase, cap);
  const capBinding = rawBase > cap;

  const year = s.slice(0, 4);
  const mw = RATES.minWage[`y${year}`].value.hourly;
  const floor = floorDaily(mw, hours);
  const byRate = fl(base * v('benefitRate').rate);
  const floorBinding = byRate < floor;
  const daily = floorBinding ? floor : byRate;
  const capDaily = fl(cap * v('benefitRate').rate);
  if (year === '2027') warnings.push(`2027년 이직자: 상한 고시(시행령 개정)가 아직 없어 현행 상한(일 ${capDaily.toLocaleString('ko-KR')}원)을 썼습니다. 2027년 최저임금 10,700원으로 계산한 하한(8시간 68,480원)이 이보다 높아, 고용보험법 제46조②에 따라 하한이 우선합니다. 확인 필요.`);

  const disabled = !!p.disabled;
  const band = INSURED_BANDS.includes(p.insured) ? p.insured : '1to3';
  const days = benefitDays(band, age, disabled);
  const totalBenefit = daily * days;
  const periodEnd = fmtDate(addDays(anniversaryAfterMonths(next, 12), -1));

  if (p.unit180 === false) warnings.push('이직일 이전 18개월 동안 피보험 단위기간(보수를 받은 날)이 합산 180일 이상이어야 수급자격이 있습니다 (고용보험법 제40조①1호).');
  if (p.involuntary === false) warnings.push('정당한 사유 없는 자진퇴사나 중대한 귀책사유로 인한 해고는 수급자격이 제한됩니다 (제58조). 임금체불, 통근 곤란(왕복 3시간 이상), 질병, 직장 내 괴롭힘 등 고용노동부령의 정당한 사유가 있으면 자진퇴사도 받을 수 있습니다.');
  if (age >= 65) warnings.push('65세 이후 새로 고용된 경우에는 실업급여가 적용되지 않습니다. 65세 전부터 계속 고용되어 피보험자격을 유지했다면 받을 수 있습니다 (제10조②).');

  return {
    lastWorkDate: s, periodStart: fmtDate(periodStart), periodDays, autoDays, wages3m, bonusAdd, leaveAdd, total,
    avgDaily, ordinaryDaily, useOrdinary, rawBase, cap, base, capBinding,
    hours, minWage: mw, floor, byRate, floorBinding, daily, capDaily,
    age, disabled, band, bandLabel: INSURED_LABELS[band], days, totalBenefit,
    monthlyApprox: daily * 30, benefitPeriodEnd: periodEnd, warnings,
  };
}
