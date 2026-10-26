// 만 나이·날짜 계산 — 민법 제158조(2023.6.28. 시행 만 나이 통일), 행정기본법 제7조의2, 민법 제160조
// 만 나이: 출생일을 산입해 계산 → 생일(출생일의 해당일) 당일에 한 살 더. 해당일이 없는 2월 29일생은
// 평년에 2월 28일로 기간이 끝나(민법 제160조③) 3월 1일에 한 살 더 (date.js anniversaryAfterMonths 와 같은 규칙).
// 연 나이 = 기준연도 − 출생연도 (청소년보호법 등 일부 법률), 세는 나이 = 연 나이 + 1 (참고용, 법적 근거 없음).
import { parseDate, fmtDate, addDays, diffDays, anniversaryAfterMonths, cmp } from './date.js';

/** start 기준 '다 채운' 개월 수 (end 당일이 해당일이면 그 달까지 채운 것으로 본다) */
function fullMonths(start, end) {
  let k = Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) - 1);
  while (cmp(anniversaryAfterMonths(start, k + 1), end) <= 0) k++;
  while (k > 0 && cmp(anniversaryAfterMonths(start, k), end) > 0) k--;
  return k;
}

/**
 * @param {object} p
 * @param {string} p.birthDate YYYY-MM-DD
 * @param {string} p.baseDate 기준일 YYYY-MM-DD
 */
export function calcAge(p) {
  const birth = parseDate(p.birthDate);
  const base = parseDate(p.baseDate);
  if (cmp(base, birth) < 0) throw new Error('기준일이 생년월일보다 빠릅니다.');
  const months = fullMonths(birth, base);
  const manAge = Math.floor(months / 12);
  const yearAge = base.getUTCFullYear() - birth.getUTCFullYear();
  const lastBirthday = anniversaryAfterMonths(birth, manAge * 12);
  const nextBirthday = anniversaryAfterMonths(birth, (manAge + 1) * 12);
  return {
    birthDate: fmtDate(birth),
    baseDate: fmtDate(base),
    manAge,
    monthsTotal: months,
    monthsOver: months - manAge * 12, // 만 n세 m개월의 m
    yearAge,
    countingAge: yearAge + 1,
    diffYearVsMan: yearAge - manAge,
    lastBirthday: fmtDate(lastBirthday),
    nextBirthday: fmtDate(nextBirthday),
    nextAge: manAge + 1,
    daysToNextBirthday: diffDays(base, nextBirthday),
    isBirthday: cmp(lastBirthday, base) === 0 && manAge > 0,
    daysLived: diffDays(birth, base) + 1, // 출생일을 1일째로 셈
    leapDayBirth: birth.getUTCMonth() === 1 && birth.getUTCDate() === 29,
  };
}

/**
 * 두 날짜 사이
 * @param {object} p
 * @param {string} p.startDate
 * @param {string} p.endDate
 * @param {boolean} [p.includeStart] 시작일을 1일째로 셀지 (양 끝 포함 일수)
 */
export function calcDateDiff(p) {
  let a = parseDate(p.startDate);
  let b = parseDate(p.endDate);
  const swapped = cmp(b, a) < 0;
  if (swapped) [a, b] = [b, a];
  const days = diffDays(a, b);
  const includeStart = p.includeStart === true || p.includeStart === '1' || p.includeStart === 'true';
  const months = fullMonths(a, b);
  const afterMonths = anniversaryAfterMonths(a, months);
  return {
    startDate: fmtDate(a), endDate: fmtDate(b), swapped,
    days,
    daysInclusive: days + 1,
    shownDays: includeStart ? days + 1 : days,
    includeStart,
    weeks: Math.floor(days / 7),
    weekRemainder: days % 7,
    years: Math.floor(months / 12),
    monthsRem: months % 12,
    // 달력상 '○년 ○개월 ○일' (시작일 다음 날부터 센 경과 기간)
    daysRem: diffDays(afterMonths, b),
    monthsTotal: months,
  };
}

/**
 * D-day
 * @param {object} p
 * @param {string} p.today 기준일(오늘)
 * @param {string} p.targetDate 목표일
 */
export function calcDday(p) {
  const today = parseDate(p.today);
  const target = parseDate(p.targetDate);
  const n = diffDays(today, target);
  return {
    today: fmtDate(today), targetDate: fmtDate(target),
    diff: n,
    absDiff: Math.abs(n),
    label: n > 0 ? `D-${n}` : n < 0 ? `D+${-n}` : 'D-Day',
    weekday: '일월화수목금토'[target.getUTCDay()],
  };
}

export const ANNIV_DAYS = [100, 200, 300, 365, 500, 1000, 2000, 3000, 5000, 10000];

/**
 * 기념일 (○일째 되는 날, ○주년)
 * @param {object} p
 * @param {string} p.startDate 시작일(만난 날·출생일 등)
 * @param {boolean} [p.countStartAsDay1] 시작일을 1일째로 셈 (기본 true — 백일·연애 기념일에서 흔히 쓰는 방식)
 * @param {string} [p.today] 지난 기념일 표시용 기준일
 * @param {number} [p.customDay] 직접 넣는 ○일째
 * @param {number} [p.years] ○주년까지 표시 (기본 10)
 */
export function calcAnniversaries(p) {
  const start = parseDate(p.startDate);
  const day1 = !(p.countStartAsDay1 === false || p.countStartAsDay1 === '0' || p.countStartAsDay1 === 'false');
  const today = p.today ? parseDate(p.today) : null;
  const custom = Number(p.customDay);
  const years = Number(p.years) || 10;
  const list = [...ANNIV_DAYS];
  if (Number.isInteger(custom) && custom > 0 && custom <= 100000 && !list.includes(custom)) list.push(custom);
  list.sort((x, y) => x - y);
  const wd = (d) => '일월화수목금토'[d.getUTCDay()];
  const mk = (label, d, extra = {}) => ({
    label, date: fmtDate(d), weekday: wd(d), ...extra,
    passed: today ? cmp(d, today) < 0 : false,
    dday: today ? diffDays(today, d) : null,
  });
  const days = list.map((n) => mk(`${n.toLocaleString('ko-KR')}일`, addDays(start, day1 ? n - 1 : n), { n }));
  const yearly = Array.from({ length: years }, (_, k) => mk(`${k + 1}주년`, anniversaryAfterMonths(start, (k + 1) * 12), { year: k + 1 }));
  const byN = Object.fromEntries(days.map((d) => [d.n, d]));
  const todayCount = today ? diffDays(start, today) + (day1 ? 1 : 0) : null;
  return { startDate: fmtDate(start), countStartAsDay1: day1, days, yearly, byN, todayCount };
}

/** 화면용 묶음: mode = age | diff | dday | anniv */
export function calcDates(p) {
  const mode = p.mode || 'age';
  if (mode === 'age') return { mode, ...calcAge({ birthDate: p.birthDate, baseDate: p.baseDate }) };
  if (mode === 'diff') return { mode, ...calcDateDiff({ startDate: p.startDate, endDate: p.endDate, includeStart: p.includeStart }) };
  if (mode === 'dday') return { mode, ...calcDday({ today: p.baseDate, targetDate: p.targetDate }) };
  if (mode === 'anniv') return { mode, ...calcAnniversaries({ startDate: p.startDate, countStartAsDay1: p.countStartAsDay1, today: p.baseDate, customDay: p.customDay }) };
  throw new Error(`계산 종류가 올바르지 않습니다: ${mode}`);
}
