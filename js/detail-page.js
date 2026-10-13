/* ==========================================================================
   Finoir — detail page extras for Jellyfin 12.2 (web client, Modern layout)
   https://github.com/not-alpha/jellyfin-finoir

   Three small touches on film, series, season and episode pages:
   1. Series pages show the number of seasons in the facts line.
   2. When an item has a logo, the text title that repeats it is hidden
      (it stays in the page for screen readers).
   3. On series pages the Play button names the episode it will start,
      for example "Play S1 E3".

   Each one can be switched off below. Styling lives in css/theme.css
   (section 12). Load this with the JavaScript Injector plugin; to remove it,
   switch the script off there and reload the page.

   What it asks the server for: the item's details once per page, plus the
   episode list on series pages (for the Play label).
   ========================================================================== */
(function () {
  'use strict';

  if (window.__finoirDetailLoaded) {
    return;
  }
  window.__finoirDetailLoaded = true;

  /* Settings */
  var SHOW_SEASON_COUNT = true;
  var HIDE_TITLE_WITH_LOGO = true;
  var LABEL_NEXT_EPISODE = true;

  var loaded = { id: null, promise: null };

  /* The item id from an address like #/details?id=...&serverId=... */
  function currentId() {
    var hash = window.location.hash;
    if (hash.indexOf('#/details') !== 0) {
      return null;
    }
    return new URLSearchParams(hash.split('?')[1] || '').get('id');
  }

  /* First episode that is not marked played: the one Jellyfin starts when
     Play is pressed on a series. */
  function nextEpisode(api, userId, seriesId) {
    return api.getJSON(api.getUrl('Shows/' + seriesId + '/Episodes', {
      UserId: userId,
      EnableImages: false,
      EnableUserData: true,
      Fields: ''
    })).then(function (result) {
      var next = null;
      (result.Items || []).some(function (episode) {
        if (!(episode.UserData && episode.UserData.Played)) {
          next = episode;
          return true;
        }
        return false;
      });
      return next;
    }).catch(function () {
      return null;
    });
  }

  function load(id) {
    if (loaded.id !== id) {
      var api = window.ApiClient;
      var userId = api.getCurrentUserId();
      loaded.id = id;
      loaded.promise = api.getItem(userId, id).then(function (item) {
        if (item.Type !== 'Series' || !LABEL_NEXT_EPISODE) {
          return { item: item, next: null };
        }
        return nextEpisode(api, userId, id).then(function (next) {
          return { item: item, next: next };
        });
      }).catch(function () {
        loaded.id = null;
        return null;
      });
    }
    return loaded.promise;
  }

  /* Returns true once the page shows this item and the touches are applied */
  function apply(data) {
    var item = data.item;
    var page = document.querySelector('#itemDetailPage:not(.hide)');
    var names = page && page.querySelector('.nameContainer');
    var firstName = names && names.firstElementChild;
    if (!firstName) {
      return false;
    }
    /* Jellyfin reuses this page between items; wait until it shows this one */
    var expected = item.SeriesName || item.Name || '';
    if (firstName.textContent.trim() !== expected) {
      return false;
    }

    if (SHOW_SEASON_COUNT && item.Type === 'Series' && item.ChildCount) {
      var facts = page.querySelector('.itemMiscInfo-primary');
      if (facts && !facts.querySelector('.finoir-seasons')) {
        var count = document.createElement('div');
        count.className = 'mediaInfoItem finoir-seasons';
        count.textContent = item.ChildCount + (item.ChildCount === 1 ? ' season' : ' seasons');
        if (facts.firstElementChild) {
          facts.insertBefore(count, facts.firstElementChild.nextSibling);
        } else {
          facts.appendChild(count);
        }
      }
    }

    if (HIDE_TITLE_WITH_LOGO) {
      var logo = page.querySelector('.detailLogo');
      var hasLogo = !!((item.ImageTags && item.ImageTags.Logo) || item.ParentLogoImageTag);
      var logoShown = !!logo && !logo.classList.contains('hide') &&
        window.getComputedStyle(logo).display !== 'none';
      firstName.classList.toggle('finoir-visually-hidden', hasLogo && logoShown);
    }

    var play = page.querySelector('.mainDetailButtons .btnPlay');
    if (play) {
      var next = data.next;
      if (next && next.IndexNumber != null && !play.classList.contains('hide')) {
        var code = (next.ParentIndexNumber != null ? 'S' + next.ParentIndexNumber + ' ' : '') +
          'E' + next.IndexNumber;
        play.setAttribute('data-finoir-label', (play.getAttribute('title') || 'Play') + ' ' + code);
      } else {
        play.removeAttribute('data-finoir-label');
      }
    }
    return true;
  }

  /* The page is filled in after the address changes and can be redrawn a
     moment later, so keep applying for a few seconds after each change. */
  function schedule() {
    var id = currentId();
    if (!id || !window.ApiClient || !window.ApiClient.getCurrentUserId()) {
      return;
    }
    loaded.id = null;
    var tries = 0;
    var successes = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (currentId() !== id || tries > 30 || successes > 8) {
        window.clearInterval(timer);
        return;
      }
      load(id).then(function (data) {
        if (data && currentId() === id && apply(data)) {
          successes += 1;
        }
      });
    }, 400);
  }

  window.addEventListener('hashchange', schedule);
  document.addEventListener('viewshow', schedule);
  schedule();
})();
