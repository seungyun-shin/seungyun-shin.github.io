// 연차유급휴가 계산 — 근로기준법 제60조
// 순수 함수만 둔다 (DOM 의존 없음).
import {
  parseDate, fmtDate, addDays, diffDays, anniversaryAfterMonths, cmp, daysInclusive,
} from './date.js';

export const LAW = {
  art60: 'https://www.law.go.kr/법령/근로기준법/제60조',
  art61: 'https://www.law.go.kr/법령/근로기준법/제61조',
};

/** 근속 k년(만)이 되는 날 발생하는 연차 일수: 15일 + 최초 1년 초과 매 2년마다 1일, 최대 25일 (제60조①④) */
export function annualDaysForYear(k) {
  if (k < 1) return 0;
  return Math.min(25, 15 + Math.floor((k - 1) / 2));
}

/**
 * 입사일 기준 발생 내역.
 * @param {Date} hire 입사일(첫 근무일)
 * @param {Date} lastDay 마지막 근무일(재직 중이면 계산 기준일). 발생일에 근로관계가 있어야 발생한다
 *   (대법원 2021다227100, 고용노동부 행정해석 변경 2021-12-16: "1년 근로 + 그 다음 날 근로관계 존속").
 */
export function hireBasisEvents(hire, lastDay, opts = {}) {
  const lowAttendanceYears = new Set(opts.lowAttendanceYears || []);
  const events = [];
  // 1년 미만: 1개월 개근 시 1일, 최대 11일 (제60조②)
  for (let n = 1; n <= 11; n++) {
    const d = anniversaryAfterMonths(hire, n);
    if (cmp(d, lastDay) > 0) break;
    events.push({ date: fmtDate(d), days: 1, kind: 'monthly', label: `입사 ${n}개월 개근`, basis: '제60조②' });
  }
  // 1년 이상: 매 근속연수 도달일에 발생
  for (let k = 1; k <= 60; k++) {
    const d = anniversaryAfterMonths(hire, 12 * k);
    if (cmp(d, lastDay) > 0) break;
    if (lowAttendanceYears.has(k)) {
      events.push({ date: fmtDate(d), days: 0, kind: 'annual', label: `근속 ${k}년 (출근율 80% 미만 — 별도 산정 필요)`, basis: '제60조②', warn: true });
      continue;
    }
    const days = annualDaysForYear(k);
    events.push({
      date: fmtDate(d), days, kind: 'annual',
      label: `근속 ${k}년 (${k === 1 ? '1년간 80% 이상 출근' : k >= 3 ? `3년 이상, 가산 ${days - 15}일` : '1년간 80% 이상 출근'})`,
      basis: k >= 3 ? '제60조①④' : '제60조①',
    });
  }
  return events;
}

/** 회계연도 시작일들 (hire 다음 회계연도부터) */
function fiscalStart(year, startMonth) {
  return new Date(Date.UTC(year, startMonth - 1, 1));
}

/**
 * 회계연도 기준 발생 내역 (고용노동부 「연차유급휴가 회계연도 기준 운영」 방식).
 * - 입사 후 1년 미만 기간의 월 단위 연차(제60조②)는 입사일 기준으로 그대로 발생
 * - 입사 다음 회계연도 첫날: 입사연도 재직기간 비례 연차 = 15 × 재직일수 ÷ 그 회계연도 일수
 * - 그다음 회계연도부터: 입사연도를 1년으로 보고 j번째 회계연도 시작일에 근속 j년 일수 부여
 *   (j=2 → 15일, j=3 → 16일, j=5 → 17일 …, 최대 25일)
 */
export function fiscalBasisEvents(hire, lastDay, opts = {}) {
  const startMonth = opts.fyStartMonth || 1;
  const events = [];
  for (let n = 1; n <= 11; n++) {
    const d = anniversaryAfterMonths(hire, n);
    if (cmp(d, lastDay) > 0) break;
    events.push({ date: fmtDate(d), days: 1, kind: 'monthly', label: `입사 ${n}개월 개근`, basis: '제60조②' });
  }
  // 입사일이 속한 회계연도의 시작
  let fy0Year = hire.getUTCFullYear();
  if (hire.getUTCMonth() + 1 < startMonth) fy0Year -= 1;
  const fy0Start = fiscalStart(fy0Year, startMonth);
  const fy1Start = fiscalStart(fy0Year + 1, startMonth);
  const fyLen = diffDays(fy0Start, fy1Start);
  const workedInFy0 = diffDays(hire, fy1Start); // 입사일 포함 ~ 회계연도 말일
  for (let j = 1; j <= 60; j++) {
    const d = fiscalStart(fy0Year + j, startMonth);
    if (cmp(d, lastDay) > 0) break;
    if (j === 1) {
      const raw = (15 * workedInFy0) / fyLen;
      const days = Math.round(raw * 100) / 100;
      events.push({
        date: fmtDate(d), days, kind: 'prorated',
        label: `입사연도 비례 연차 (15일 × ${workedInFy0}일 ÷ ${fyLen}일)`,
        basis: '고용노동부 회계연도 기준 운영 지침', prorated: { workedDays: workedInFy0, fyLen, raw },
      });
    } else {
      const days = annualDaysForYear(j);
      events.push({ date: fmtDate(d), days, kind: 'annual', label: `${j}번째 회계연도 (근속 ${j}년차로 산정)`, basis: j >= 3 ? '제60조①④' : '제60조①' });
    }
  }
  return events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function sumDays(events) {
  return Math.round(events.reduce((s, e) => s + e.days, 0) * 100) / 100;
}

/** 1일 통상임금 = 월 통상임금 ÷ 월 통상임금 산정 기준시간 수 × 1일 소정근로시간 */
export function dailyOrdinaryWage(monthlyOrdinaryWage, { monthlyHours = 209, dailyHours = 8 } = {}) {
  if (!(monthlyOrdinaryWage > 0)) return 0;
  return (monthlyOrdinaryWage / monthlyHours) * dailyHours;
}

/**
 * 메인 계산.
 * @param {object} p
 * @param {string} p.hireDate 입사일
 * @param {string} p.endDate 재직 중이면 계산 기준일, 퇴사면 마지막 근무일
 * @param {'employed'|'retire'} p.status
 * @param {'hire'|'fiscal'} p.basis 회사의 연차 운영 기준
 * @param {number} [p.fyStartMonth=1]
 * @param {number} [p.unusedDays] 미사용 연차 일수 (수당 계산용)
 * @param {number} [p.monthlyOrdinaryWage] 월 통상임금
 */
export function calcAnnualLeave(p) {
  const hire = parseDate(p.hireDate);
  const end = parseDate(p.endDate);
  if (cmp(end, hire) < 0) throw new Error('기준일(마지막 근무일)이 입사일보다 빠릅니다.');
  const opts = { fyStartMonth: Number(p.fyStartMonth) || 1, lowAttendanceYears: p.lowAttendanceYears };
  const hireEvents = hireBasisEvents(hire, end, opts);
  const fiscalEvents = fiscalBasisEvents(hire, end, opts);
  const hireTotal = sumDays(hireEvents);
  const fiscalTotal = sumDays(fiscalEvents);
  const serviceDays = daysInclusive(hire, end);
  const daily = dailyOrdinaryWage(Number(p.monthlyOrdinaryWage) || 0, {
    monthlyHours: Number(p.monthlyHours) || 209,
    dailyHours: Number(p.dailyHours) || 8,
  });
  const unused = Math.max(0, Number(p.unusedDays) || 0);
  const basis = p.basis === 'fiscal' ? 'fiscal' : 'hire';

  // 퇴사 정산: 회계연도 기준 누적이 입사일 기준 누적보다 적으면 그 차이를 수당으로 정산
  let settlementDays = 0;
  if (p.status === 'retire' && basis === 'fiscal' && fiscalTotal < hireTotal) {
    settlementDays = Math.round((hireTotal - fiscalTotal) * 100) / 100;
  }
  const allowanceUnused = Math.floor(unused * daily);
  const allowanceSettlement = Math.floor(settlementDays * daily);

  // 재직 중: 가장 최근 연 단위 발생분(현재 사용 주기)
  const primary = basis === 'fiscal' ? fiscalEvents : hireEvents;
  const latestAnnual = [...primary].reverse().find((e) => e.kind !== 'monthly') || null;
  const monthlyInFirstYear = primary.filter((e) => e.kind === 'monthly');
  const firstYearEnd = addDays(anniversaryAfterMonths(hire, 12), -1);

  return {
    hireDate: fmtDate(hire),
    endDate: fmtDate(end),
    serviceDays,
    retirementDate: p.status === 'retire' ? fmtDate(addDays(end, 1)) : null,
    basis,
    hireEvents, fiscalEvents, hireTotal, fiscalTotal,
    latestAnnual,
    monthlyCount: monthlyInFirstYear.length,
    monthlyUseDeadline: fmtDate(firstYearEnd), // 1년 미만 월차 사용기한: 입사 후 1년 (제60조⑦ 단서)
    dailyWage: daily,
    unusedDays: unused,
    allowanceUnused,
    settlementDays,
    allowanceSettlement,
    allowanceTotal: allowanceUnused + allowanceSettlement,
  };
}
