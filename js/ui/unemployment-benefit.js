import { calcUnemployment } from '../lib/unemployment.js';
import { bindCalculator, won, num, kpi, basisBlock, esc } from './common.js';

const L = (path, label) => `<a href="https://www.law.go.kr/법령/${path}" target="_blank" rel="noopener">${esc(label)}</a>`;

function render(r) {
  let html = `<h2>계산 결과</h2><p>예상 구직급여 총액 (${r.days}일)</p><p class="big">${won(r.totalBenefit)}</p>
  <div class="kpis">
    ${kpi('구직급여일액', `${won(r.daily)}${r.floorBinding ? ' <small class="muted small">(하한)</small>' : r.capBinding ? ' <small class="muted small">(상한)</small>' : ''}`)}
    ${kpi('소정급여일수', `${r.days}일`)}
    ${kpi('30일 기준', won(r.monthlyApprox))}
    ${kpi('수급기간 끝', esc(r.benefitPeriodEnd))}
  </div>`;
  r.warnings.forEach((w) => { html += `<div class="note">${esc(w)}</div>`; });
  const steps = [
    `평균임금 산정기간: ${esc(r.periodStart)} ~ ${esc(r.lastWorkDate)} (${r.periodDays}일${r.periodDays !== r.autoDays ? `, 직접 입력 — 자동 계산은 ${r.autoDays}일` : ''})`,
    `평균임금 = (3개월 임금 ${won(r.wages3m)}${r.bonusAdd ? ` + 상여 3/12 ${won(r.bonusAdd)}` : ''}${r.leaveAdd ? ` + 연차수당 3/12 ${won(r.leaveAdd)}` : ''}) ÷ ${r.periodDays}일 = ${won(r.avgDaily)} (원 미만 절사)`,
    r.ordinaryDaily ? `통상임금 일급 ${won(r.ordinaryDaily)} → ${r.useOrdinary ? '평균임금보다 커서 통상임금을 기초일액으로' : '평균임금이 더 커서 평균임금 사용'} (${L('고용보험법/제45조', '고용보험법 제45조②')})` : '월 통상임금을 넣으면 평균임금과 비교해 큰 금액을 씁니다 (제45조②).',
    `기초일액 = min(${won(r.rawBase)}, 상한 ${won(r.cap)}) = ${won(r.base)}${r.capBinding ? ' (상한 적용)' : ''} — ${L('고용보험법시행령/제68조', '시행령 제68조①')} (2026.1.1. 이후 이직자 11만3500원)`,
    `기초일액 × 60% = ${won(r.byRate)} (${L('고용보험법/제46조', '제46조①1호')})`,
    `하한 = 최저임금 ${won(r.minWage)} × 1일 소정근로시간 ${num(r.hours)}시간 × 80% = ${won(r.floor)} (${L('고용보험법/제45조', '제45조④')}, 제46조①2호) → ${r.floorBinding ? '60% 금액이 하한보다 낮아 하한 적용 (제46조②)' : '60% 금액이 하한 이상'}`,
    `구직급여일액 ${won(r.daily)} (상한 ${won(r.capDaily)})`,
    `소정급여일수: 이직일 현재 ${num(r.age)}세${r.disabled ? '·장애인' : ''}, 피보험기간 ${esc(r.bandLabel)} → ${r.days}일 (${L('고용보험법/제50조', '제50조① 별표 1')})`,
    `총액 = ${won(r.daily)} × ${r.days}일 = ${won(r.totalBenefit)}. 실업 신고일부터 7일은 대기기간(${L('고용보험법/제49조', '제49조')}), 이직 다음 날부터 12개월(${esc(r.benefitPeriodEnd)}까지) 안에만 지급 (${L('고용보험법/제48조', '제48조')})`,
  ];
  html += basisBlock('계산 근거 펼치기', steps, true);
  html += '<p class="small muted">구직급여는 비과세입니다. 실업인정일마다 그 사이 날수만큼 지급되며, 재취업 활동을 하지 않거나 소득을 신고하지 않으면 지급이 중단되거나 반환 대상이 됩니다.</p>';
  return html;
}

bindCalculator({
  defaults: { lastWorkDate: '2026-09-30', age: '36', wages3m: '9000000', insured: '3to5', dailyHours: '8', unit180: true, involuntary: true },
  validUntil: '2027-12-31',
  compute: (v) => calcUnemployment(v),
  render,
});
