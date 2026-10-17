/* TESR Robot Builder — one header menu for every page (docs/nav.js)
 * The whole site is 4 steps: ① ออกแบบ → ② ทดสอบ & เกม (optional) → ③ สรุป & ราคา → ④ ส่งออก ROS 2, plus the file guide.
 */
(function () {
  'use strict';
  const STEPS = [
    ['index.html', '1', 'ออกแบบ', ['index.html', '']],
    ['play.html', '2', 'ทดสอบ & เกม', ['play.html', 'arena.html']],
    ['summary.html', '3', 'สรุป & ราคา', ['summary.html']],
    ['build.html', '4', 'ส่งออก ROS 2', ['build.html']],
  ];
  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const nav = document.querySelector('header.tesr nav'); if (!nav) return;
  const esc = (s) => s.replace(/&/g, '&amp;');
  nav.className = 'steps-nav';
  nav.innerHTML = STEPS.map(([href, n, label, pages], i) =>
    `${i ? '<span class="sep" aria-hidden="true">›</span>' : ''}<a href="./${href}" class="${pages.includes(here) ? 'active' : ''}"><i>${n}</i>${esc(label)}</a>`).join('')
    + `<a href="./guide.html" class="guide ${here === 'guide.html' ? 'active' : ''}">📘 คู่มือ</a>`;
})();
