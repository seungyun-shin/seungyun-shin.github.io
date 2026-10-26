// 날짜 유틸리티 — 'YYYY-MM-DD' 문자열과 UTC 기준 Date만 다룬다 (시간대 영향 제거).

const DAY = 86400000;

export function parseDate(s) {
  if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) throw new Error(`날짜 형식이 올바르지 않습니다: ${s}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    throw new Error(`존재하지 않는 날짜입니다: ${s}`);
  }
  return dt;
}

export function fmtDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  return new Date(d.getTime() + n * DAY);
}

/** a부터 b까지 날짜 차이 (b - a, 일 단위) */
export function diffDays(a, b) {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

/** a~b 양 끝 포함 일수 */
export function daysInclusive(a, b) {
  return diffDays(a, b) + 1;
}

export function lastDayOfMonth(y, m0) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
}

/**
 * 민법 제157조·제160조에 따른 "기산일로부터 n개월(또는 n년)이 지난 다음 날".
 * 근로 첫날(초일)을 산입하므로, 기간은 '최종 월에서 기산일에 해당하는 날의 전일'에 끝나고
 * 그 다음 날(=해당일)에 권리가 발생한다. 최종 월에 해당일이 없으면 그 월의 말일에 기간이
 * 만료되므로 다음 달 1일이 발생일이 된다.
 */
export function anniversaryAfterMonths(start, months) {
  const y = start.getUTCFullYear();
  const m0 = start.getUTCMonth() + months;
  const d = start.getUTCDate();
  const ty = y + Math.floor(m0 / 12);
  const tm = ((m0 % 12) + 12) % 12;
  const last = lastDayOfMonth(ty, tm);
  if (d <= last) return new Date(Date.UTC(ty, tm, d));
  // 해당일이 없음 → 말일에 만료 → 다음 날(다음 달 1일)
  return new Date(Date.UTC(ty, tm + 1, 1));
}

/** start로부터 months개월 전 같은 날 (평균임금 3개월 역산용, 해당일이 없으면 말일 다음 날) */
export function monthsBefore(d, months) {
  return anniversaryAfterMonths(d, -months);
}

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInYear(y) {
  return isLeapYear(y) ? 366 : 365;
}

export function minDate(a, b) {
  return a.getTime() <= b.getTime() ? a : b;
}

export function maxDate(a, b) {
  return a.getTime() >= b.getTime() ? a : b;
}

export function cmp(a, b) {
  return a.getTime() - b.getTime();
}

/** 만 n년 근속 여부 등에 쓰는 '완성된 개월 수' (start 포함, end 포함 기준) */
export function completedMonths(start, endInclusive) {
  // end 다음 날이 anniversaryAfterMonths(start, k) 이상이면 k개월 완성
  const next = addDays(endInclusive, 1);
  let k = Math.max(0, (next.getUTCFullYear() - start.getUTCFullYear()) * 12 + (next.getUTCMonth() - start.getUTCMonth()) - 1);
  while (cmp(anniversaryAfterMonths(start, k + 1), next) <= 0) k++;
  while (k > 0 && cmp(anniversaryAfterMonths(start, k), next) > 0) k--;
  return k;
}
