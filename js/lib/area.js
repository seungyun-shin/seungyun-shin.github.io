// 면적 환산 — 1평 = 400/121㎡ (RATES.area.pyeong)
// 공급면적 = 주거전용면적 + 주거공용면적, 계약면적 = 공급면적 + 그 밖의 공용면적 (분양 실무에서 쓰는 이름.
// 주택공급에 관한 규칙 제21조⑤는 공급면적을 주거전용면적으로 표시하고 공용면적을 따로 표시할 수 있게 한다).
import { RATES } from '../rates/2026.js';

export const M2_PER_PYEONG = RATES.area.pyeong.value; // 400/121
const r2 = (x) => Math.round(x * 100 + 1e-9) / 100;

const toNum = (x, d = 0) => {
  if (x === '' || x == null) return d;
  const n = Number(String(x).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

export const m2ToPyeong = (m2) => (m2 * 121) / 400;
export const pyeongToM2 = (py) => (py * 400) / 121;

/**
 * @param {object} p
 * @param {number} p.value 입력 면적
 * @param {'m2'|'pyeong'} p.unit 입력 단위
 * @param {number} [p.exclusive] 주거전용면적(㎡)
 * @param {number} [p.residentialCommon] 주거공용면적(㎡)
 * @param {number} [p.otherCommon] 그 밖의 공용면적(㎡)
 */
export function calcArea(p) {
  const unit = p.unit || 'm2';
  if (!['m2', 'pyeong'].includes(unit)) throw new Error('단위가 올바르지 않습니다.');
  const value = toNum(p.value, NaN);
  const exclusive = toNum(p.exclusive, 0);
  const residentialCommon = toNum(p.residentialCommon, 0);
  const otherCommon = toNum(p.otherCommon, 0);
  const hasValue = Number.isFinite(value) && String(p.value ?? '').trim() !== '';
  if (hasValue && !(value > 0)) throw new Error('면적은 0보다 크게 입력하세요.');
  if ([exclusive, residentialCommon, otherCommon].some((x) => !(x >= 0))) throw new Error('면적은 0 이상으로 입력하세요.');
  if (!hasValue && !exclusive) throw new Error('환산할 면적이나 전용면적을 입력하세요.');

  const out = { unit };
  if (hasValue) {
    const m2 = unit === 'm2' ? value : pyeongToM2(value);
    const py = unit === 'm2' ? m2ToPyeong(value) : value;
    Object.assign(out, { value, m2, pyeong: py, m2Round: r2(m2), pyeongRound: r2(py) });
  }
  if (exclusive > 0) {
    const supply = r2(exclusive + residentialCommon);
    const contract = r2(supply + otherCommon);
    Object.assign(out, {
      exclusive, residentialCommon, otherCommon, supply, contract,
      exclusivePyeong: r2(m2ToPyeong(exclusive)),
      supplyPyeong: r2(m2ToPyeong(supply)),
      contractPyeong: r2(m2ToPyeong(contract)),
      // 전용률 = 전용 ÷ 공급 (공용면적을 넣지 않으면 100%)
      exclusiveRatio: supply > 0 ? exclusive / supply : 1,
      hasCommon: residentialCommon > 0,
    });
  }
  return out;
}

/** 자주 찾는 면적 환산표 (㎡ → 평) */
export function areaTable(list = [33, 49, 59, 74, 84, 99, 114, 135]) {
  return list.map((m2) => ({ m2, pyeong: r2(m2ToPyeong(m2)) }));
}
