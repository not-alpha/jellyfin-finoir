/* ==========================================================================
   Finoir — home hero for Jellyfin 12.2 (web client, Modern layout)
   https://github.com/not-alpha/jellyfin-finoir

   Shows a rotating banner at the top of the home page. If the library has a
   collection or playlist called "Featured", its films and shows are used;
   otherwise the newest ones. Only items with a backdrop, a logo and a
   synopsis are shown. Styling lives in css/theme.css (section 10); without
   that CSS this script shows nothing useful.

   Load it with the JavaScript Injector plugin. Rollback: switch the script
   off in the plugin and reload the page.

   What it asks the server for: up to three small item lists per page load
   (the "Featured" lookup, its items and the newest items), then one logo per
   slide and one backdrop for the current and the next slide.
   ========================================================================== */
(function () {
  'use strict';

  if (window.__homeHeroLoaded) {
    return;
  }
  window.__homeHeroLoaded = true;

  /* Settings */
  var SLIDE_COUNT = 6;          /* slides shown */
  var POOL_SIZE = 40;           /* newest items looked at to find them */
  var INTERVAL_MS = 9000;       /* time per slide */
  var LABEL = 'Just added';     /* line under the logo for the newest items */
  var FEATURED_NAME = 'Featured';   /* collection or playlist to use; '' = off */
  var FEATURED_LABEL = 'Featured';  /* line under the logo for those items */
  var FIELDS = 'Overview,Genres,CommunityRating,CriticRating,OfficialRating,' +
    'ProductionYear,ChildCount,RunTimeTicks';

  var REVEAL_WAIT_MS = 1200;    /* longest wait for the first backdrop before showing */

  var itemsPromise = null;
  var noItems = false;          /* the server answered and nothing was usable */
  var timer = null;

  function escapeHtml(text) {
    return String(text).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function imageUrl(item, type, width) {
    var tag = type === 'Backdrop' ? item.BackdropImageTags[0] : item.ImageTags.Logo;
    return window.ApiClient.getScaledImageUrl(item.Id, { type: type, maxWidth: width, quality: 80, tag: tag });
  }

  /* "2 seasons" for a show, "1h 58m" for a film */
  function lengthText(item) {
    if (item.Type === 'Series') {
      if (!item.ChildCount) {
        return '';
      }
      return item.ChildCount + (item.ChildCount === 1 ? ' season' : ' seasons');
    }
    var minutes = Math.round((item.RunTimeTicks || 0) / 600000000);
    if (!minutes) {
      return '';
    }
    var hours = Math.floor(minutes / 60);
    return (hours ? hours + 'h ' : '') + (minutes % 60) + 'm';
  }

  function usable(item) {
    return (item.Type === 'Movie' || item.Type === 'Series') &&
      item.BackdropImageTags && item.BackdropImageTags.length &&
      item.ImageTags && item.ImageTags.Logo && item.Overview;
  }

  function loadNewest(api, userId) {
    return api.getItems(userId, {
      IncludeItemTypes: 'Movie,Series',
      Recursive: true,
      SortBy: 'DateCreated',
      SortOrder: 'Descending',
      Limit: POOL_SIZE,
      Fields: FIELDS,
      EnableImageTypes: 'Backdrop,Logo',
      ImageTypeLimit: 1
    }).then(function (result) {
      return { label: LABEL, items: (result.Items || []).filter(usable).slice(0, SLIDE_COUNT) };
    });
  }

  /* Resolves to null when there is no usable "Featured" collection or playlist */
  function loadFeatured(api, userId) {
    if (!FEATURED_NAME) {
      return Promise.resolve(null);
    }
    return api.getItems(userId, {
      IncludeItemTypes: 'BoxSet,Playlist',
      Recursive: true,
      SearchTerm: FEATURED_NAME,
      Limit: 20
    }).then(function (result) {
      var list = (result.Items || []).filter(function (item) {
        return (item.Name || '').toLowerCase() === FEATURED_NAME.toLowerCase();
      })[0];
      if (!list) {
        return null;
      }
      var query = { UserId: userId, Fields: FIELDS, EnableImageTypes: 'Backdrop,Logo', ImageTypeLimit: 1 };
      var request;
      if (list.Type === 'Playlist') {
        request = api.getJSON(api.getUrl('Playlists/' + list.Id + '/Items', query));
      } else {
        query.ParentId = list.Id;
        request = api.getItems(userId, query);
      }
      return request.then(function (children) {
        var items = (children.Items || []).filter(usable).slice(0, SLIDE_COUNT);
        return items.length ? { label: FEATURED_LABEL, items: items } : null;
      });
    }).catch(function () {
      return null;
    });
  }

  /* Both lists are asked for at the same time; "Featured" wins when it exists */
  function loadItems() {
    if (!itemsPromise) {
      var api = window.ApiClient;
      var userId = api.getCurrentUserId();
      itemsPromise = Promise.all([loadFeatured(api, userId), loadNewest(api, userId)]).then(function (lists) {
        var result = lists[0] || lists[1];
        noItems = !result.items.length;
        return result;
      }).catch(function () {
        itemsPromise = null;
        return { label: LABEL, items: [] };
      });
    }
    return itemsPromise;
  }

  function slideHtml(item, index, label) {
    var facts = '';
    if (item.CommunityRating) {
      facts += '<span class="homeHero-score">&#9733; ' + item.CommunityRating.toFixed(1) + '</span>';
    }
    if (item.CriticRating || item.CriticRating === 0) {
      facts += '<span class="homeHero-score">&#127813; ' + Math.round(item.CriticRating) + '%</span>';
    }
    if (item.OfficialRating) {
      facts += '<span class="homeHero-age">' + escapeHtml(item.OfficialRating) + '</span>';
    }
    if (item.ProductionYear) {
      facts += '<span>' + item.ProductionYear + '</span>';
    }
    if (lengthText(item)) {
      facts += '<span>' + lengthText(item) + '</span>';
    }
    if (item.Genres && item.Genres.length) {
      facts += '<span>' + escapeHtml(item.Genres.slice(0, 2).join(', ')) + '</span>';
    }

    return '<div class="homeHero-slide' + (index === 0 ? ' is-active' : '') + '" data-index="' + index + '">' +
      '<div class="homeHero-backdrop"></div>' +
      '<div class="homeHero-body">' +
      '<img class="homeHero-logo" alt="' + escapeHtml(item.Name) + '" src="' + imageUrl(item, 'Logo', 700) + '">' +
      '<div class="homeHero-label">' + escapeHtml(label) + '</div>' +
      '<div class="homeHero-facts">' + facts + '</div>' +
      '<p class="homeHero-plot">' + escapeHtml(item.Overview) + '</p>' +
      '<div class="homeHero-actions">' +
      '<button type="button" class="homeHero-button homeHero-play" data-hero-action="play">' +
      '<span class="material-icons play_arrow" aria-hidden="true"></span>Watch now</button>' +
      '<button type="button" class="homeHero-button" data-hero-action="info" aria-label="More info">' +
      '<span class="material-icons info_outline" aria-hidden="true"></span></button>' +
      '</div></div></div>';
  }

  function openDetails(item) {
    window.location.hash = '#/details?id=' + item.Id + '&serverId=' + window.ApiClient.serverId();
  }

  /* Starts playback through Jellyfin's own card handler: a hidden stand-in
     card is put into one of the home rows, clicked and removed again. If the
     home page has no rows, the detail page opens instead. */
  function play(item, page) {
    var row = page.querySelector('.itemsContainer[is="emby-itemscontainer"]');
    if (!row) {
      openDetails(item);
      return;
    }
    var card = document.createElement('div');
    card.className = 'card';
    card.hidden = true;
    card.setAttribute('data-id', item.Id);
    card.setAttribute('data-serverid', window.ApiClient.serverId());
    card.setAttribute('data-type', item.Type);
    card.setAttribute('data-mediatype', 'Video');
    card.setAttribute('data-isfolder', item.Type === 'Series' ? 'true' : 'false');
    card.innerHTML = '<button type="button" class="itemAction" data-action="resume"></button>';
    row.appendChild(card);
    card.firstChild.click();
    row.removeChild(card);
  }

  /* Fills the placeholder put in by mount() and fades it in */
  function build(hero, items, page, label) {
    hero.setAttribute('aria-roledescription', 'carousel');
    hero.setAttribute('aria-label', label);

    var html = items.map(function (item, index) {
      return slideHtml(item, index, label);
    }).join('');
    if (items.length > 1) {
      html += '<button type="button" class="homeHero-arrow homeHero-prev" aria-label="Previous">' +
        '<span class="material-icons chevron_left" aria-hidden="true"></span></button>' +
        '<button type="button" class="homeHero-arrow homeHero-next" aria-label="Next">' +
        '<span class="material-icons chevron_right" aria-hidden="true"></span></button>' +
        '<div class="homeHero-dots">' + items.map(function (item, index) {
          return '<button type="button" class="homeHero-dot' + (index === 0 ? ' is-active' : '') +
            '" data-index="' + index + '" aria-label="Show ' + escapeHtml(item.Name) + '"></button>';
        }).join('') + '</div>';
    }
    hero.innerHTML = html;

    var slides = Array.prototype.slice.call(hero.querySelectorAll('.homeHero-slide'));
    var dots = Array.prototype.slice.call(hero.querySelectorAll('.homeHero-dot'));
    var backdropWidth = window.innerWidth > 1280 ? 1920 : 1280;
    var current = 0;

    function loadBackdrop(index) {
      var backdrop = slides[index].querySelector('.homeHero-backdrop');
      if (!backdrop.style.backgroundImage) {
        backdrop.style.backgroundImage = 'url("' + imageUrl(items[index], 'Backdrop', backdropWidth) + '")';
      }
    }

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle('is-active', i === current);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === current);
      });
      loadBackdrop(current);
      loadBackdrop((current + 1) % slides.length);
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
      timer = window.setInterval(function () {
        if (!hero.isConnected) {
          stop();
          return;
        }
        /* Do not rotate in a background tab, behind the player or off screen */
        if (document.hidden || !hero.offsetParent || document.querySelector('.videoPlayerContainer')) {
          return;
        }
        show(current + 1);
      }, INTERVAL_MS);
    }

    hero.addEventListener('click', function (event) {
      var target = event.target.closest('button');
      if (!target) {
        return;
      }
      if (target.classList.contains('homeHero-prev')) {
        show(current - 1);
      } else if (target.classList.contains('homeHero-next')) {
        show(current + 1);
      } else if (target.classList.contains('homeHero-dot')) {
        show(Number(target.getAttribute('data-index')));
      } else if (target.getAttribute('data-hero-action') === 'play') {
        play(items[current], page);
      } else if (target.getAttribute('data-hero-action') === 'info') {
        openDetails(items[current]);
      }
    });

    hero.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        show(current - 1);
      } else if (event.key === 'ArrowRight') {
        show(current + 1);
      }
    });

    hero.addEventListener('mouseenter', stop);
    hero.addEventListener('mouseleave', start);
    hero.addEventListener('focusin', stop);
    hero.addEventListener('focusout', start);

    show(0);
    start();

    /* Fade in once the first backdrop has arrived, or after a short wait */
    var revealed = false;
    function reveal() {
      if (!revealed) {
        revealed = true;
        hero.classList.remove('is-loading');
      }
    }
    var first = new Image();
    first.onload = reveal;
    first.onerror = reveal;
    first.src = imageUrl(items[0], 'Backdrop', backdropWidth);
    window.setTimeout(reveal, REVEAL_WAIT_MS);
  }

  function signedIn() {
    var api = window.ApiClient;
    return !!(api && api.getCurrentUserId());
  }

  /* Puts the hero above the home rows: first an empty block of the final
     size, so the rows never move, then the slides once the server has
     answered. Returns true once nothing is left to do. */
  function mount() {
    if (noItems) {
      return true;
    }
    /* Ask the server early, while Jellyfin is still building the home page */
    if (signedIn() && /^#\/home/.test(window.location.hash)) {
      loadItems();
    }
    var page = document.querySelector('#indexPage:not(.hide)');
    if (!page) {
      return false;
    }
    if (page.querySelector('#homeHero')) {
      return true;
    }
    var rows = page.querySelector('.homeSectionsContainer');
    if (!rows || !signedIn()) {
      return false;
    }
    var hero = document.createElement('section');
    hero.id = 'homeHero';
    hero.className = 'homeHero is-loading';
    rows.parentElement.insertBefore(hero, rows);
    loadItems().then(function (result) {
      if (!hero.isConnected) {
        return;
      }
      if (!result.items.length) {
        hero.remove();
        return;
      }
      build(hero, result.items, page, result.label);
    });
    return true;
  }

  /* The home page is built after this script runs and rebuilt when coming
     back to it, so try for a few seconds after every page change. */
  function scheduleMount() {
    if (mount()) {
      return;
    }
    var tries = 0;
    var id = window.setInterval(function () {
      tries += 1;
      if (mount() || tries >= 100) {
        window.clearInterval(id);
      }
    }, 100);
  }

  window.addEventListener('hashchange', scheduleMount);
  document.addEventListener('viewshow', scheduleMount);
  scheduleMount();
})();
