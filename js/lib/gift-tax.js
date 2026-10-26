// 증여세 계산 (거주자, 금전·시가 확정 재산의 단순 증여) — 상속세 및 증여세법
import { RATES } from '../rates/2026.js';

export const RELATIONS = {
  spouse: '배우자',
  ascendantToAdult: '부모·조부모 → 성년 자녀·손자녀',
  ascendantToMinor: '부모·조부모 → 미성년 자녀·손자녀',
  descendantToAscendant: '자녀·손자녀 → 부모·조부모',
  otherRelative: '기타 친족 (4촌 이내 혈족, 3촌 이내 인척)',
  other: '친족이 아닌 사람',
};

/** 과세표준 → 산출세액 (제26조 세율 준용) */
export function giftTaxOnBase(base) {
  if (base <= 0) return { tax: 0, rate: 0, deduct: 0 };
  for (const b of RATES.giftTax.brackets.value) {
    if (base <= b.upTo) return { tax: Math.floor(base * b.rate - b.deduct), rate: b.rate, deduct: b.deduct };
  }
  return { tax: 0, rate: 0, deduct: 0 };
}

/**
 * @param {object} p
 * @param {keyof RELATIONS} p.relation
 * @param {number} p.amount 이번 증여재산가액
 * @param {number} [p.priorAmount] 10년 이내 같은 증여자(직계존속이면 그 배우자 포함)로부터 받은 증여재산가액 (합산)
 * @param {number} [p.priorTax] 위 합산 증여분에 대해 이미 낸(산출) 증여세 — 기납부세액공제
 * @param {number} [p.deductionUsedElsewhere] 같은 공제 그룹의 다른 증여자에게서 10년 이내 이미 쓴 공제액
 * @param {boolean} [p.marriageBirth] 혼인·출산 증여재산공제 적용
 * @param {number} [p.marriageBirthUsed] 혼인·출산 공제 이미 사용한 금액
 * @param {boolean} [p.generationSkip] 세대생략(조부모→손자녀, 중간 세대 생존)
 * @param {boolean} [p.fileOnTime=true] 기한 내 신고(신고세액공제 3%)
 */
export function calcGiftTax(p) {
  const relation = p.relation in RELATIONS ? p.relation : 'ascendantToAdult';
  const amount = Math.max(0, Number(p.amount) || 0);
  if (!amount) throw new Error('증여재산가액을 입력하세요.');
  const prior = Math.max(0, Number(p.priorAmount) || 0);
  const priorTax = Math.max(0, Number(p.priorTax) || 0);
  const total = amount + prior;

  const limit = RATES.giftTax.deductions.value[relation];
  const usedElsewhere = Math.max(0, Number(p.deductionUsedElsewhere) || 0);
  const basicDeduction = Math.min(total, Math.max(0, limit - usedElsewhere));

  const isAscendant = relation === 'ascendantToAdult' || relation === 'ascendantToMinor';
  let mbDeduction = 0;
  if (p.marriageBirth && isAscendant) {
    const remain = Math.max(0, RATES.giftTax.marriageBirth.value - (Number(p.marriageBirthUsed) || 0));
    mbDeduction = Math.min(remain, Math.max(0, total - basicDeduction));
  }
  const base = Math.max(0, total - basicDeduction - mbDeduction);
  const belowMin = base < RATES.giftTax.minTaxBase.value;
  const calc = belowMin ? { tax: 0, rate: 0, deduct: 0 } : giftTaxOnBase(base);

  let surchargeRate = 0;
  if (p.generationSkip && isAscendant) {
    const gs = RATES.giftTax.generationSkip.value;
    surchargeRate = relation === 'ascendantToMinor' && total > 2e9 ? gs.minorOver2b : gs.base;
  }
  const surcharge = Math.floor(calc.tax * surchargeRate);
  const priorCredit = Math.min(priorTax, calc.tax + surcharge);
  const afterCredit = calc.tax + surcharge - priorCredit;
  const filingCredit = p.fileOnTime === false ? 0 : Math.floor(afterCredit * RATES.giftTax.filingCredit.value);
  const payable = Math.max(0, afterCredit - filingCredit);
  return {
    relation, relationName: RELATIONS[relation], amount, prior, total,
    limit, usedElsewhere, basicDeduction, mbDeduction, isAscendant,
    base, belowMin, rate: calc.rate, progressiveDeduct: calc.deduct, computedTax: calc.tax,
    surchargeRate, surcharge, priorCredit, filingCredit, payable,
    effectiveRate: amount ? payable / amount : 0,
  };
}
