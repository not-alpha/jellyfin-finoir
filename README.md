# Finoir

A dark, cinematic theme for the Jellyfin web client: a large hero banner that
drops straight into rows of content, quiet colours, and calm motion.

Built for **Jellyfin 12.2**, **Modern layout**, **Dark** theme. It uses only
supported extension points: the Custom CSS box and one script loaded through a
plugin. No Jellyfin files are edited.

## What it changes

- **Colours.** Blue-black background, near-white text and buttons, a single
  violet accent used only for keyboard focus, the watched tick and markers.
- **Navigation bar.** Transparent at the top of a page, flat once scrolled;
  larger library links; no server name beside the logo.
- **Home.** A rotating hero banner with the newest films and shows (logo,
  score, age rating, year, length, genres, synopsis, *Watch now* and an info
  button), then tighter rows with bolder titles.
- **Cards.** Rounded corners, a faint border that brightens on hover, a slight
  lift. Continue Watching and Next Up cards play on click.
- **Detail pages.** Full-width backdrop with logo, facts and a labelled Play
  button at the bottom left; the large poster is hidden.
- **Seasons.** Episodes shown as a grid of cards instead of a tall list.

## Install

### 1. The theme (CSS)

1. Open `css/theme.css` and copy all of it.
2. In Jellyfin go to **Dashboard → Branding → Custom CSS code**, paste, and
   save.
3. Reload the page with a hard refresh (Cmd/Ctrl + Shift + R).

This is enough for everything except the hero banner.

### 2. The hero banner (optional, JavaScript)

The banner needs item data, which CSS cannot fetch, so it is a small script.

1. Install the **JavaScript Injector** plugin
   ([n00bcodr/Jellyfin-JavaScript-Injector](https://github.com/n00bcodr/Jellyfin-JavaScript-Injector))
   and restart Jellyfin.
2. Open **Dashboard → JS Injector**, add a script, and paste the contents of
   `js/home-hero.js`. Enable it and tick the option to run it only for
   signed-in users.
3. Hard-refresh the page.

The script asks the server for one list of items per page load, then one logo
per slide and one backdrop for the current and next slide. It loads nothing
from outside your server.

## Make it yours

Every colour, size and timing is a variable in the first block of
`css/theme.css` (section 1, "Tokens"). Change the look there; the rest of the
file only refers to those names. A few examples:

| Token | What it controls |
|---|---|
| `--bg`, `--surface`, `--text` | Base colours |
| `--accent` | Focus ring, watched tick |
| `--radius-card` | Corner radius of cards and buttons |
| `--hover-lift`, `--motion-card` | How far and how fast cards lift |
| `--nav-size`, `--nav-gap` | Navigation link size and spacing |

Settings for the hero (number of slides, time per slide, the "Just added"
label) are at the top of `js/home-hero.js`.

## Good to know

- The colours are scoped to Jellyfin's **Dark** theme. Choosing another theme
  under Settings → Display switches them off for that user.
- Jellyfin does not apply custom CSS to the admin dashboard, so that keeps its
  stock look.
- The detail-page layout and episode cards apply on desktop widths only;
  narrow screens keep Jellyfin's own layout.
- Hidden on purpose: Trailer and Shuffle on detail pages, the favourite button
  and "Ends at" on episode cards, and the SyncPlay and Cast buttons in the
  navigation bar. Each is a single clearly commented rule you can delete.
- The theme relies on Jellyfin's class names, which can change between
  releases. After a Jellyfin update, check the home page, a detail page, a
  season page and playback.

## Remove

- Theme: clear **Dashboard → Branding → Custom CSS code** and save.
- Hero: switch the script off in **Dashboard → JS Injector**, or uninstall the
  plugin.

## Licence

MIT. See [LICENSE](LICENSE).
