// 출산전후휴가급여·배우자 출산전후휴가급여 — 근로기준법 제74조, 고용보험법 제75조·제76조, 시행령 제101조,
// 남녀고용평등법 제18조의2, 고용노동부고시 제2026-67호 (출산전후휴가 급여등 상한액)
// 순수 함수만 둔다 (DOM 의존 없음). 모든 기준값은 src/rates/2026.js 의 RATES.maternity 에서 읽는다.
import { RATES } from '../rates/2026.js';
import { parseDate, fmtDate, addDays, cmp } from './date.js';

const M = RATES.maternity;
const v = (k) => M[k].value;
const fl = (x) => Math.floor(x + 1e-6);

export const LAW = {
  days: '근로기준법 제74조①',
  paid60: '근로기준법 제74조④',
  benefit: '고용보험법 제76조①',
  eligibility: '고용보험법 제75조',
  cap: '고용보험법 시행령 제101조',
  spouse: '남녀고용평등법 제18조의2',
};

const ALLOWED_FROM = '2026-01-01';
const ALLOWED_TO = '2026-12-31';
const KNOWN_CAP_UNTIL = '2026-12-31';

/** 날짜에 적용되는 월 상한(30일 기준) — 고시가 바뀌면 그날부터 새 상한으로 일할 계산 (고시 제2025-124호 적용례) */
export function monthlyCapOn(date) {
  const d = typeof date === 'string' ? date : fmtDate(date);
  let cap = null;
  for (const c of v('monthlyCap')) if (d >= c.from) cap = c.monthly;
  return cap;
}

export function spouseCap20On(date) {
  const d = typeof date === 'string' ? date : fmtDate(date);
  let cap = null;
  for (const c of v('spouseCap')) if (d >= c.from) cap = c.amount20;
  return cap;
}

/** 휴가 시작일 당시 시간급 최저임금 */
export function minWageOn(date) {
  const y = (typeof date === 'string' ? date : fmtDate(date)).slice(0, 4);
  const mw = RATES.minWage[`y${y}`];
  return mw ? mw.value.hourly : null;
}

/** 시간급 통상임금과 최저임금 하한 적용 (시행령 제101조2호) */
export function hourlyOrdinary(monthlyWage, monthlyHours, startDate) {
  const hours = Number(monthlyHours) > 0 ? Number(monthlyHours) : 209;
  const hourly = monthlyWage / hours;
  const mw = minWageOn(startDate);
  const floored = mw != null && hourly < mw;
  return { hours, hourly, minWage: mw, floored, applied: floored ? mw : hourly };
}

/** 고시 상한 (같은 상한 연도 안에서 기간 전체에 대한 금액) */
function periodCap(kind, days, monthly, cap20) {
  const P = v('periodCaps2026');
  if (kind === 'maternity') {
    if (monthly === 2200000 && days === 90) return P.d90;
    if (monthly === 2200000 && days === 100) return P.d100;
    if (monthly === 2200000 && days === 120) return P.d120;
    return fl(monthly * days / 30);
  }
  if (cap20 === P.spouse20 && days === 20) return P.spouse20;
  return fl(cap20 * days / 20);
}

/**
 * @param {object} p
 * @param {'maternity'|'spouse'} p.kind
 * @param {'priority'|'large'} p.company 우선지원대상기업 / 대규모기업
 * @param {number} p.wage 월 통상임금
 * @param {number} [p.monthlyHours=209] 월 통상임금 산정기준시간
 * @param {number} [p.dailyHours=8] 1일 소정근로시간 (배우자 휴가 일급)
 * @param {string} p.startDate 휴가 시작일
 * @param {'single'|'premature'|'multiple'} [p.birthType] 출산전후휴가 유형
 * @param {number} [p.spouseDays=20] 배우자 출산전후휴가 사용 일수
 */
export function calcMaternityLeave(p) {
  const kind = p.kind === 'spouse' ? 'spouse' : 'maternity';
  const company = p.company === 'large' ? 'large' : 'priority';
  const wage = Math.max(0, Number(p.wage) || 0);
  if (!wage) throw new Error('월 통상임금을 입력하세요.');
  if (!p.startDate) throw new Error('휴가 시작일을 입력하세요.');
  const start = parseDate(p.startDate);
  const s = fmtDate(start);
  if (s < ALLOWED_FROM || s > ALLOWED_TO) throw new Error('이 계산기는 2026년 1월 1일~12월 31일에 시작하는 휴가만 계산합니다 (그 밖의 기간은 상한액·최저임금이 다릅니다).');
  const warnings = [];
  const hr = hourlyOrdinary(wage, p.monthlyHours, s);

  if (kind === 'maternity') {
    const type = ['single', 'premature', 'multiple'].includes(p.birthType) ? p.birthType : 'single';
    const days = v('leaveDays')[type];
    const employerDays = v('employerPaidDays')[type];
    const monthlyWage = hr.applied * hr.hours; // 하한 적용 후 월 통상임금
    const dailyWage = monthlyWage / 30;
    const realDaily = wage / 30;
    const firstInsured = company === 'priority' ? 1 : employerDays + 1;
    const insuredDays = company === 'priority' ? days : Math.min(v('largeFirmInsuredDays')[type], days - employerDays);
    const rows = [];
    let insured = 0; let topUp = 0; let employerFull = 0; let crossYear = false; const capsUsed = new Set();
    for (let i = 1; i <= days; i++) {
      const date = fmtDate(addDays(start, i - 1));
      const isInsured = i >= firstInsured && i < firstInsured + insuredDays;
      const capM = monthlyCapOn(date);
      capsUsed.add(capM);
      if (date > KNOWN_CAP_UNTIL) crossYear = true;
      const capDaily = capM / 30;
      if (isInsured) {
        const pay = Math.min(dailyWage, capDaily);
        insured += pay;
        if (i <= employerDays) topUp += Math.max(0, realDaily - pay);
      } else if (i <= employerDays) {
        employerFull += realDaily;
      }
      rows.push({ day: i, date, insured: isInsured, employer: i <= employerDays });
    }
    // 같은 상한이 기간 전체에 적용되면 고시 금액을 한도로 (예: 100일 7,333,330원)
    if (capsUsed.size === 1) insured = Math.min(insured, periodCap('maternity', insuredDays, [...capsUsed][0]));
    insured = fl(insured); topUp = fl(topUp); employerFull = fl(employerFull);
    if (crossYear) warnings.push('휴가 기간이 2027년으로 넘어갑니다. 2027년 상한액 고시가 아직 나오지 않아 2027년 휴가일도 2026년 상한(월 220만원)으로 계산했습니다. 2027년 최저임금(월 2,236,300원)이 현 상한보다 높아 상한이 오를 가능성이 큽니다. 확인 필요.');
    if (hr.floored) warnings.push(`시간급 통상임금 ${Math.round(hr.hourly).toLocaleString('ko-KR')}원이 휴가 시작일 당시 최저임금 ${hr.minWage.toLocaleString('ko-KR')}원보다 낮아 최저임금으로 계산했습니다 (시행령 제101조2호).`);
    const end = fmtDate(addDays(start, days - 1));
    const lastInsured = firstInsured + insuredDays - 1;
    return {
      kind, company, type, days, employerDays, insuredDays, firstInsured, lastInsured,
      start: s, end, wage, hr, monthlyWage, dailyWage, realDaily,
      capMonthly: monthlyCapOn(s), capDaily: monthlyCapOn(s) / 30,
      insured, topUp, employerFull, employerTotal: topUp + employerFull,
      total: insured + topUp + employerFull, fullWage: fl(realDaily * days),
      capBinding: dailyWage > monthlyCapOn(s) / 30, warnings,
    };
  }

  // 배우자 출산전후휴가
  const sp = v('spouseLeave');
  const used = Math.max(1, Math.min(sp.days, Math.floor(Number(p.spouseDays) || sp.days)));
  const dailyHours = Number(p.dailyHours) > 0 ? Math.min(8, Number(p.dailyHours)) : 8;
  const dailyWage = hr.applied * dailyHours;
  const realDaily = (wage / hr.hours) * dailyHours;
  const cap20 = spouseCap20On(s);
  const capDaily = cap20 / 20;
  let insured = 0;
  if (company === 'priority') {
    insured = Math.min(dailyWage, capDaily) * used;
    insured = Math.min(insured, periodCap('spouse', used, null, cap20));
    insured = fl(insured);
  }
  const employerTotal = company === 'priority' ? Math.max(0, fl(realDaily * used) - insured) : fl(realDaily * used);
  if (hr.floored) warnings.push(`시간급 통상임금 ${Math.round(hr.hourly).toLocaleString('ko-KR')}원이 최저임금 ${hr.minWage.toLocaleString('ko-KR')}원보다 낮아 최저임금으로 계산했습니다 (시행령 제101조2호).`);
  if (company === 'large') warnings.push('대규모기업(우선지원대상기업이 아닌 회사) 근로자는 배우자 출산전후휴가급여를 고용보험에서 받지 못하고, 회사가 20일 모두 유급으로 줘야 합니다 (남녀고용평등법 제18조의2①).');
  return {
    kind, company, used, maxDays: sp.days, start: s, wage, hr, dailyHours, dailyWage, realDaily,
    cap20, capDaily, insured, employerTotal, total: insured + employerTotal, fullWage: fl(realDaily * used),
    capBinding: company === 'priority' && dailyWage > capDaily, warnings,
  };
}
