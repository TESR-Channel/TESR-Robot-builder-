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

  // version badge next to the logo → "What's new" window (data in version.js)
  const V = window.TESR_RB;
  const h1 = document.querySelector('header.tesr h1');
  if (V && h1 && !document.getElementById('verBadge')) {
    const en = () => document.documentElement.lang === 'en';
    const b = document.createElement('button');
    b.id = 'verBadge'; b.className = 'ver-badge'; b.type = 'button'; b.textContent = 'v' + V.version;
    b.title = 'TESR Robot Builder v' + V.version + ' · ' + V.date;
    h1.insertAdjacentElement('afterend', b);
    b.addEventListener('click', () => {
      const d = document.createElement('div'); d.className = 'ver-modal';
      d.innerHTML = `<div class="card" role="dialog" aria-label="What's new"><button class="x" aria-label="close">✕</button>
        <h2>${en() ? 'What’s new' : 'มีอะไรใหม่'} <small>TESR Robot Builder v${V.version}</small></h2>
        <ol>${V.releases.map(([v, dt, th, eng], i) => `<li class="${i ? '' : 'now'}"><b>v${v}</b><span>${dt}</span><p>${en() ? eng : th}</p></li>`).join('')}</ol></div>`;
      document.body.appendChild(d);
      d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.x')) d.remove(); });
      document.addEventListener('keydown', function k(e) { if (e.key === 'Escape') { d.remove(); document.removeEventListener('keydown', k); } });
    });
  }
  const nav = document.querySelector('header.tesr nav'); if (!nav) return;
  const esc = (s) => s.replace(/&/g, '&amp;');
  nav.className = 'steps-nav';
  nav.innerHTML = STEPS.map(([href, n, label, pages], i) =>
    `${i ? '<span class="sep" aria-hidden="true">›</span>' : ''}<a href="./${href}" class="${pages.includes(here) ? 'active' : ''}"><i>${n}</i>${esc(label)}</a>`).join('')
    + `<a href="./guide.html" class="guide ${here === 'guide.html' ? 'active' : ''}">📘 คู่มือ</a>`;
})();
