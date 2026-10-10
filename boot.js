// Runs before everything else. It is a separate file (not inline) so that hosts with a strict
// Content-Security-Policy accept it.
//  1. If something breaks before the game starts, say so instead of leaving a black page.
//  2. Phones and tablets get a notice: the game needs a keyboard and a mouse.
(function () {
  window.addEventListener('error', function (e) {
    var boot = document.getElementById('boot');
    if (!boot) return; // the game has already started
    boot.className = 'failed';
    boot.textContent =
      'Не удалось запустить игру / The game failed to start (' + (e.message || 'error') + '). ' +
      'Обнови страницу / Reload the page.';
  });

  var coarseOnly =
    window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
  if (!coarseOnly) return;
  var notice = document.getElementById('touch-notice');
  notice.style.display = 'flex';
  document.getElementById('touch-ok').addEventListener('click', function () {
    notice.style.display = 'none';
  });
})();
