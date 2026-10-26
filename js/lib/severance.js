// 퇴직금 계산 — 근로자퇴직급여 보장법 제8조, 근로기준법 제2조①6호·②
import { parseDate, fmtDate, addDays, diffDays, monthsBefore, anniversaryAfterMonths, cmp } from './date.js';

/**
 * @param {object} p
 * @param {string} p.hireDate 입사일
 * @param {string} p.lastWorkDate 마지막 근무일 (퇴직일 = 다음 날)
 * @param {number} [p.monthlyBase] 월 기본급
 * @param {number} [p.monthlyAllowance] 월 기타수당(고정·변동 포함 임금)
 * @param {number} [p.threeMonthTotal] 3개월 임금총액 직접 입력(있으면 우선)
 * @param {number} [p.annualBonus] 직전 1년간 상여금 총액
 * @param {number} [p.annualLeavePay] 직전 1년간 지급(확정)된 연차수당 — 퇴직으로 새로 생기는 연차수당 제외
 * @param {number} [p.monthlyOrdinaryWage] 월 통상임금 (평균임금과 비교)
 * @param {number} [p.monthlyHours=209]
 * @param {boolean} [p.under15h] 4주 평균 주 15시간 미만
 */
export function calcSeverance(p) {
  const hire = parseDate(p.hireDate);
  const last = parseDate(p.lastWorkDate);
  if (cmp(last, hire) < 0) throw new Error('마지막 근무일이 입사일보다 빠릅니다.');
  const retire = addDays(last, 1); // 퇴직일
  const serviceDays = diffDays(hire, retire); // 재직일수 (입사일 ~ 마지막 근무일)
  const oneYear = anniversaryAfterMonths(hire, 12);
  const eligibleByPeriod = cmp(retire, oneYear) >= 0;
  const eligible = eligibleByPeriod && !p.under15h;

  const periodStart = monthsBefore(retire, 3);
  const periodDays = diffDays(periodStart, retire);
  const monthlyBase = Number(p.monthlyBase) || 0;
  const monthlyAllowance = Number(p.monthlyAllowance) || 0;
  const wages3m = Number(p.threeMonthTotal) > 0 ? Number(p.threeMonthTotal) : (monthlyBase + monthlyAllowance) * 3;
  const bonusAdd = (Number(p.annualBonus) || 0) * 3 / 12;
  const leaveAdd = (Number(p.annualLeavePay) || 0) * 3 / 12;
  const total = wages3m + bonusAdd + leaveAdd;
  // 1일 평균임금: 전(0.01원) 미만 올림 — 고용노동부 퇴직금 계산기(retire_cal.js myCeil)와 안내 예시
  // "88,641원 31전 = 8,155,000원 ÷ 92일"에 맞춤. 법령에 끝수 규정은 없음.
  const avgDaily = Math.ceil((total / periodDays) * 100 - 1e-6) / 100;

  const monthlyOrdinary = Number(p.monthlyOrdinaryWage) > 0 ? Number(p.monthlyOrdinaryWage) : 0;
  const ordinaryDaily = monthlyOrdinary ? Math.floor((monthlyOrdinary / (Number(p.monthlyHours) || 209)) * 8 * 100) / 100 : 0;
  const useOrdinary = ordinaryDaily > avgDaily;
  const appliedDaily = useOrdinary ? ordinaryDaily : avgDaily;

  // 퇴직금: 원 미만 반올림 — 고용노동부 퇴직금 계산기(calRet: Math.round)와 같게
  const severance = eligible ? Math.round(appliedDaily * 30 * serviceDays / 365) : 0;
  return {
    hireDate: fmtDate(hire), lastWorkDate: fmtDate(last), retireDate: fmtDate(retire),
    serviceDays, serviceYears: serviceDays / 365,
    eligible, eligibleByPeriod, under15h: !!p.under15h,
    periodStart: fmtDate(periodStart), periodEnd: fmtDate(last), periodDays,
    wages3m, bonusAdd, leaveAdd, total,
    avgDaily, ordinaryDaily, useOrdinary, appliedDaily,
    severance,
  };
}
