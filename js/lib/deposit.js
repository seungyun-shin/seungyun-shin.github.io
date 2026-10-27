// 예금·적금 이자 — 단리·월복리, 세후 실수령액
// 이자 산식은 월 단위(연이율 ÷ 12) 계산이다. 은행이 실제 일수로 이자를 계산하면 몇 원~몇십 원 다를 수 있다.
// 세금: 일반과세 소득세 14% + 지방소득세(소득세의 10%), 세금우대 소득세 9% + 농어촌특별세(감면세액의 10%), 비과세 0.
// 끝수: 세전 이자는 원 미만 버림, 각 세목은 10원 미만 절사(국고금관리법 제47조). 모든 기준은 RATES.deposit.
import { RATES } from '../rates/2026.js';

const D = RATES.deposit;
const v = (k) => D[k].value;
const floor10 = (x) => Math.floor(x / 10 + 1e-9) * 10;
const floor1 = (x) => Math.floor(x + 1e-6);

export const TAX_TYPES = {
  general: '일반과세',
  preferential: '세금우대',
  exempt: '비과세',
  custom: '세율 직접 입력',
};

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

/** 세전 이자(원 미만 포함) */
export function grossInterest({ kind, amount, annualRate, months, compounding }) {
  const r = annualRate / 100;
  const i = r / 12;
  const n = months;
  if (kind === 'deposit') {
    return compounding === 'monthly' ? amount * ((1 + i) ** n - 1) : amount * r * (n / 12);
  }
  // 적금: 매월 초 같은 금액 납입, k번째 납입금은 (n - k + 1)개월 동안 이자가 붙음
  if (compounding === 'monthly') {
    if (i === 0) return 0;
    return amount * (((1 + i) * ((1 + i) ** n - 1)) / i - n);
  }
  return amount * i * ((n * (n + 1)) / 2);
}

/** 세금 계산 (이자 원 단위 정수) */
export function interestTax(interest, taxType, customRate = 0) {
  const t = { income: 0, local: 0, farm: 0, custom: 0 };
  if (taxType === 'general') {
    t.income = floor10(interest * v('interestIncomeTax'));
    t.local = floor10(t.income * v('localIncomeTax'));
  } else if (taxType === 'preferential') {
    t.income = floor10(interest * v('preferentialTax'));
    // 농어촌특별세법 제5조④: 감면세액 = 이자 × 14% − 조특법에 따라 납부하는 소득세액(10원 미만 절사 후)
    const reduced = interest * v('interestIncomeTax') - t.income;
    t.farm = floor10(reduced * v('farmSpecialTax'));
  } else if (taxType === 'custom') {
    t.custom = floor10(interest * (customRate / 100));
  } else if (taxType !== 'exempt') {
    throw new Error(`과세 구분이 올바르지 않습니다: ${taxType}`);
  }
  t.total = t.income + t.local + t.farm + t.custom;
  return t;
}

/**
 * @param {object} p
 * @param {'deposit'|'savings'} p.kind 예금(목돈 한 번) / 적금(매월 납입)
 * @param {number} p.amount 예금 원금 또는 적금 월 납입액(원)
 * @param {number} p.annualRate 연 이율(%)
 * @param {number} p.months 기간(개월)
 * @param {'simple'|'monthly'} p.compounding 단리 / 월복리
 * @param {'general'|'preferential'|'exempt'|'custom'} p.taxType
 * @param {number} [p.customTaxRate] 직접 입력 세율(%)
 */
export function calcDeposit(p) {
  const kind = p.kind || 'deposit';
  const compounding = p.compounding || 'simple';
  const taxType = p.taxType || 'general';
  const amount = Math.round(toNum(p.amount));
  const annualRate = toNum(p.annualRate);
  const months = toNum(p.months);
  const customTaxRate = toNum(p.customTaxRate, 0);
  if (!['deposit', 'savings'].includes(kind)) throw new Error('예금·적금 구분이 올바르지 않습니다.');
  if (!['simple', 'monthly'].includes(compounding)) throw new Error('이자 계산 방식이 올바르지 않습니다.');
  if (!TAX_TYPES[taxType]) throw new Error('과세 구분이 올바르지 않습니다.');
  if (!(amount > 0)) throw new Error(kind === 'deposit' ? '예금 원금을 입력하세요.' : '월 납입액을 입력하세요.');
  if (!(annualRate >= 0) || annualRate > 100) throw new Error('연 이율은 0~100% 사이로 입력하세요.');
  if (!Number.isInteger(months) || months < 1 || months > 600) throw new Error('기간은 1~600개월 사이의 정수로 입력하세요.');
  if (taxType === 'custom' && !(customTaxRate >= 0 && customTaxRate <= 100)) throw new Error('세율은 0~100% 사이로 입력하세요.');

  const totalPrincipal = kind === 'deposit' ? amount : amount * months;
  const interest = floor1(grossInterest({ kind, amount, annualRate, months, compounding }));
  const tax = interestTax(interest, taxType, customTaxRate);
  const netInterest = interest - tax.total;
  return {
    kind, compounding, taxType, taxName: TAX_TYPES[taxType], amount, annualRate, months, customTaxRate,
    totalPrincipal,
    interest,
    tax,
    taxTotal: tax.total,
    netInterest,
    maturityGross: totalPrincipal + interest,
    maturityNet: totalPrincipal + netInterest,
    // 세후 이자를 '원금 전액을 기간 내내 맡긴 것'으로 보고 연이율로 환산 (적금은 평균 잔액이 원금 총액보다 작아 낮게 나온다)
    netYieldOnPrincipal: netInterest / totalPrincipal / (months / 12),
    overInsurance: totalPrincipal + interest > v('depositInsurance'),
  };
}
