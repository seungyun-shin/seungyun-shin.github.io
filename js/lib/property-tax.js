// 주택 재산세·도시지역분·지방교육세·소방분 지역자원시설세 (개인, 주택 1채)
//   과세표준: 지방세법 제110조①2호 — 시가표준액(공시가격) × 공정시장가액비율
//             시행령 제109조①2호 — 60%, 2026년 1세대 1주택 3억 이하 43%·6억 이하 44%·6억 초과 45%
//   과세표준상한: 제110조③, 시행령 제109조의2 — 직전 연도 시가표준액 × 올해 비율 + 올해 과세표준 × 5%
//   세율: 제111조①3호나목 표준세율, 제111조의2 1세대 1주택(시가표준액 9억 이하) 특례세율
//   도시지역분: 제112조①2호 — 과세표준 × 0.14%
//   세부담상한: 제122조 단서 — 주택은 미적용. 다만 법률 제19230호 부칙 제15조 — 2023년 이전 과세된 주택은
//               2028.12.31.까지 종전 제122조(3억 이하 105%, 6억 이하 110%, 6억 초과 130%)
//   지방교육세: 제151조①6호 — 재산세(도시지역분 제외) × 20%
//   소방분 지역자원시설세: 제146조③1호·④ — 건축물 시가표준액 × 공정시장가액비율에 누진세율
//   납기: 제115조①3호 — 1/2은 7월 16~31일, 1/2은 9월 16~30일 (20만원 이하는 조례로 7월 한꺼번에)
//   분할납부: 제118조, 시행령 제116조 — 납부세액 250만원 초과
//   끝수: 세목별 10원 미만 절사, 과세표준 1원 미만 절사 (지방세기본법 제59조 → 국고금관리법 제47조)
import { RATES } from '../rates/2026.js';

const P = RATES.propertyTax;
const v = (k) => P[k].value;

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const floor10 = (x) => Math.floor(x / 10 + 1e-9) * 10;
const floor1 = (x) => Math.floor(x + 1e-9);
const bool = (x, d = false) => (x === undefined || x === null || x === '' ? d : x === true || x === 'true' || x === '1' || x === 1);

/** 누진세율표 적용 (표: { upTo, rate, base }, 구간 시작은 앞 구간의 upTo) */
export function progressive(table, base) {
  let from = 0;
  for (const t of table) {
    if (base <= t.upTo) return t.base + (base - from) * t.rate;
    from = t.upTo;
  }
  throw new Error('세율표 오류');
}

/** 재산세 공정시장가액비율 (시행령 제109조①2호) */
export function fairRatio(price, oneHouse) {
  const r = v('fairRatio');
  if (!oneHouse) return r.general;
  if (price <= r.oneBand1) return r.one3;
  if (price <= r.oneBand2) return r.one6;
  return r.oneOver;
}

/** 표준세율 세액 (제111조①3호나목) */
export const standardTax = (base) => progressive(v('rates'), base);
/** 1세대 1주택 특례세율 세액 (제111조의2①) */
export const oneHouseTax = (base) => progressive(v('oneHouseRates'), base);
/** 소방분 지역자원시설세 (제146조③1호) */
export const fireTaxOf = (base) => progressive(v('fireTax'), base);

/**
 * @param {object} p
 * @param {number} p.price 올해(6월 1일 기준) 주택 공시가격(시가표준액)
 * @param {boolean} [p.oneHouse] 1세대 1주택 (시행령 제110조의2)
 * @param {boolean} [p.urban] 도시지역분 적용대상 지역 (기본 true)
 * @param {number} [p.buildingValue] 건축물 시가표준액 (소방분 지역자원시설세용, 없으면 계산 안 함)
 * @param {number} [p.prevPrice] 작년 공시가격 (과세표준상한 계산용)
 * @param {boolean} [p.legacy] 2023년 이전부터 재산세가 과세된 주택 (종전 세부담상한, 2028년까지)
 * @param {number} [p.prevTax] 작년 재산세(도시지역분 제외)
 * @param {number} [p.prevUrbanTax] 작년 도시지역분
 */
export function calcPropertyTax(p) {
  const price = Math.round(toNum(p.price));
  const oneHouse = bool(p.oneHouse);
  const urban = bool(p.urban, true);
  const buildingValue = Math.round(toNum(p.buildingValue));
  const prevPrice = Math.round(toNum(p.prevPrice));
  const legacy = bool(p.legacy);
  const prevTax = Math.round(toNum(p.prevTax));
  const prevUrbanTax = Math.round(toNum(p.prevUrbanTax));
  if (!(price > 0)) throw new Error('주택 공시가격을 입력하세요.');
  if (price > 1e12) throw new Error('공시가격이 너무 큽니다.');
  for (const [n, x] of [['건축물 시가표준액', buildingValue], ['작년 공시가격', prevPrice], ['작년 재산세', prevTax], ['작년 도시지역분', prevUrbanTax]]) {
    if (!Number.isFinite(x) || x < 0) throw new Error(`${n}은(는) 0 이상의 숫자로 입력하세요.`);
  }
  if (buildingValue > price) throw new Error('건축물 시가표준액은 주택 공시가격보다 클 수 없습니다.');

  const warnings = [];
  const ratio = fairRatio(price, oneHouse);
  const rawBase = floor1(price * ratio);
  // 과세표준상한 (제110조③)
  const capRate = v('baseCap').rate;
  const baseCapAmount = prevPrice > 0 ? floor1(prevPrice * ratio + rawBase * capRate) : null;
  const capped = baseCapAmount !== null && baseCapAmount < rawBase;
  const base = capped ? baseCapAmount : rawBase;

  const special = oneHouse && price <= v('oneHousePriceCap');
  const calcMain = floor10(special ? oneHouseTax(base) : standardTax(base));
  const calcUrban = urban ? floor10(base * v('urbanRate')) : 0;

  // 종전 세부담상한 (부칙 제15조)
  const lc = v('legacyCap');
  const legacyRate = price <= lc.band1 ? lc.upTo3 : price <= lc.band2 ? lc.upTo6 : lc.over6;
  const mainCapAmount = legacy && prevTax > 0 ? floor10(prevTax * legacyRate) : null;
  const urbanCapAmount = legacy && urban && prevUrbanTax > 0 ? floor10(prevUrbanTax * legacyRate) : null;
  const mainTax = mainCapAmount !== null ? Math.min(calcMain, mainCapAmount) : calcMain;
  const urbanTax = urbanCapAmount !== null ? Math.min(calcUrban, urbanCapAmount) : calcUrban;
  if (legacy && !(prevTax > 0)) warnings.push('종전 세부담상한을 계산하려면 작년 재산세(도시지역분 제외)를 넣어야 합니다. 넣지 않아 상한 없이 계산했습니다.');

  const eduTax = floor10(mainTax * v('eduRate'));
  const fireBase = buildingValue > 0 ? floor1(buildingValue * ratio) : 0;
  const fireTax = buildingValue > 0 ? floor10(fireTaxOf(fireBase)) : 0;

  const propertyTotal = mainTax + urbanTax; // 재산세(도시지역분 포함)
  const total = propertyTotal + eduTax + fireTax;

  // 7월·9월 분할 (제115조①3호)
  const half = (x) => floor10(x / 2);
  const items = { mainTax, urbanTax, eduTax, fireTax };
  const july = Object.fromEntries(Object.entries(items).map(([k, x]) => [k, half(x)]));
  const sept = Object.fromEntries(Object.entries(items).map(([k, x]) => [k, x - july[k]]));
  july.total = july.mainTax + july.urbanTax + july.eduTax + july.fireTax;
  sept.total = total - july.total;
  const d = v('dueDates');
  const lumpSumPossible = propertyTotal <= d.lumpSumUpTo;

  // 분할납부 (제118조, 시행령 제116조) — 각 납기의 재산세(도시지역분 포함) 기준
  const inst = v('installment');
  const installable = (amt) => (amt <= inst.over ? 0 : amt <= inst.half ? amt - inst.over : floor10(amt / 2));
  const julyProperty = july.mainTax + july.urbanTax;
  const septProperty = sept.mainTax + sept.urbanTax;

  if (oneHouse && !special) warnings.push('공시가격 9억원을 넘는 1세대 1주택은 공정시장가액비율 특례(45%)만 받고 세율은 표준세율을 적용합니다(지방세법 제111조의2①).');
  if (capped) warnings.push('작년 공시가격 기준 과세표준상한(지방세법 제110조③)이 적용되어 과세표준이 줄었습니다.');
  if (mainCapAmount !== null && mainTax < calcMain) warnings.push(`종전 세부담상한(작년 재산세의 ${Math.round(legacyRate * 100)}%)이 적용되었습니다(법률 제19230호 부칙 제15조, 2028년까지).`);

  return {
    price, oneHouse, urban, special, ratio, rawBase, baseCapAmount, capped, base,
    calcMain, calcUrban, legacyRate, mainCapAmount, urbanCapAmount,
    mainTax, urbanTax, eduTax, fireBase, fireTax, buildingValue,
    propertyTotal, total, july, sept, lumpSumPossible,
    julyInstallable: installable(julyProperty), septInstallable: installable(septProperty),
    effectiveRate: total / price,
    warnings,
  };
}
