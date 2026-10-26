// 청약 가점 — 주택공급에 관한 규칙 별표 1 (가점제 적용기준), 제10조⑥(미성년 가입기간), 제53조(주택소유 판정)
// 84점 만점 = 무주택기간 32 + 부양가족수 35 + 주택청약종합저축 가입기간 17
// 순수 함수만 둔다 (DOM 의존 없음). 모든 점수표는 src/rates/2026.js 의 RATES.housingScore 에서 읽는다.
import { RATES } from '../rates/2026.js';
import { parseDate, fmtDate, addDays, diffDays, anniversaryAfterMonths, cmp, maxDate, minDate } from './date.js';

const H = RATES.housingScore;
const v = (k) => H[k].value;
const int = (x) => Math.max(0, Math.floor(Number(x) || 0));

export const LAW = {
  table: '주택공급에 관한 규칙 별표 1',
  homeless: '별표 1 제1호가목3)',
  dependents: '별표 1 제1호나목',
  account: '별표 1 제1호다목',
  spouse: '별표 1 비고 2',
  minor: '주택공급에 관한 규칙 제10조⑥',
  ownership: '주택공급에 관한 규칙 제53조',
  exclusion: '주택공급에 관한 규칙 제28조⑥',
};

/** start부터 end까지 '다 채운' 개월 수 (start + k개월이 되는 날이 end 이하인 최대 k) */
export function fullMonths(start, end) {
  if (cmp(end, start) < 0) return 0;
  let k = Math.max(0, (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) - 1);
  while (cmp(anniversaryAfterMonths(start, k + 1), end) <= 0) k++;
  while (k > 0 && cmp(anniversaryAfterMonths(start, k), end) > 0) k--;
  return k;
}

/** 만 n세가 되는 날 (생일. 2월 29일생은 평년에 3월 1일) */
export function birthdayAt(birth, age) {
  return anniversaryAfterMonths(birth, age * 12);
}

/** 무주택기간 점수: years = 다 채운 햇수, homeless=false 이면 0점 */
export function homelessPoints(years, homeless = true) {
  const p = v('homelessPoints');
  if (!homeless) return p.zero;
  return Math.min(p.cap, p.under1 + int(years) * p.step);
}

/** 부양가족 점수: 본인 제외 인원 */
export function dependentPoints(n) {
  const p = v('dependentPoints');
  return Math.min(p.cap, p.zero + int(n) * p.perPerson);
}

/** 청약통장 가입기간 점수: months = 다 채운 개월 수 (가입하지 않았으면 null → 0점) */
export function accountPoints(months) {
  if (months == null) return 0;
  const p = v('accountPoints');
  const m = int(months);
  if (m < 6) return p.under6m;
  if (m < 12) return p.under1y;
  return Math.min(p.cap, p.perYearFrom1y + Math.floor(m / 12) - 1);
}

/** 배우자 통장 점수: 배우자 가입기간의 50%에 해당하는 기간의 점수, 최대 3점 (별표 1 비고 2) */
export function spouseAccountPoints(months) {
  if (months == null) return 0;
  const half = int(months) * v('spouseAccount').ratio;
  return Math.min(v('spouseAccount').cap, accountPoints(half));
}

/**
 * 미성년 가입기간 인정 한도 (제10조⑥): 2023.12.31. 이전 미성년 기간은 2년까지, 2024.1.1. 이후와 합쳐 5년까지.
 * 일 단위로 계산해 초과 일수만큼 기산일을 뒤로 미룬다.
 */
export function minorAdjustment(accountStart, birth, notice) {
  const m = v('minorAccount');
  const adult = birthdayAt(birth, 19);
  const cut = parseDate('2024-01-01');
  const minorEnd = minDate(adult, notice);
  if (cmp(accountStart, minorEnd) >= 0) return { excessDays: 0, minorDays: 0, recognizedDays: 0, preDays: 0, postDays: 0 };
  const preEnd = minDate(minorEnd, cut);
  const preDays = Math.max(0, diffDays(accountStart, preEnd));
  const postStart = maxDate(accountStart, cut);
  const postDays = Math.max(0, diffDays(postStart, minorEnd));
  const preCap = diffDays(accountStart, anniversaryAfterMonths(accountStart, m.before2024Cap * 12));
  const totalCap = diffDays(accountStart, anniversaryAfterMonths(accountStart, m.totalCap * 12));
  const recognizedDays = Math.min(Math.min(preDays, preCap) + postDays, totalCap);
  const minorDays = preDays + postDays;
  return { excessDays: minorDays - recognizedDays, minorDays, recognizedDays, preDays, postDays, adult: fmtDate(adult) };
}

/* ---- 청약홈 가점계산기 방식 (selectAddpntCalculatorView.do 공개 스크립트 이식, 2026-10-25 감사) ----
 * 청약홈은 미성년·성년 구간을 각각 '개월'로 내림해 더한다. 조문(제10조⑥)대로 일 단위로 이어 세면
 * 약 0.7%의 경우 1점 높게 나온다 (무작위 2만 건 비교). 실제 부적격 판정은 청약홈 기준이므로
 * 화면에는 두 방식 중 낮은 점수를 보여 준다 (높게 적었다가 당첨 취소되는 위험 방지). */
function ahDiffMonth(a, b) {
  const [sy, sm, sd] = a.split('-').map(Number);
  const [ey, em, ed] = b.split('-').map(Number);
  let dY = ey - sy; let dM = em - sm; const dD = ed - sd;
  if (dD < 0) dM--;
  if (dM < 0 && dY > 0) { dY--; dM += 12; }
  return dM >= 0 ? dY * 12 + dM : 0;
}
function ahPlusYears(iso, years) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));  // 평년의 2월 29일 → 3월 1일 (청약홈 스크립트와 동일)
  return dt.toISOString().slice(0, 10);
}
function ahMinorMonths(acct, adult, notice) {
  const le = (a, b) => a <= b;  // ISO 날짜 문자열 비교
  const r0 = ahDiffMonth(acct, adult), r1 = ahDiffMonth(acct, '2023-12-31'), r2 = ahDiffMonth('2024-01-01', adult);
  const r3 = ahDiffMonth(acct, notice), r4 = ahDiffMonth('2024-01-01', notice);
  if (r0 <= 0) return 0;
  let r = 0;
  if (le(acct, '2023-12-31') && le(adult, '2023-12-31')) r = Math.min(24, r0);
  if (le('2024-01-01', acct) && le('2024-01-01', adult)) r = notice > adult ? r0 : r3;
  if (le(acct, '2023-12-31') && le('2024-01-01', adult)) r = Math.min(24, r1) + (notice > adult ? r2 : r4);
  return Math.min(60, r);
}
/** 청약홈 방식 통장 가입기간 (개월). 날짜는 'YYYY-MM-DD' */
export function applyhomeAccountMonths(birthIso, acctIso, noticeIso) {
  const adult = ahPlusYears(birthIso, 19);
  const pre = Math.min(60, Math.max(0, ahMinorMonths(acctIso, adult, noticeIso)));
  const adultMonths = pre > 0 ? (noticeIso > adult ? ahDiffMonth(adult, noticeIso) : 0) : ahDiffMonth(acctIso, noticeIso);
  return pre + adultMonths;
}

/**
 * @param {object} p
 * @param {string} p.noticeDate 입주자모집공고일
 * @param {string} p.birthDate 신청자 생년월일
 * @param {boolean} [p.married] 혼인 중(혼인신고)
 * @param {string} [p.marriageDate] 혼인신고일
 * @param {boolean} [p.ownsNow] 공고일 현재 세대원 중 주택(분양권 포함) 소유자 있음 (제53조 예외 주택 제외)
 * @param {boolean} [p.everOwned] 신청자·배우자가 주택을 소유했다가 처분한 적 있음
 * @param {string} [p.disposalDate] 최근 처분해 무주택자가 된 날
 * @param {boolean} [p.householdHead] 신청자가 세대주 (직계존속 부양가족 인정 요건)
 * @param {number} [p.ascendants] 3년 이상 같은 등본의 직계존속(본인·배우자 부모·조부모), 주택 소유 없음
 * @param {number} [p.children] 30세 미만 미혼 자녀(손자녀는 부모 모두 사망한 경우)
 * @param {number} [p.adultChildren] 30세 이상 미혼 자녀로 1년 이상 같은 등본
 * @param {string} [p.accountDate] 청약통장 최초 가입일(순위기산일)
 * @param {string} [p.spouseAccountDate] 배우자 청약통장 가입일
 */
export function calcHousingScore(p) {
  if (!p.noticeDate) throw new Error('입주자모집공고일을 입력하세요.');
  if (!p.birthDate) throw new Error('생년월일을 입력하세요.');
  const notice = parseDate(p.noticeDate);
  const birth = parseDate(p.birthDate);
  if (cmp(birth, notice) >= 0) throw new Error('생년월일이 공고일보다 늦습니다.');
  const married = !!p.married;
  const marriage = married && p.marriageDate ? parseDate(p.marriageDate) : null;
  if (married && !marriage) throw new Error('혼인신고일을 입력하세요.');
  if (marriage && cmp(marriage, notice) > 0) throw new Error('혼인신고일이 공고일보다 늦습니다.');
  const warnings = [];

  // ① 무주택기간
  const age30 = birthdayAt(birth, v('homelessStart').age);
  let start = null; let startReason = '';
  if (marriage && cmp(marriage, age30) < 0) { start = marriage; startReason = '30세 전 혼인 → 혼인신고일'; } else { start = age30; startReason = '만 30세가 되는 날'; }
  let disposal = null;
  if (p.everOwned && p.disposalDate) {
    disposal = parseDate(p.disposalDate);
    if (cmp(disposal, notice) > 0) throw new Error('주택 처분일이 공고일보다 늦습니다.');
    if (cmp(disposal, start) > 0) { start = disposal; startReason = '주택을 처분해 무주택자가 된 날 (30세·혼인신고일보다 늦음)'; }
  } else if (p.everOwned) {
    throw new Error('주택을 처분한 날을 입력하세요.');
  }
  const ownsNow = !!p.ownsNow;
  const under30Single = !marriage && cmp(notice, age30) < 0;
  const homeless = !ownsNow && !under30Single && cmp(start, notice) <= 0;
  const homelessMonths = homeless ? fullMonths(start, notice) : 0;
  const homelessYears = Math.floor(homelessMonths / 12);
  const hPts = homelessPoints(homelessYears, homeless);
  if (ownsNow) warnings.push('공고일 현재 주택(분양권 포함)을 가진 세대에 속하면 무주택기간은 0점이고, 1순위 가점제 대상에서 빠져 추첨제로만 경쟁합니다 (주택공급에 관한 규칙 제28조⑥, 별표 1 비고 1). 소형·저가주택 1호 등 제53조 예외 주택만 있다면 체크를 해제하세요.');

  // ② 부양가족
  const spouse = married ? 1 : 0;
  const ascRaw = int(p.ascendants);
  const asc = p.householdHead ? ascRaw : 0;
  if (ascRaw && !p.householdHead) warnings.push('직계존속은 신청자가 세대주인 경우에만 부양가족으로 인정됩니다 (별표 1 제1호나목2). 배우자 분리세대라면 배우자가 세대주여야 합니다.');
  const kids = int(p.children);
  const adultKids = int(p.adultChildren);
  const depCount = spouse + asc + kids + adultKids;
  const dPts = dependentPoints(depCount);
  if (adultKids) warnings.push('30세 이상 미혼 자녀는 현재 1년 이상 같은 등본이면 인정되지만, 2026년 4월 입법예고된 개정안은 3년 이상으로 강화하는 내용입니다. 공포·시행 여부와 공고문의 기준을 확인하세요.');

  // ③ 청약통장 가입기간
  let account = null;
  if (p.accountDate) {
    const aStart = parseDate(p.accountDate);
    if (cmp(aStart, notice) > 0) throw new Error('청약통장 가입일이 공고일보다 늦습니다.');
    const minor = minorAdjustment(aStart, birth, notice);
    const effStart = addDays(aStart, minor.excessDays);
    const months = fullMonths(effStart, notice);
    const lawPoints = accountPoints(months);
    const ahMonths = applyhomeAccountMonths(fmtDate(birth), fmtDate(aStart), fmtDate(notice));
    const ahPoints = accountPoints(ahMonths);
    account = { start: fmtDate(aStart), effStart: fmtDate(effStart), months, minor, lawPoints, applyhomeMonths: ahMonths,
      applyhomePoints: ahPoints, points: Math.min(lawPoints, ahPoints) };
    if (ahPoints !== lawPoints) {
      warnings.push(`청약통장 가입기간 점수가 계산 방식에 따라 다릅니다: 조문대로 일 단위로 세면 ${lawPoints}점, 청약홈 가점계산기 방식(미성년·성년 구간을 각각 개월로 내림)은 ${ahPoints}점입니다. 가점을 실제보다 높게 적어 당첨되면 부적격으로 당첨이 취소될 수 있어, 낮은 ${Math.min(lawPoints, ahPoints)}점으로 계산했습니다. 청약 전 청약홈에서 꼭 다시 확인하세요.`);
    }
  }
  let spouseAcct = null;
  if (married && p.spouseAccountDate) {
    const sStart = parseDate(p.spouseAccountDate);
    if (cmp(sStart, notice) > 0) throw new Error('배우자 청약통장 가입일이 공고일보다 늦습니다.');
    const months = fullMonths(sStart, notice);
    spouseAcct = { start: fmtDate(sStart), months, halfMonths: months * v('spouseAccount').ratio, points: spouseAccountPoints(months) };
  }
  const ownAcctPts = account ? account.points : 0;
  const spousePts = spouseAcct ? spouseAcct.points : 0;
  const aPts = Math.min(v('accountPoints').cap, ownAcctPts + spousePts);
  if (!account) warnings.push('청약통장 가입일을 넣지 않아 통장 가입기간 점수를 0점으로 계산했습니다. 민영주택 1순위 가점제에 청약하려면 주택청약종합저축(또는 청약예금·부금)이 있어야 합니다.');

  return {
    notice: fmtDate(notice), birth: fmtDate(birth), age30: fmtDate(age30), married,
    marriage: marriage ? fmtDate(marriage) : '', disposal: disposal ? fmtDate(disposal) : '',
    homeless: { ok: homeless, ownsNow, under30Single, start: fmtDate(start), startReason, months: homelessMonths, years: homelessYears, points: hPts },
    dependents: { spouse, ascendants: asc, ascendantsInput: ascRaw, children: kids, adultChildren: adultKids, count: depCount, points: dPts },
    account: { own: account, spouse: spouseAcct, ownPoints: ownAcctPts, spousePoints: spousePts, points: aPts, capped: ownAcctPts + spousePts > aPts },
    total: hPts + dPts + aPts,
    max: v('homelessPoints').cap + v('dependentPoints').cap + v('accountPoints').cap,
    warnings,
  };
}
