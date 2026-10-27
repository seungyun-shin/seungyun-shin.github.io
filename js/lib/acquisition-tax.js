// 주택 유상취득 취득세·지방교육세·농어촌특별세 (개인)
//   기본: 지방세법 제11조①8호 — 6억 이하 1%, 6억 초과 9억 이하 (가액 × 2/3억 − 3) × 1/100 (넷째 자리), 9억 초과 3%
//   중과: 제13조의2① — 조정대상지역 2주택(일시적 2주택 제외)·그 외 지역 3주택 8%, 조정 3주택 이상·그 외 4주택 이상 12%
//         시행령 제28조의2 — 시가표준액 수도권 1억·그 외 2억 이하 주택은 중과 제외
//   지방교육세: 제151조①1호 — 일반 = 취득세율 × 50% × 20%, 중과 = (4% − 2%) × 20% = 0.4%
//   농어촌특별세: 농특세법 제5조①6호 — 표준세율을 2%로 본 취득세액 × 10% (0.2%, 중과 0.6%·1.0%), 85㎡ 이하 비과세(제4조)
//   생애최초: 지방세특례제한법 제36조의3 — 12억 이하, 취득세 200만원 한도 감면(①2호), 중과 미적용
//         300만원 한도(①1호): 가~다목 전용 60㎡ 이하·취득당시가액 3억원(수도권 6억원) 이하 아파트 외 공동주택·도시형생활주택·다가구 호수,
//                            라목 인구감소지역 주택(가격·면적·유형 요건 없음)
//   끝수: 세목별 10원 미만 절사 (지방세기본법 제59조 → 국고금관리법 제47조)
import { RATES } from '../rates/2026.js';

const A = RATES.acquisition;
const v = (k) => A[k].value;

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor10 = (x) => Math.floor(x / 10 + 1e-9) * 10;
const bool = (x) => x === true || x === 'true' || x === '1';

/** 제11조①8호 세율 (소수, 예: 0.0167) */
export function homeRate(price) {
  const r = v('homeRates');
  if (price <= r.lowUpTo) return r.low;
  if (price > r.highOver) return r.high;
  const raw = ((price * 2) / 3e8 - 3) / 100;
  const k = 10 ** r.roundDigits;
  return Math.round(raw * k + 1e-9) / k;
}

/** 중과 세율 판단. 중과가 아니면 null */
export function heavyRate({ houses, adjusted, temporary, lowValue }) {
  const h = v('heavy');
  if (lowValue) return null;
  const x2 = h.standard + h.heavyBase * h.double; // 8%
  const x4 = h.standard + h.heavyBase * h.quadruple; // 12%
  if (adjusted) {
    if (houses >= 3) return { rate: x4, add: h.heavyBase * h.quadruple, label: '조정대상지역 3주택 이상' };
    if (houses === 2 && !temporary) return { rate: x2, add: h.heavyBase * h.double, label: '조정대상지역 2주택' };
    return null;
  }
  if (houses >= 4) return { rate: x4, add: h.heavyBase * h.quadruple, label: '조정대상지역 외 4주택 이상' };
  if (houses === 3) return { rate: x2, add: h.heavyBase * h.double, label: '조정대상지역 외 3주택' };
  return null;
}

/**
 * @param {object} p
 * @param {number} p.price 취득당시가액(실제 거래가격)
 * @param {number} p.houses 이번 주택을 포함한 1세대 주택 수 (분양권·입주권·주택분 오피스텔 포함)
 * @param {boolean} [p.adjusted] 취득 주택이 조정대상지역에 있음
 * @param {boolean} [p.temporary] 일시적 2주택 (종전 주택을 기한 안에 처분 예정)
 * @param {boolean} [p.lowValue] 시가표준액이 수도권 1억원·그 외 2억원 이하 (정비구역 등 제외)
 * @param {boolean} [p.over85] 주거전용면적 85㎡ 초과 (농어촌특별세 과세)
 * @param {boolean} [p.firstHome] 생애최초 주택 구입 감면 신청
 * @param {boolean} [p.firstHomeSmall] 300만원 한도 소형 주택 (제36조의3①1호가~다목: 전용 60㎡ 이하 아파트 외 공동주택·도시형생활주택·다가구 호수, 가격 요건은 capitalArea로 판정)
 * @param {boolean} [p.capitalArea] 주택이 수도권에 있음 (소형 주택 가격 요건 6억원, 아니면 3억원)
 * @param {boolean} [p.firstHomeDepop] 인구감소지역 주택 (제36조의3①1호라목, 가격 요건 없음)
 */
export function calcAcquisitionTax(p) {
  const price = Math.round(toNum(p.price));
  const houses = toNum(p.houses, 1);
  const adjusted = bool(p.adjusted);
  const temporary = bool(p.temporary);
  const lowValue = bool(p.lowValue);
  const over85 = bool(p.over85);
  const firstHomeReq = bool(p.firstHome);
  let firstHomeSmall = bool(p.firstHomeSmall);
  const capitalArea = bool(p.capitalArea);
  const firstHomeDepop = bool(p.firstHomeDepop);
  if (!(price > 0)) throw new Error('취득가액(매매가격)을 입력하세요.');
  if (price > 1e13) throw new Error('취득가액이 너무 큽니다.');
  if (!Number.isInteger(houses) || houses < 1 || houses > 50) throw new Error('주택 수는 이번 주택을 포함해 1 이상의 정수로 입력하세요.');

  const warnings = [];
  const fh = v('firstHome');
  let firstHome = firstHomeReq;
  if (firstHome && houses > 1) {
    warnings.push('생애최초 감면은 본인과 배우자가 주택을 소유한 사실이 없어야 합니다. 주택 수가 2 이상이라 감면을 빼고 계산했습니다.');
    firstHome = false;
  }
  if (firstHome && price > fh.priceCap) {
    warnings.push('생애최초 감면은 취득당시가액 12억원 이하 주택만 받을 수 있어 감면을 빼고 계산했습니다.');
    firstHome = false;
  }
  // 1호가~다목 가격 요건: 3억원(수도권 6억원) 이하. 라목(인구감소지역)은 가격 요건 없음
  const smallPriceCap = capitalArea ? fh.smallPriceMetro : fh.smallPriceOther;
  if (firstHome && firstHomeSmall && price > smallPriceCap) {
    firstHomeSmall = false;
    if (!firstHomeDepop) warnings.push(`300만원 한도 소형 주택(전용 60㎡ 이하 아파트 외 공동주택·도시형생활주택·다가구 호수)은 취득당시가액 ${capitalArea ? '6억원(수도권)' : '3억원(수도권 외)'} 이하만 해당해 200만원 한도로 계산했습니다(지방세특례제한법 제36조의3①1호가~다목).`);
  }
  const relief300 = firstHome && (firstHomeSmall || firstHomeDepop);
  const reliefBasis = !firstHome ? '' : firstHomeDepop ? '제36조의3①1호라목, 인구감소지역 주택 300만원 한도'
    : firstHomeSmall ? '제36조의3①1호가~다목, 소형 주택 300만원 한도' : '제36조의3①2호, 200만원 한도';

  const base = homeRate(price);
  const heavy = firstHome ? null : heavyRate({ houses, adjusted, temporary, lowValue });
  const rate = heavy ? heavy.rate : base;

  const acqBefore = floor10(price * rate);
  const reliefCap = firstHome ? (relief300 ? fh.reliefSmall : fh.relief) : 0;
  const relief = Math.min(acqBefore, reliefCap);
  const acqTax = acqBefore - relief;

  const e = v('eduTax');
  const eduRate = heavy ? e.heavyRate : base * e.homeFactor * e.rate;
  const eduTax = floor10(price * eduRate);

  const f = v('farmTax');
  const farmRate = over85 ? (f.stdRate + (heavy ? heavy.add : 0)) * f.rate : 0;
  const farmOnRelief = over85 ? relief * f.reliefRate : 0;
  const farmTax = floor10(price * farmRate + farmOnRelief);

  const total = acqTax + eduTax + farmTax;
  if (heavy) warnings.push(`${heavy.label}에 해당해 중과세율 ${+(heavy.rate * 100).toFixed(2)}%를 적용했습니다 (지방세법 제13조의2①).`);
  if (houses === 2 && adjusted && temporary && !firstHome && !lowValue) warnings.push('일시적 2주택으로 일반세율을 적용했습니다. 종전 주택을 기한(3년, 종전·신규 주택이 모두 조정대상지역이면 2년) 안에 처분하지 않으면 일시적 2주택에 해당하지 않아 중과세율 대상이 됩니다 (시행령 제28조의5).');

  return {
    price, houses, adjusted, temporary, lowValue, over85, firstHome, firstHomeSmall, capitalArea, firstHomeDepop: firstHome && firstHomeDepop, relief300, reliefBasis,
    baseRate: base,
    heavy: !!heavy,
    heavyLabel: heavy ? heavy.label : '',
    rate,
    acqBefore,
    relief,
    acqTax,
    eduRate,
    eduTax,
    farmRate,
    farmOnRelief,
    farmTax,
    total,
    effectiveRate: total / price,
    warnings,
  };
}
