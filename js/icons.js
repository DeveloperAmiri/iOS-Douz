/**
 * iOS-Douz — hand-made icon set
 * ---------------------------------------------------------------------------
 * Every icon is drawn from scratch as an inline SVG in the SF Symbols
 * language: a 24x24 viewBox, a single uniform 1.75 stroke, rounded caps and
 * joins, no filled shapes. Icons inherit `currentColor`, so a single CSS
 * colour change recolours an icon in every theme.
 *
 * Usage: `<span data-icon="moon"></span>` — js/ui.js expands these on boot.
 */
(function (global) {
  'use strict';

  /** Shared presentation attributes for the whole set. */
  var OPEN =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" ' +
    'stroke-linejoin="round" role="img" focusable="false">';

  var CLOSE = '</svg>';

  var ICONS = {
    /** Crescent moon — dark appearance. */
    moon: OPEN + '<path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z"/>' + CLOSE,

    /** Sun with eight rays — light appearance. */
    sun: OPEN +
      '<circle cx="12" cy="12" r="4"/>' +
      '<path d="M12 2.6v2.2M12 19.2v2.2M4.4 12H2.2M21.8 12h-2.2"/>' +
      '<path d="M6.7 6.7 5.1 5.1M18.9 18.9l-1.6-1.6M17.3 6.7l1.6-1.6M5.1 18.9l1.6-1.6"/>' +
      CLOSE,

    /** Counter-clockwise arrow — new game / refresh. */
    refresh: OPEN +
      '<path d="M4.6 11.4a7.4 7.4 0 1 1 2.3 6.1"/>' +
      '<path d="M4.2 5.6v5.4h5.4"/>' +
      CLOSE,

    /** Gear — settings. */
    gear: OPEN +
      '<circle cx="12" cy="12" r="3.1"/>' +
      '<path d="M12 2.6v2.6M12 18.8v2.6M21.4 12h-2.6M5.2 12H2.6"/>' +
      '<path d="M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8M18.6 18.6l-1.8-1.8M7.2 7.2 5.4 5.4"/>' +
      CLOSE,

    /** Info in a circle — about. */
    info: OPEN +
      '<circle cx="12" cy="12" r="9"/>' +
      '<path d="M12 11v5.4"/>' +
      '<path d="M12 7.7h.01"/>' +
      CLOSE,

    /** Multiplication sign — close. */
    xmark: OPEN + '<path d="M6.6 6.6 17.4 17.4M17.4 6.6 6.6 17.4"/>' + CLOSE,

    /** Chevron pointing back — used for "back" navigation in RTL-safe contexts. */
    back: OPEN + '<path d="M14.8 5.4 8.2 12l6.6 6.6"/>' + CLOSE,

    /** Speaker with waves — sound effects. */
    speaker: OPEN +
      '<path d="M11.4 5.4 7.6 8.6H4.8v6.8h2.8l3.8 3.2Z"/>' +
      '<path d="M15.2 9.4a3.6 3.6 0 0 1 0 5.2"/>' +
      '<path d="M17.8 7a7 7 0 0 1 0 10"/>' +
      CLOSE,

    /** Speaker with a slash — sound effects off. */
    speakerOff: OPEN +
      '<path d="M11.4 5.4 7.6 8.6H4.8v6.8h2.8l3.8 3.2Z"/>' +
      '<path d="M15.6 9.8l4.2 4.4M19.8 9.8l-4.2 4.4"/>' +
      CLOSE,

    /** Waveform — haptic feedback. */
    haptics: OPEN +
      '<path d="M4.2 10.2v3.6M7.4 7.6v8.8M10.6 4.8v14.4M13.8 8.4v7.2M17 10.6v2.8M20.2 11.4v1.2"/>' +
      CLOSE,

    /** Eraser — reset scores. */
    eraser: OPEN +
      '<path d="M8.6 19.4 4.4 15.2a1.7 1.7 0 0 1 0-2.4l7-7a1.7 1.7 0 0 1 2.4 0l4.8 4.8a1.7 1.7 0 0 1 0 2.4l-6.2 6.2Z"/>' +
      '<path d="M9.4 8.6l6 6"/>' +
      '<path d="M12.8 19.4H20"/>' +
      CLOSE,

    /** Player X mark (same stroke language as the icons). */
    xMark: OPEN + '<path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/>' + CLOSE,

    /** Player O mark. */
    oMark: OPEN + '<circle cx="12" cy="12" r="6"/>' + CLOSE,

    /** Equals sign — draw. */
    drawMark: OPEN + '<path d="M6 9.2h12M6 14.8h12"/>' + CLOSE
  };

  global.Icons = {
    /** All icon names, handy for tests and documentation. */
    names: Object.keys(ICONS),

    /** Return the SVG markup for `name`, or an empty string when unknown. */
    get: function (name) {
      return Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : '';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
