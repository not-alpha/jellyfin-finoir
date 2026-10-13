/* ==========================================================================
   Finoir — current library marker for Jellyfin 12.2 (web client, Modern layout)
   https://github.com/not-alpha/jellyfin-finoir

   Marks the navigation bar link of the library you are in (Movies, TV Shows,
   Collections, Favorites), which Jellyfin itself does not do. Styling lives
   in css/theme.css (section 12). Load this with the JavaScript Injector
   plugin; to remove it, switch the script off there and reload the page.

   It asks the server for nothing.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__finoirNavLoaded) {
    return;
  }
  window.__finoirNavLoaded = true;

  function pathOf(address) {
    return (address || '').split('?')[0];
  }

  function tabOf(address) {
    return new URLSearchParams((address || '').split('?')[1] || '').get('tab') || '0';
  }

  /* Returns true once the bar's links exist and have been marked */
  function update() {
    var links = document.querySelectorAll('.MuiAppBar-root .MuiToolbar-root a.MuiButton-root');
    if (!links.length) {
      return false;
    }
    var here = window.location.hash;
    Array.prototype.forEach.call(links, function (link) {
      var target = link.getAttribute('href') || '';
      var path = pathOf(target);
      var current;
      if (path === '#/' || path === '') {
        current = false;                       /* the logo */
      } else if (path === '#/home') {
        current = pathOf(here) === '#/home' && tabOf(here) === tabOf(target);
      } else {
        current = pathOf(here) === path;
      }
      link.classList.toggle('finoir-current', current);
      if (current) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    return true;
  }

  /* The bar can be redrawn after the address changes, so repeat for a few
     seconds */
  function schedule() {
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      update();
      if (tries >= 20) {
        window.clearInterval(timer);
      }
    }, 300);
  }

  window.addEventListener('hashchange', schedule);
  document.addEventListener('viewshow', schedule);
  schedule();
})();
