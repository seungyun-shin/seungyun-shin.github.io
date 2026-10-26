// 프리랜서(인적용역 사업소득, 3.3% 원천징수) 종합소득세 환급·추가납부 추정 — 장부 없이 추계신고하는 경우
//   소득금액(단순경비율) = 수입금액 − [min(수입, 4천만) × 기본율 + 4천만 초과분 × 초과율]   (국세청고시 제2026-14호 제3조·제4조)
//   소득금액(기준경비율) = min(수입 − 주요경비 − 수입 × 기준경비율, 단순경비율 소득금액 × 배율 2.8/3.4)   (시행령 제143조③, 시행규칙 제67조)
//   과세표준 = 소득금액 − 기본공제(1명 150만원) − 연금보험료  → 제55조 기본세율 → 표준세액공제 7만원 → (무기장가산세)
//   기납부세액 = 수입 × 3%,  지방소득세는 결정세액의 10%로 추정 (RATES.freelancer.localTax [미확인])
//   끝수: 소득금액·산출세액 원 미만 버림, 납부·환급액 10원 미만 절사(국고금관리법 제47조, 지방세기본법 제59조)
// 다른 소득(근로·연금·이자 등)이 없고, 이 업종 수입만 있다고 가정한다.
import { RATES } from '../rates/2026.js';
import { basicTax } from './income-tax.js';

const F = RATES.freelancer;
const v = (k) => F[k].value;
export const INDUSTRIES = v('expenseRates2025');
export const findIndustry = (code) => INDUSTRIES.find((x) => x.code === String(code));

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor1 = (x) => Math.floor(x + 1e-6);
const floor10 = (x) => Math.floor(x / 10 + 1e-9) * 10;
/** 부호를 유지한 채 절댓값을 10원 미만 절사 (환급도 국고금 지출) */
const trunc10 = (x) => (x < 0 ? -floor10(-x) : floor10(x));
const bool = (x) => x === true || x === 'true' || x === '1';

/** 단순경비율 필요경비 (인적용역: 4천만원까지 기본율, 초과분 초과율) */
export function simpleExpense(revenue, rate) {
  const t = v('simpleExcessThreshold');
  return Math.min(revenue, t) * rate.simpleBase + Math.max(0, revenue - t) * rate.simpleExcess;
}

/**
 * @param {object} p
 * @param {string} p.industry 업종코드 (INDUSTRIES 중 하나)
 * @param {number} p.revenue 올해 수입금액 (3.3% 떼기 전 지급액 합계)
 * @param {number} [p.prevRevenue] 직전 연도 수입금액
 * @param {boolean} [p.isNew] 올해 처음 사업소득이 생김 (신규 사업자)
 * @param {number} [p.majorExpenses] 기준경비율 적용 시 증빙 있는 주요경비(매입비용·사업용 자산 임차료·인건비)
 * @param {number} [p.persons] 기본공제 인원 (본인 포함, 1 이상)
 * @param {number} [p.pension] 연금보험료공제 (국민연금 지역가입자 본인 납부액 등)
 * @param {number} [p.withheld] 원천징수된 소득세 (비우면 수입 × 3%)
 * @param {object} [p.rates] 경비율 직접 지정 {simpleBase, simpleExcess, standard} — 다른 연도 고시값 검증용
 */
export function calcFreelancerTax(p) {
  const revenue = Math.round(toNum(p.revenue));
  const prevRevenue = Math.round(toNum(p.prevRevenue, 0));
  const isNew = bool(p.isNew);
  const majorExpenses = Math.round(toNum(p.majorExpenses, 0));
  const persons = toNum(p.persons, 1);
  const pension = Math.round(toNum(p.pension, 0));
  const withheldInput = p.withheld === '' || p.withheld == null ? null : Math.round(toNum(p.withheld));
  const industry = p.rates ? { code: 'custom', name: '직접 지정', ...p.rates } : findIndustry(p.industry);
  if (!industry) throw new Error('업종을 고르세요.');
  if (!(revenue > 0)) throw new Error('올해 수입금액(3.3% 떼기 전 금액)을 입력하세요.');
  if (!(prevRevenue >= 0)) throw new Error('직전 연도 수입금액은 0 이상으로 입력하세요.');
  if (!(majorExpenses >= 0)) throw new Error('주요경비는 0 이상으로 입력하세요.');
  if (!Number.isInteger(persons) || persons < 1 || persons > 20) throw new Error('기본공제 인원은 본인 포함 1~20명으로 입력하세요.');
  if (!(pension >= 0)) throw new Error('연금보험료는 0 이상으로 입력하세요.');
  if (withheldInput !== null && !(withheldInput >= 0)) throw new Error('원천징수세액은 0 이상으로 입력하세요.');

  const el = v('simpleEligibility');
  const simpleEligible = (isNew || prevRevenue < el.prevRevenue) && revenue < el.currentRevenue;
  const simpleBook = isNew || prevRevenue < v('bookkeeping').simpleBookUnder; // 간편장부대상자
  const mult = simpleBook ? v('multiplier').simpleBook : v('multiplier').doubleEntry;

  const simpleExp = simpleExpense(revenue, industry);
  const simpleIncome = floor1(revenue - simpleExp);
  const stdRate = simpleBook ? industry.standard : industry.standard / 2;
  const stdDeduct = Math.min(revenue, majorExpenses + revenue * stdRate);
  const standardRaw = floor1(revenue - stdDeduct);
  const capByMultiplier = floor1(simpleIncome * mult);
  const standardIncome = Math.min(standardRaw, capByMultiplier);
  const method = simpleEligible ? 'simple' : 'standard';
  const income = method === 'simple' ? simpleIncome : standardIncome;

  const personal = persons * v('personalDeduction');
  const deductions = Math.min(income, personal + pension);
  const taxBase = Math.max(0, income - deductions);
  const computed = floor1(basicTax(taxBase));
  const credit = Math.min(computed, v('standardCredit').general);
  const pen = v('noBookPenalty');
  const smallBiz = isNew || prevRevenue < pen.smallPrevRevenue;
  const penalty = smallBiz ? 0 : floor1(computed * pen.rate);
  const decided = computed - credit + penalty;

  const withheld = withheldInput !== null ? withheldInput : floor10(revenue * v('withholding'));
  const diff = trunc10(decided - withheld);
  const localDecided = floor1(decided * RATES.incomeTax.localTaxRate.value);
  const localWithheld = floor10(withheld * RATES.incomeTax.localTaxRate.value);
  const localDiff = trunc10(localDecided - localWithheld);
  const totalDiff = diff + localDiff;

  return {
    industry, revenue, prevRevenue, isNew, majorExpenses, persons, pension,
    simpleEligible, simpleBook, bookType: simpleBook ? '간편장부대상자' : '복식부기의무자', multiplier: mult,
    method, methodName: method === 'simple' ? '단순경비율' : '기준경비율',
    simpleExpense: floor1(simpleExp), simpleIncome,
    stdRateApplied: stdRate, standardRaw, capByMultiplier, standardIncome, standardCapped: capByMultiplier < standardRaw,
    income, personal, deductions, taxBase, computed, credit,
    smallBiz, penalty, decided,
    withheld, withheldGiven: withheldInput !== null,
    diff, // 음수 = 환급
    localDecided, localWithheld, localDiff,
    totalDiff,
    refund: totalDiff < 0 ? -totalDiff : 0,
    payable: totalDiff > 0 ? totalDiff : 0,
    effectiveRate: decided / revenue,
  };
}
