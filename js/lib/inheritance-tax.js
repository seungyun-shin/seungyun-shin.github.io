// 상속세 계산 (거주자 피상속인, 2026년 상속개시분) — 상속세 및 증여세법 제13조·제18조~제28조·제69조
// 계산 순서는 국세청 상속세 과세표준 신고서·「주요서식 작성요령/사례」를 따른다.
//   상속재산(본래+간주+추정) − 공과금·채무·장례비 + 사전증여재산 = 과세가액
//   과세가액 − 상속공제(종합한도 적용) = 과세표준 → 세율(제26조) → 산출세액 − 증여세액공제 − 신고세액공제
// 모든 기준값은 src/rates/2026.js 의 RATES.inheritance (세율은 RATES.giftTax.brackets = 제26조 표) 에서 읽는다.
import { RATES } from '../rates/2026.js';
import { giftTaxOnBase } from './gift-tax.js';

const I = RATES.inheritance;
const v = (k) => I[k].value;
const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));
const fl = (x) => Math.floor(x + 1e-6);

export const LAW = {
  priorGift: '상속세 및 증여세법 제13조',
  debts: '상속세 및 증여세법 제14조',
  basic: '상속세 및 증여세법 제18조',
  spouse: '상속세 및 증여세법 제19조',
  personal: '상속세 및 증여세법 제20조',
  lumpSum: '상속세 및 증여세법 제21조',
  financial: '상속세 및 증여세법 제22조',
  house: '상속세 및 증여세법 제23조의2',
  limit: '상속세 및 증여세법 제24조',
  minBase: '상속세 및 증여세법 제25조',
  rates: '상속세 및 증여세법 제26조',
  giftCredit: '상속세 및 증여세법 제28조',
  filing: '상속세 및 증여세법 제69조',
  funeral: '상속세 및 증여세법 시행령 제9조',
};

/** "7, 15" 같은 목록을 숫자 배열로 */
export function parseList(s) {
  if (Array.isArray(s)) return s.map(Number).filter((x) => Number.isFinite(x) && x >= 0);
  return String(s ?? '').split(/[,\s/]+/).filter(Boolean).map(Number).filter((x) => Number.isFinite(x) && x >= 0);
}

/** 장례비용 공제 (시행령 제9조②): 500만원 미만 → 500만원, 1천만원 한도 + 봉안·자연장지 500만원 한도 */
export function funeralDeduction(funeral, enshrine = 0) {
  const f = v('funeral');
  return Math.min(f.max, Math.max(f.min, n0(funeral))) + Math.min(f.enshrineMax, n0(enshrine));
}

/** 금융재산 상속공제 (제22조) */
export function financialDeduction(netFinancial) {
  const f = v('financial');
  const n = n0(netFinancial);
  if (n <= f.fullUpTo) return n;
  return Math.min(f.cap, Math.max(f.minAmount, fl(n * f.rate)));
}

/** 인적공제 (제20조): 미성년자 나이 목록, 장애인 기대여명 목록 */
export function personalDeduction({ children = 0, minorAges = [], elderly = 0, disabledYears = [] }) {
  const p = v('personal');
  const child = n0(children) * p.child;
  const minor = parseList(minorAges).reduce((s, a) => s + p.minorPerYear * Math.max(1, Math.ceil(p.minorUntilAge - a)), 0);
  const old = n0(elderly) * p.elderly65;
  const dis = parseList(disabledYears).reduce((s, y) => s + p.disabledPerYear * Math.max(1, Math.ceil(y)), 0);
  return { child, minor, elderly: old, disabled: dis, total: child + minor + old + dis };
}

/** 배우자 법정상속분 (민법 제1009조②): 배우자 1.5, 공동상속인(직계비속 또는 직계존속) 각 1 */
export function spouseLegalShare(coHeirs) {
  const s = v('spouse');
  const n = n0(coHeirs);
  return s.shareSpouse / (s.shareSpouse + n * s.shareOther);
}

/**
 * @param {object} p
 * @param {number} p.assets 상속재산가액 (본래 상속재산 + 보험금·퇴직금 등 간주상속재산, 시가)
 * @param {number} [p.presumed] 추정상속재산 (제15조)
 * @param {number} [p.publicCharges] 공과금
 * @param {number} [p.debts] 채무
 * @param {number} [p.funeral] 장례비용 (봉안 제외)
 * @param {number} [p.enshrine] 봉안시설·자연장지 비용
 * @param {number} [p.giftsToHeirs] 10년 내 상속인에게 증여한 재산가액
 * @param {number} [p.giftsToOthers] 5년 내 상속인 아닌 자에게 증여한 재산가액
 * @param {number} [p.giftDeductionsUsed] 위 사전증여 때 받은 증여재산공제(혼인·출산 포함) 합계
 * @param {number} [p.giftTaxPaid] 위 사전증여분 증여세 산출세액 합계 (증여세액공제)
 * @param {number} [p.bequestToOthers] 상속인 아닌 자에게 유증한 재산 (종합한도·배우자 한도 차감)
 * @param {boolean} [p.spouse] 배우자 생존
 * @param {number} [p.spouseActual] 배우자가 실제 상속받는 금액 (승계 채무 차감, 분할기한 내 분할)
 * @param {number} [p.spousePriorGiftBase] 배우자 사전증여재산의 증여세 과세표준
 * @param {number} [p.children] 자녀 수
 * @param {number} [p.ascendantHeirs] 자녀가 없을 때 공동상속인인 직계존속 수
 * @param {string|number[]} [p.minorAges] 미성년자(상속인·동거가족, 배우자 제외) 나이
 * @param {number} [p.elderly] 65세 이상(상속인·동거가족, 배우자 제외) 인원
 * @param {string|number[]} [p.disabledYears] 장애인(배우자 포함) 기대여명 연수
 * @param {number} [p.financialAssets] 금융재산
 * @param {number} [p.financialDebts] 금융회사 채무
 * @param {boolean} [p.cohabitHouse] 동거주택 상속공제 요건 충족
 * @param {number} [p.houseValue] 동거주택 가액 (부수토지 포함, 담보채무 차감)
 * @param {boolean} [p.fileOnTime=true] 기한 내 신고 (신고세액공제, 일괄공제)
 */
export function calcInheritanceTax(p) {
  const assets = n0(p.assets);
  if (!assets) throw new Error('상속재산가액을 입력하세요.');
  const presumed = n0(p.presumed);
  const publicCharges = n0(p.publicCharges);
  const debts = n0(p.debts);
  const funeral = funeralDeduction(p.funeral, p.enshrine);
  const giftsToHeirs = n0(p.giftsToHeirs);
  const giftsToOthers = n0(p.giftsToOthers);
  const gifts = giftsToHeirs + giftsToOthers;
  const fileOnTime = p.fileOnTime !== false;
  const warnings = [];

  // 과세가액 (제13조): 상속재산 − 공과금·채무·장례비, 음수면 0으로 보고 사전증여재산 가산
  const estate = assets + presumed;
  const net = Math.max(0, estate - publicCharges - debts - funeral);
  if (estate - publicCharges - debts - funeral < 0) warnings.push('채무 등이 상속재산보다 많아 초과분은 0으로 보고 사전증여재산만 과세가액에 더했습니다.');
  const taxable = net + gifts;

  // 기초·인적·일괄 (제18조·제20조·제21조)
  const spouse = !!p.spouse;
  const children = n0(p.children);
  const ascendantHeirs = children ? 0 : n0(p.ascendantHeirs);
  const coHeirs = children || ascendantHeirs;
  const spouseSole = spouse && coHeirs === 0;
  const pers = personalDeduction({ children, minorAges: p.minorAges, elderly: p.elderly, disabledYears: p.disabledYears });
  const basic = v('basic');
  const basicPlus = basic + pers.total;
  let lumpChoice; let basicDed;
  if (spouseSole) { lumpChoice = 'itemized-sole'; basicDed = basicPlus; } else if (!fileOnTime) { lumpChoice = 'lump-nofile'; basicDed = v('lumpSum'); } else if (basicPlus > v('lumpSum')) { lumpChoice = 'itemized'; basicDed = basicPlus; } else { lumpChoice = 'lump'; basicDed = v('lumpSum'); }

  // 배우자 상속공제 (제19조)
  let spouseDed = 0; let spouseInfo = null;
  if (spouse) {
    const S = v('spouse');
    const share = spouseLegalShare(coHeirs);
    const baseForLimit = Math.max(0, estate - publicCharges - debts) - n0(p.bequestToOthers) + giftsToHeirs;
    const legalLimit = Math.max(0, fl(baseForLimit * share) - n0(p.spousePriorGiftBase));
    const limit = Math.min(legalLimit, S.max);
    const actual = n0(p.spouseActual);
    spouseDed = actual < S.min ? S.min : Math.max(S.min, Math.min(actual, limit));
    spouseInfo = { share, baseForLimit, legalLimit, limit, actual, min: S.min, max: S.max };
    if (actual > limit && limit > S.min) warnings.push(`배우자가 실제 받는 금액이 공제 한도(${limit.toLocaleString('ko-KR')}원)를 넘어 초과분은 공제되지 않습니다.`);
  }

  // 금융재산 (제22조), 동거주택 (제23조의2)
  const netFinancial = Math.max(0, n0(p.financialAssets) - n0(p.financialDebts));
  const finDed = financialDeduction(netFinancial);
  const houseDed = p.cohabitHouse ? Math.min(v('cohabitHouse').cap, n0(p.houseValue)) : 0;

  // 종합한도 (제24조)
  const giftNetOfDed = Math.max(0, gifts - n0(p.giftDeductionsUsed));
  const limitGift = taxable > 5e8 ? giftNetOfDed : 0;
  const aggLimit = Math.max(0, taxable - n0(p.bequestToOthers) - limitGift);
  const sumDed = basicDed + spouseDed + finDed + houseDed;
  const deduction = Math.min(sumDed, aggLimit);

  // 과세표준·세액
  let base = Math.max(0, taxable - deduction);
  const belowMin = base > 0 && base < v('minTaxBase');
  if (belowMin) base = 0;
  const calc = giftTaxOnBase(base);
  let giftCredit = 0;
  if (calc.tax > 0 && taxable > 5e8 && n0(p.giftTaxPaid)) {
    const giftBase = giftNetOfDed;
    const cap = fl(calc.tax * Math.min(1, giftBase / base));
    giftCredit = Math.min(n0(p.giftTaxPaid), cap);
  }
  const afterGift = Math.max(0, calc.tax - giftCredit);
  const filingCredit = fileOnTime ? fl(afterGift * v('filingCredit')) : 0;
  const payable = afterGift - filingCredit;

  return {
    assets, presumed, estate, publicCharges, debts, funeral, gifts, giftsToHeirs, giftsToOthers, net, taxable,
    spouse, spouseSole, children, ascendantHeirs, coHeirs,
    basic, personal: pers, basicPlus, lumpSum: v('lumpSum'), lumpChoice, basicDed,
    spouseDed, spouseInfo, netFinancial, finDed, houseDed,
    sumDed, aggLimit, limitGift, deduction, limited: sumDed > aggLimit,
    base, belowMin, rate: calc.rate, progressiveDeduct: calc.deduct, computedTax: calc.tax,
    giftCredit, filingCredit, payable, fileOnTime,
    effectiveRate: estate ? payable / estate : 0, warnings,
  };
}
