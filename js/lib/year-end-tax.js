// 연말정산 미리보기 (2026년 귀속, 2027년 1~2월 정산) — 단일 근무지 근로소득자
// 계산 순서는 국세청 「2025년 연말정산 신고안내」 종합사례와 근로소득 원천징수영수증 서식을 따른다.
//   총급여 − 근로소득공제 = 근로소득금액
//   − 인적공제 − 연금보험료공제 − 특별소득공제 − 그 밖의 소득공제(주택청약·신용카드) + 종합한도 초과액 = 과세표준
//   과세표준 × 기본세율 = 산출세액 − 세액공제 = 결정세액
//   결정세액 − 기납부세액 = 차감징수세액(+ 추가납부, − 환급)
// 모든 기준값은 src/rates/2026.js 의 RATES.yearEnd 에서 읽는다.

import { RATES } from '../rates/2026.js';
import { earnedIncomeDeduction, basicTax, withholdingTax } from './income-tax.js';
import { socialInsurance } from './insurance.js';

const Y = RATES.yearEnd;
const v = (k) => Y[k].value;

const n0 = (x) => Math.max(0, Math.floor(Number(x) || 0));
const int = (x) => Math.max(0, Math.floor(Number(x) || 0));
const fl = (x) => Math.floor(x + 1e-6); // 원 미만 절사 (부동소수 오차 보정)
const floor10 = (x) => Math.floor((x + 1e-6) / 10) * 10;

export const LAW = {
  eid: '소득세법 제47조',
  personal: '소득세법 제50조·제51조',
  pension: '소득세법 제51조의3',
  insurance: '소득세법 제52조①',
  rentLoan: '소득세법 제52조④',
  mortgage: '소득세법 제52조⑤⑥',
  subscription: '조세특례제한법 제87조②',
  card: '조세특례제한법 제126조의2',
  aggregate: '조세특례제한법 제132조의2',
  rates: '소득세법 제55조',
  earnedCredit: '소득세법 제59조',
  child: '소득세법 제59조의2, 법률 제21548호 부칙 제2조',
  pensionAcct: '소득세법 제59조의3',
  insCredit: '소득세법 제59조의4①',
  medical: '소득세법 제59조의4②',
  education: '소득세법 제59조의4③',
  donation: '소득세법 제59조의4④',
  standard: '소득세법 제59조의4⑨',
  hometown: '조세특례제한법 제58조',
  political: '조세특례제한법 제76조',
  rent: '조세특례제한법 제95조의2',
  marriage: '조세특례제한법 제92조',
  cap: '소득세법 제61조',
  local: '지방세법 제103조의13',
  small: '소득세법 제86조',
};

/** 근로소득세액공제 한도 (소득세법 제59조②) */
export function earnedIncomeCreditLimit(g) {
  if (g <= 33e6) return 740000;
  if (g <= 70e6) return Math.max(660000, 740000 - (g - 33e6) * 0.008);
  if (g <= 120e6) return Math.max(500000, 660000 - (g - 70e6) / 2);
  return Math.max(200000, 500000 - (g - 120e6) / 2);
}

/** 근로소득세액공제 (소득세법 제59조) */
export function earnedIncomeCredit(tax, g) {
  const p = v('earnedIncomeCredit');
  const raw = tax <= p.threshold ? tax * p.rate1 : p.base2 + (tax - p.threshold) * p.rate2;
  const limit = earnedIncomeCreditLimit(g);
  return { raw: fl(raw), limit: fl(limit), amount: fl(Math.min(raw, limit)) };
}

/** 자녀세액공제 (제59조의2①) — n: 2026년 대상 자녀 수 */
export function childCreditAmount(n) {
  const c = v('childCredit');
  const k = int(n);
  if (k === 0) return 0;
  if (k === 1) return c.one;
  return c.two + (k - 2) * c.extraPerChild;
}

/** 출산·입양 공제 (제59조의2③) — order: 올해 태어난 첫 아이의 출생 순위(1·2·3), count: 올해 출생·입양 수 */
export function birthCreditAmount(order, count) {
  const b = v('birthCredit');
  const o = int(order); const c = int(count);
  if (!o || !c) return 0;
  let sum = 0;
  for (let i = 0; i < c; i++) {
    const rank = o + i;
    sum += rank === 1 ? b.first : rank === 2 ? b.second : b.third;
  }
  return sum;
}

/**
 * 신용카드 등 사용금액 소득공제 (조특법 제126조의2)
 * @param {number} g 총급여
 * @param {object} c 사용액 (각 항목은 서로 겹치지 않게 입력)
 * @param {number} c.credit 신용카드 (전통시장·대중교통·문화체육 제외)
 * @param {number} c.debit 체크카드·현금영수증 (전통시장·대중교통·문화체육 제외)
 * @param {number} c.culture 도서·신문·공연·박물관·미술관·영화·체육시설
 * @param {number} c.market 전통시장
 * @param {number} c.transit 대중교통
 * @param {number} kids 자녀등 수 (조특령 제121조의2⑱)
 */
export function cardDeduction(g, c, kids = 0) {
  const r = v('cardRates'); const L = v('cardLimits');
  const under7 = g <= r.cultureSalaryCap;
  let credit = n0(c.credit); let debit = n0(c.debit); let culture = n0(c.culture);
  const market = n0(c.market); const transit = n0(c.transit);
  const cultureAsDebit = !under7 && culture > 0;
  if (!under7) { debit += culture; culture = 0; } // 7천만원 초과: 문화체육 사용분 별도 공제율 없음 → 체크·현금 결제로 가정
  const total = credit + debit + culture + market + transit;
  const minUse = g * r.minUseRatio;
  const base = { under7, total, minUse, cultureAsDebit, credit, debit, culture, market, transit };
  if (total <= minUse) return { ...base, gross: 0, minus: 0, possible: 0, baseLimit: 0, extraLimit: 0, extra: 0, amount: 0, case: 'below' };
  const parts = {
    credit: credit * r.credit, debit: debit * r.debit, culture: culture * r.culture,
    market: market * r.market, transit: transit * r.transit,
  };
  const gross = parts.credit + parts.debit + parts.culture + parts.market + parts.transit;
  let minus; let kase;
  const lowRate = under7 ? credit + debit + culture : credit + debit;
  if (minUse <= credit) { minus = minUse * r.credit; kase = 'A'; } else if (minUse <= lowRate) {
    minus = credit * r.credit + (minUse - credit) * r.debit; kase = 'B';
  } else {
    minus = credit * r.credit + (debit + culture) * r.debit + (minUse - lowRate) * r.market; kase = 'C';
  }
  const possible = Math.max(0, gross - minus);
  const k = int(kids);
  const baseLimit = under7 ? (k >= 2 ? L.under7Child2 : k === 1 ? L.under7Child1 : L.under7Base)
    : (k >= 2 ? L.over7Child2 : k === 1 ? L.over7Child1 : L.over7Base);
  const extraPool = under7 ? parts.market + parts.transit + parts.culture : parts.market + parts.transit;
  const extraLimit = Math.min(extraPool, under7 ? L.under7Extra : L.over7Extra);
  const extra = possible > baseLimit ? Math.min(possible - baseLimit, extraLimit) : 0;
  const amount = fl(Math.min(possible, baseLimit) + extra);
  return { ...base, parts, gross: fl(gross), minus: fl(minus), possible: fl(possible), baseLimit, extraLimit: fl(extraLimit), extra: fl(extra), amount, case: kase, kids: k };
}

/** 의료비 세액공제 (제59조의2②) — 3% 미달분을 일반 → 본인 등 → 미숙아 → 난임 순으로 차감 */
export function medicalCredit(g, m) {
  const p = v('medicalCredit');
  const A = n0(m.general); const B = n0(m.special); const C2 = n0(m.premature); const D = n0(m.infertility);
  const T = g * p.thresholdRatio;
  const a = Math.min(Math.max(A - T, 0), p.generalCap);
  let short = Math.max(T - A, 0);
  const b = Math.max(B - short, 0); short = Math.max(short - B, 0);
  const c = Math.max(C2 - short, 0); short = Math.max(short - C2, 0);
  const d = Math.max(D - short, 0);
  const amount = fl((a + b) * p.rate + c * p.prematureRate + d * p.infertilityRate);
  return { threshold: fl(T), general: fl(a), special: fl(b), premature: fl(c), infertility: fl(d), target: fl(a + b + c + d), amount, spent: A + B + C2 + D };
}

/** 교육비 세액공제 (제59조의4③) */
export function educationCredit(e) {
  const p = v('educationCredit');
  const school = (e.school || []).map(n0);
  const univ = (e.univ || []).map(n0);
  const schoolT = school.reduce((s, x) => s + Math.min(x, p.schoolCap), 0);
  const univT = univ.reduce((s, x) => s + Math.min(x, p.univCap), 0);
  const target = n0(e.self) + schoolT + univT + n0(e.disabled);
  return { self: n0(e.self), school: schoolT, univ: univT, disabled: n0(e.disabled), target, amount: fl(target * p.rate) };
}

/** 고향사랑기부금 세액공제 (조특법 제58조, 2026.1.1. 이후 기부분) */
export function hometownCredit(amt) {
  const h = v('hometownCredit');
  const a = Math.min(n0(amt), h.cap);
  const t1 = Math.min(a, h.tier1);
  const t2 = Math.min(Math.max(a - h.tier1, 0), h.tier2 - h.tier1);
  const t3 = Math.max(a - h.tier2, 0);
  return { allowed: a, amount: fl(t1 * 100 / 110) + fl(t2 * h.tier2Rate) + fl(t3 * h.tier3Rate) };
}

/** 정치자금기부금 세액공제 (조특법 제76조) — 근로소득금액 한도 */
export function politicalCredit(amt, incomeLimit) {
  const p = v('politicalCredit');
  const a = Math.min(n0(amt), Math.max(0, incomeLimit));
  const t1 = Math.min(a, p.tier1);
  const t2 = Math.min(Math.max(a - p.tier1, 0), p.highThreshold - p.tier1);
  const t3 = Math.max(a - p.highThreshold, 0);
  return { allowed: a, amount: fl(t1 * 100 / 110) + fl(t2 * p.rate) + fl(t3 * p.highRate) };
}

/** 특례·일반기부금 (제59조의4④) — base: 근로소득금액에서 정치자금·고향사랑기부금을 뺀 금액 */
export function donationCredit(base, d) {
  const p = v('donationCredit');
  const special = n0(d.special); const general = n0(d.general); const religious = n0(d.religious);
  const specialAllowed = Math.min(special, Math.max(0, base));
  const inc = Math.max(0, base - specialAllowed);
  let limit;
  if (religious > 0) limit = inc * p.religiousLimit + Math.min(inc * p.religiousOtherLimit, general);
  else limit = inc * p.generalLimit;
  const generalAllowed = fl(Math.min(general + religious, limit));
  const target = specialAllowed + generalAllowed;
  const amount = fl(Math.min(target, p.highThreshold) * p.rate + Math.max(target - p.highThreshold, 0) * p.highRate);
  const carry = special - specialAllowed + general + religious - generalAllowed;
  return { specialAllowed, generalAllowed, generalLimit: fl(limit), target, amount, carryForward: Math.max(0, carry) };
}

/** 4대보험 근로자 부담분 연간 추정 (월 총급여/12, 국민연금 상·하한 7월 변경 반영) */
export function estimateInsurance(g) {
  const m = Math.floor(g / 12);
  const h1 = socialInsurance({ monthlyPay: m, date: '2026-06-30' });
  const h2 = socialInsurance({ monthlyPay: m, date: '2026-07-01' });
  return {
    monthly: m,
    pension: (h1.np.employee + h2.np.employee) * 6,
    health: (h1.hi.employee + h1.hi.ltcEmployee) * 12,
    employment: h1.ei.employee * 12,
  };
}

/** 간이세액표로 1년 원천징수액 추정 (1~2월 개정 전 자녀공제, 3~12월 2026.3. 개정 표) */
export function estimatePrepaid(g, family, kaniKids) {
  const m = Math.floor(g / 12);
  const after = withholdingTax(m, family, kaniKids, 1);
  const table = after.tableTax;
  const cd = v('kaniChildDeductionJanFeb');
  const k = Math.min(int(kaniKids), Math.max(0, int(family)));
  const oldDed = k === 0 ? 0 : k === 1 ? cd.one : cd.two + (k - 2) * cd.extraPerChild;
  const janFeb = floor10(Math.max(0, table - oldDed));
  const janFebLocal = floor10(janFeb * 0.1);
  return {
    monthly: m, janFeb, marDec: after.incomeTax, oldDed, newDed: after.childDed,
    tax: janFeb * 2 + after.incomeTax * 10,
    local: janFebLocal * 2 + after.localTax * 10,
  };
}

/**
 * 연말정산 계산.
 * @param {object} p 연간 금액(원)
 */
export function calcYearEnd(p) {
  const g = n0(p.salary);
  if (!g) throw new Error('총급여를 입력하세요.');
  const family = Math.max(1, int(p.basicCount ?? 1));
  const kidsA = int(p.kidsCredit); // 2006~2016년생 (자녀세액공제 대상)
  const kidsB = int(p.kids2017); // 2017~2018년생
  const kidsC = int(p.kidsYoung); // 2019년 이후 출생
  const kidsAll = kidsA + kidsB + kidsC;
  if (kidsAll > family - 1) throw new Error('기본공제 대상 자녀 수가 기본공제 인원(본인 포함)보다 많을 수 없습니다.');
  const elderly = int(p.elderly); const disabled = int(p.disabled);
  if (elderly > family) throw new Error('경로우대(70세 이상) 인원은 기본공제 인원 안에서 입력하세요.');
  if (disabled > family) throw new Error('장애인 인원은 기본공제 인원 안에서 입력하세요.');

  // ── 근로소득금액
  const eid = fl(earnedIncomeDeduction(g));
  const earned = g - eid;

  // ── 4대보험
  const insEst = estimateInsurance(g);
  const manualIns = p.insuranceMode === 'manual';
  const pensionIns = manualIns ? n0(p.npsPaid) : insEst.pension;
  const healthIns = manualIns ? n0(p.healthPaid) : insEst.health;
  const empIns = manualIns ? n0(p.eiPaid) : insEst.employment;

  // ── 인적공제
  const P = v('personal');
  const basicDed = P.basic * family;
  const elderlyDed = P.elderly70 * elderly;
  const disabledDed = P.disabled * disabled;
  const singleParent = !!p.singleParent;
  const womanEligible = !!p.woman && !singleParent && earned <= P.womanIncomeCap;
  const womanDed = womanEligible ? P.woman : 0;
  const singleParentDed = singleParent ? P.singleParent : 0;
  const personalRaw = basicDed + elderlyDed + disabledDed + womanDed + singleParentDed;
  const personal = Math.min(personalRaw, earned);

  // ── 주택자금 (특별소득공제) + 주택청약 (조특법)
  const HR = v('housingRentLoan'); const HS = v('housingSubscription');
  const rentLoanRaw = fl(n0(p.rentLoanRepay) * HR.rate);
  const subEligible = g <= HS.salaryCap;
  const subRaw = subEligible ? fl(Math.min(n0(p.subscription), HS.paymentCap) * HS.rate) : 0;
  const rentLoan = Math.min(rentLoanRaw, HR.cap);
  const sub = Math.min(subRaw, HR.cap - rentLoan);
  const mCaps = v('mortgageInterestCaps');
  const mCap = mCaps[p.mortgageType] ?? mCaps.other15;
  const mortgage = Math.min(n0(p.mortgageInterest), Math.max(0, mCap - rentLoan - sub));

  // ── 신용카드
  const card = cardDeduction(g, { credit: p.cardCredit, debit: p.cardDebit, culture: p.cardCulture, market: p.cardMarket, transit: p.cardTransit }, kidsAll);

  // ── 공제 시나리오: 항목별(특별공제 신청) vs 표준세액공제
  const scenario = (itemized) => {
    const special = itemized ? healthIns + empIns + rentLoan + mortgage : 0;
    const housingSpecial = itemized ? rentLoan + mortgage : 0;
    const aggTarget = housingSpecial + sub + card.amount;
    const aggExcess = Math.max(0, aggTarget - v('deductionAggregateCap'));
    const totalDed = personal + pensionIns + special + sub + card.amount - aggExcess;
    const base = Math.max(0, earned - totalDed);
    const tax = fl(basicTax(base));

    // 세액공제
    const eic = earnedIncomeCredit(tax, g);
    const child = childCreditAmount(kidsA);
    const birth = birthCreditAmount(p.birthOrder, p.birthCount);
    const PA = v('pensionAccount');
    const paBase = Math.min(Math.min(n0(p.pensionSavings), PA.savingsCap) + n0(p.irp), PA.totalCap);
    const paRate = g <= PA.salaryThreshold ? PA.rateHigh : PA.rateLow;
    const pensionAcct = fl(paBase * paRate);
    const IC = v('insuranceCredit');
    const insCredit = itemized ? fl(Math.min(n0(p.insGeneral), IC.generalCap) * IC.generalRate) + fl(Math.min(n0(p.insDisabled), IC.disabledCap) * IC.disabledRate) : 0;
    const med = medicalCredit(g, { general: p.medGeneral, special: p.medSpecial, premature: p.medPremature, infertility: p.medInfertility });
    const edu = educationCredit({ self: p.eduSelf, school: [p.eduSchool1, p.eduSchool2, p.eduSchool3], univ: [p.eduUniv1, p.eduUniv2], disabled: p.eduDisabled });
    const pol = politicalCredit(p.donPolitical, earned);
    const home = hometownCredit(p.donHometown);
    const don = donationCredit(Math.max(0, earned - pol.allowed - home.allowed), { special: p.donSpecial, general: p.donGeneral, religious: p.donReligious });
    const MR = v('monthlyRent');
    const rentEligible = g <= MR.salaryCap && earned <= MR.incomeCap;
    const rentRate = g <= MR.highRateSalaryCap && earned <= MR.highRateIncomeCap ? MR.highRate : MR.rate;
    const rent = itemized && rentEligible ? fl(Math.min(n0(p.monthlyRent), MR.cap) * rentRate) : 0;
    const marriage = p.marriage ? v('marriageCredit') : 0;
    const standard = itemized ? 0 : v('standardCredit');

    // 산출세액 한도 안에서 원천징수영수증 순서대로 적용 (제61조)
    const order = [
      ['earned', '근로소득세액공제', eic.amount, LAW.earnedCredit],
      ['child', '자녀세액공제', child, LAW.child],
      ['birth', '출산·입양 세액공제', birth, '소득세법 제59조의2③'],
      ['pensionAcct', '연금계좌 세액공제', pensionAcct, LAW.pensionAcct],
      ['insurance', '보장성보험료 세액공제', insCredit, LAW.insCredit],
      ['medical', '의료비 세액공제', itemized ? med.amount : 0, LAW.medical],
      ['education', '교육비 세액공제', itemized ? edu.amount : 0, LAW.education],
      ['political', '정치자금기부금 세액공제', pol.amount, LAW.political],
      ['hometown', '고향사랑기부금 세액공제', home.amount, LAW.hometown],
      ['donation', '특례·일반기부금 세액공제', itemized ? don.amount : 0, LAW.donation],
      ['standard', '표준세액공제', standard, LAW.standard],
      ['rent', '월세 세액공제', rent, LAW.rent],
      ['marriage', '결혼세액공제', marriage, LAW.marriage],
    ];
    let left = tax;
    const credits = order.map(([key, name, amount, law]) => {
      const applied = Math.min(amount, left);
      left -= applied;
      return { key, name, amount, applied, law };
    });
    const creditTotal = credits.reduce((s, c) => s + c.applied, 0);
    const decided = Math.max(0, tax - creditTotal);
    return {
      itemized, special, housingSpecial, aggTarget, aggExcess, totalDed, base, tax, eic, child, birth,
      paBase, paRate, pensionAcct, insCredit, med, edu, pol, home, don, rent, rentEligible, rentRate, marriage, standard,
      credits, creditTotal, decided,
    };
  };

  const itemizedRes = scenario(true);
  const standardRes = scenario(false);
  const chosen = standardRes.decided < itemizedRes.decided ? standardRes : itemizedRes;
  const decided = chosen.decided;
  const localDecided = fl(decided * RATES.incomeTax.localTaxRate.value);

  // ── 기납부세액
  const kaniKids = kidsA + kidsB; // 간이세액표 비고 3: 8세 이상 20세 이하
  const est = estimatePrepaid(g, family, kaniKids);
  const prepaidManual = p.prepaidMode === 'manual';
  const prepaid = prepaidManual ? n0(p.prepaidTax) : est.tax;
  const prepaidLocal = prepaidManual ? (p.prepaidLocal !== undefined && p.prepaidLocal !== '' && Number(p.prepaidLocal) > 0 ? n0(p.prepaidLocal) : fl(prepaid * 0.1)) : est.local;

  let diff = decided - prepaid;
  let diffLocal = localDecided - prepaidLocal;
  let smallExempt = false;
  if (diff > 0 && diff < v('smallAmount')) { // 소액부징수 (추가납부 1천원 미만)
    diff = 0; smallExempt = true;
    if (diffLocal > 0) diffLocal = 0;
  }

  return {
    salary: g, eid, earned, family, kidsA, kidsB, kidsC, kidsAll, kaniKids,
    insurance: { mode: manualIns ? 'manual' : 'auto', pension: pensionIns, health: healthIns, employment: empIns, estimate: insEst },
    personal: { basic: basicDed, elderly: elderlyDed, disabled: disabledDed, woman: womanDed, womanRequested: !!p.woman, singleParent: singleParentDed, raw: personalRaw, amount: personal },
    housing: { rentLoanRaw, rentLoan, subRaw, sub, subEligible, mortgage, mortgageCap: mCap },
    card,
    itemized: itemizedRes, standard: standardRes, chosen,
    decided, localDecided,
    prepaid: { mode: prepaidManual ? 'manual' : 'estimate', tax: prepaid, local: prepaidLocal, estimate: est },
    diff, diffLocal, smallExempt,
    total: diff + diffLocal,
  };
}
