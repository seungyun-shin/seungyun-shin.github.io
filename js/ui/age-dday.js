import { calcDates } from '../lib/age.js';
import { bindCalculator, num, kpi, esc, todayStr } from './common.js';

const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return `${y}년 ${m}월 ${dd}일`; };
const dd = (n) => (n > 0 ? `D-${num(n)}` : n < 0 ? `D+${num(-n)}` : 'D-Day');

function render(r) {
  let html = '<h2>계산 결과</h2>';
  if (r.mode === 'age') {
    html += `<p>${d(r.baseDate)} 기준 만 나이</p><p class="big">만 ${r.manAge}세${r.manAge === 0 ? ` <small>${r.monthsTotal}개월</small>` : ` <small>${r.monthsOver}개월</small>`}</p>
    <div class="kpis">${kpi('연 나이', `${r.yearAge}세`)}${kpi('세는 나이 (참고)', `${r.countingAge}세`)}${kpi('다음 생일', `${d(r.nextBirthday)}<br><small class="muted">${dd(r.daysToNextBirthday)} · 만 ${r.nextAge}세</small>`)}${kpi('태어난 날부터', `${num(r.daysLived)}일째`)}</div>`;
    if (r.isBirthday) html += '<p class="ok">오늘이 생일입니다. 오늘부터 이 나이입니다.</p>';
    if (r.leapDayBirth) html += '<div class="note">2월 29일생은 평년에 3월 1일부터 한 살 더 먹는 것으로 계산합니다 (민법 제160조③ 적용, 이 계산기의 해석).</div>';
    html += '<p class="small muted">만 나이: 민법 제158조·행정기본법 제7조의2 (2023.6.28. 시행). 청소년보호법처럼 법령에 따로 정한 경우(연 나이 기준)는 그 규정이 우선합니다.</p>';
  } else if (r.mode === 'diff') {
    html += `<p>${d(r.startDate)} → ${d(r.endDate)}${r.swapped ? ' (앞뒤를 바꿔 계산)' : ''}</p><p class="big">${num(r.shownDays)}일 <small>${r.includeStart ? '양 끝 포함' : '시작일 미포함'}</small></p>
    <div class="kpis">${kpi('경과 일수', `${num(r.days)}일`)}${kpi('양 끝 포함', `${num(r.daysInclusive)}일`)}${kpi('주 단위', `${num(r.weeks)}주 ${r.weekRemainder}일`)}${kpi('달력 기준', `${r.years ? `${r.years}년 ` : ''}${r.monthsRem}개월 ${r.daysRem}일`)}</div>`;
  } else if (r.mode === 'dday') {
    html += `<p>${d(r.targetDate)} (${r.weekday}요일)</p><p class="big">${dd(r.diff)}</p>
    <p>${r.diff > 0 ? `오늘(${d(r.today)})부터 ${num(r.diff)}일 남았습니다.` : r.diff < 0 ? `오늘(${d(r.today)})은 ${num(-r.diff)}일 지났습니다.` : '오늘이 그날입니다.'}</p>`;
  } else {
    const row = (x) => `<tr${x.passed ? ' class="muted"' : ''}><td>${esc(x.label)}</td><td>${d(x.date)} (${x.weekday})</td><td class="num">${x.dday === null ? '' : dd(x.dday)}</td></tr>`;
    html += `<p>${d(r.startDate)}부터 (${r.countStartAsDay1 ? '시작일 = 1일째' : '시작일 다음 날 = 1일째'})</p>`;
    if (r.todayCount !== null && r.todayCount > 0) html += `<p class="big">오늘 ${num(r.todayCount)}일째</p>`;
    html += `<div class="table-scroll"><table><thead><tr><th>기념일</th><th>날짜</th><th class="num">D-day</th></tr></thead><tbody>${r.days.map(row).join('')}${r.yearly.map(row).join('')}</tbody></table></div>`;
  }
  return html;
}

bindCalculator({
  defaults: () => ({ mode: 'age', birthDate: '1990-01-01', startDate: todayStr(), endDate: todayStr(), targetDate: `${todayStr().slice(0, 4)}-12-25`, baseDate: todayStr(), countStartAsDay1: true }),
  validUntil: '9999-12-31',
  compute: (v) => calcDates(v),
  render,
  onChange: (form) => {
    const m = form.querySelector('[name=mode]:checked')?.value || 'age';
    form.querySelectorAll('[data-mode]').forEach((el) => { el.hidden = !el.dataset.mode.split(' ').includes(m); });
  },
});
