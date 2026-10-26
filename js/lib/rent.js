// 전월세 전환 — 주택임대차보호법 제7조의2, 시행령 제9조
// 보증금 → 월세: 월세 = 전환 보증금 × 전환율 ÷ 12. 전환율 상한 = min(연 10%, 한국은행 기준금리 + 연 2%p).
// 월세 → 보증금: 보증금 = 줄인 월세 × 12 ÷ 전환율 (법정 상한은 '보증금을 월세로 바꾸는 경우'에만 정해져 있다).
// 끝수: 원 미만 버림(이 계산기의 처리, 법령에 끝수 규정 없음). 전환율은 %(예: 5) 단위로 받는다.
import { RATES } from '../rates/2026.js';

const R = RATES.rent;
const pctOf = (k) => R[k].value * 100;
const floor1 = (x) => Math.floor(x + 1e-6);
const round4 = (x) => Math.round(x * 1e4) / 1e4;

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** 법정 전환율 상한(%) — 기준금리(%) 입력 */
export function legalCapRate(baseRatePct = pctOf('bokBaseRate')) {
  const b = toNum(baseRatePct, NaN);
  if (!(b >= 0) || b > 30) throw new Error('기준금리는 0~30% 사이로 입력하세요.');
  const byBase = round4(b + pctOf('capSpread'));
  const fixed = round4(pctOf('capFixed'));
  return { baseRate: b, byBase, fixed, cap: Math.min(byBase, fixed), binding: byBase <= fixed ? 'base' : 'fixed' };
}

/**
 * @param {object} p
 * @param {'toMonthly'|'toDeposit'|'rate'} p.mode
 *   toMonthly: 보증금 일부(전부)를 월세로 — depositBefore, depositAfter, rentBefore
 *   toDeposit: 월세 일부를 보증금으로 — depositBefore, rentBefore, rentAfter
 *   rate: 두 조건(보증금·월세)의 전환율 역산 — depositBefore, rentBefore, depositAfter, rentAfter
 * @param {number} [p.conversionRate] 전환율(%) — 비우면 법정 상한으로 계산
 * @param {number} [p.baseRate] 한국은행 기준금리(%) — 비우면 RATES.rent.bokBaseRate
 */
export function calcRentConversion(p) {
  const mode = p.mode || 'toMonthly';
  const cap = legalCapRate(p.baseRate === '' || p.baseRate == null ? undefined : p.baseRate);
  const depositBefore = Math.round(toNum(p.depositBefore));
  const depositAfter = Math.round(toNum(p.depositAfter));
  const rentBefore = Math.round(toNum(p.rentBefore));
  const rentAfter = Math.round(toNum(p.rentAfter));
  const userRate = toNum(p.conversionRate, NaN);
  const rateGiven = Number.isFinite(userRate) && userRate > 0;
  if ([depositBefore, depositAfter, rentBefore, rentAfter].some((x) => !(x >= 0))) throw new Error('금액은 0 이상으로 입력하세요.');
  if (p.conversionRate !== '' && p.conversionRate != null && !(userRate > 0 && userRate <= 100)) throw new Error('전환율은 0보다 크고 100% 이하로 입력하세요.');
  const rate = rateGiven ? userRate : cap.cap;
  const base = { mode, cap, rate, rateGiven, depositBefore, rentBefore };

  if (mode === 'toMonthly') {
    if (!(depositBefore > 0)) throw new Error('현재 보증금을 입력하세요.');
    if (depositAfter >= depositBefore) throw new Error('바꾼 뒤 보증금은 현재 보증금보다 적어야 합니다.');
    const converted = depositBefore - depositAfter;
    const addRent = floor1((converted * rate) / 100 / 12);
    const capRent = floor1((converted * cap.cap) / 100 / 12);
    return {
      ...base, depositAfter, converted, addRent, rentAfter: rentBefore + addRent,
      capRent, capRentAfter: rentBefore + capRent, overCap: rate > cap.cap + 1e-9,
    };
  }
  if (mode === 'toDeposit') {
    if (!(rentBefore > 0)) throw new Error('현재 월세를 입력하세요.');
    if (rentAfter >= rentBefore) throw new Error('바꾼 뒤 월세는 현재 월세보다 적어야 합니다.');
    const rentCut = rentBefore - rentAfter;
    const addDeposit = floor1((rentCut * 12 * 100) / rate);
    return { ...base, rentAfter, rentCut, addDeposit, depositAfter: depositBefore + addDeposit };
  }
  if (mode === 'rate') {
    const dDeposit = depositBefore - depositAfter;
    const dRent = rentAfter - rentBefore;
    if (!(dDeposit > 0) || !(dRent > 0)) throw new Error('보증금이 줄고 월세가 늘어난 두 조건을 넣으세요 (조건 A: 보증금 많고 월세 적은 쪽).');
    const implied = round4((dRent * 12 * 100) / dDeposit);
    const capRent = floor1((dDeposit * cap.cap) / 100 / 12);
    return {
      ...base, depositAfter, rentAfter, converted: dDeposit, addRent: dRent, impliedRate: implied,
      capRent, overCap: implied > cap.cap + 1e-9, overBy: Math.max(0, dRent - capRent),
    };
  }
  throw new Error(`계산 방식이 올바르지 않습니다: ${mode}`);
}
