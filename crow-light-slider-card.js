/**
 * Crow Light Slider Card
 * A liquid-glass light card for Home Assistant in an iOS 27-style design: drag sideways anywhere
 * on the card to dim, tap the icon to switch, and tap the card for the level, history and details.
 * Pill, tile or square layouts, the fill and icon take the light's own colour, light / dark / auto
 * theming with a glass-opacity slider, and your own Home Assistant icon — chosen from HA's own icon
 * picker in the visual editor.
 */

(() => {
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ═══════════════════════════════════════════════════════════════════
//  THEME + STATE COLOURS
// ═══════════════════════════════════════════════════════════════════

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(a * 100) / 100})`;
}

// ═══════════════════════════════════════════════════════════════════
//  COLOUR MATH — keeps any user-picked colour legible in light AND dark
// ═══════════════════════════════════════════════════════════════════

function _hex2rgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}
function _rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function _hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return _rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function _lum(hex) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = _hex2rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function _contrast(a, b) {
  const la = _lum(a), lb = _lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function _mix(fg, bg, a) {
  const f = _hex2rgb(fg), b = _hex2rgb(bg);
  return _rgb2hex(f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a));
}
function isHex(v) { return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()); }

// Approximate surfaces the card sits on (glass over a typical HA dashboard).
const SURFACE = { dark: '#34343a', light: '#f6f6f9' };
const INK     = { dark: '#ffffff', light: '#1c1c1e' };

// Nudge lightness (keeping hue + saturation) until `min` contrast is met.
function _ensure(h, s, l, bg, min, dir) {
  let hex = _hsl2hex(h, s, l);
  for (let i = 0; i < 60 && _contrast(hex, bg) < min; i++) {
    l = Math.min(0.97, Math.max(0.03, l + dir * 0.015));
    hex = _hsl2hex(h, s, l);
  }
  return hex;
}

const _tuneCache = {};
// One user-picked colour → { c1, c2, dot, text } that reads in this mode.
//   c1/c2 : ring + bar gradient (graphics, ≥3:1 on the surface)
//   dot   : status dot / glow
//   text  : status text (≥4.5:1 on the surface)
function tuneColor(base, dark) {
  const key = `${base}|${dark}`;
  if (_tuneCache[key]) return _tuneCache[key];
  const [h, s0, l0] = _rgb2hsl(..._hex2rgb(base));
  const bg = dark ? SURFACE.dark : SURFACE.light;
  const s = s0;
  let out;
  if (dark) {
    const l = Math.min(0.72, Math.max(0.52, l0));
    out = {
      c1:  _ensure(h, s, Math.min(0.86, l + 0.10), bg, 3, +1),
      c2:  _ensure(h, s, l - 0.06, bg, 3, +1),
      dot: _ensure(h, s, l, bg, 3, +1),
      text: _ensure(h, s, Math.min(0.85, l + 0.12), bg, 4.5, +1),
    };
  } else {
    const l = Math.min(0.56, Math.max(0.36, l0));
    out = {
      c1:  _ensure(h, s, Math.min(0.66, l + 0.10), bg, 2.4, -1),
      c2:  _ensure(h, s, l - 0.08, bg, 3.2, -1),
      dot: _ensure(h, s, l, bg, 3, -1),
      text: _ensure(h, s, Math.min(l, 0.34), bg, 4.5, -1),
    };
  }
  return (_tuneCache[key] = out);
}

// Tile fill: pick the strongest alpha at which the ink (white in dark, near-black
// in light) still reads ≥4.5:1 on the tinted area.
const _fillCache = {};
function fillTint(pal, dark) {
  const key = `${pal.c1}|${pal.c2}|${dark}`;
  if (_fillCache[key]) return _fillCache[key];
  const bg = SURFACE[dark ? 'dark' : 'light'], ink = INK[dark ? 'dark' : 'light'];
  const maxA = dark ? 0.70 : 0.90;
  const solve = c => {
    let a = maxA;
    while (a > 0.18 && _contrast(_mix(c, bg, a), ink) < 4.5) a -= 0.02;
    return a;
  };
  const a = Math.min(solve(pal.c1), solve(pal.c2));
  return (_fillCache[key] = { a1: a, a2: a });
}

const NEUTRAL_COLORS = {
  dark:  { c1: '#EBEBF5', c2: '#98989F', dot: '#8E8E93', text: 'rgba(255,255,255,0.72)' },
  light: { c1: '#8E8E93', c2: '#636366', dot: '#8E8E93', text: 'rgba(60,60,67,0.72)' },
};

// Card-level theme tokens. `a` is the 0–1 glass slider (0 = clear, 1 = frosted).
function themeTokens(dark, a) {
  const f = n => n.toFixed(3);
  return dark ? {
    '--ls-ink': '#ffffff', '--ls-ink2': 'rgba(255,255,255,0.72)',
    '--ls-glass1': `rgba(255,255,255,${f(0.10 + a * 0.16)})`,
    '--ls-glass2': `rgba(255,255,255,${f(0.03 + a * 0.08)})`,
    '--ls-edge': 'rgba(255,255,255,0.26)', '--ls-hi': 'rgba(255,255,255,0.42)', '--ls-lo': 'rgba(255,255,255,0.07)',
    '--ls-shadow': '0 14px 36px rgba(0,0,0,0.32)',
    '--ls-chip': 'rgba(255,255,255,0.13)', '--ls-chipedge': 'rgba(255,255,255,0.20)',
    '--ls-track': 'rgba(255,255,255,0.16)', '--ls-tshadow': '0 1px 10px rgba(0,0,0,0.35)',
    '--ls-danger-bg': 'rgba(255,69,58,0.32)', '--ls-danger-ink': '#ffffff',
  } : {
    '--ls-ink': '#1c1c1e', '--ls-ink2': 'rgba(60,60,67,0.72)',
    '--ls-glass1': `rgba(255,255,255,${f(0.50 + a * 0.32)})`,
    '--ls-glass2': `rgba(255,255,255,${f(0.34 + a * 0.30)})`,
    '--ls-edge': 'rgba(255,255,255,0.85)', '--ls-hi': 'rgba(255,255,255,0.95)', '--ls-lo': 'rgba(0,0,0,0.04)',
    '--ls-shadow': '0 10px 30px rgba(28,36,80,0.14), 0 0 0 0.5px rgba(0,0,0,0.05)',
    '--ls-chip': 'rgba(120,120,128,0.12)', '--ls-chipedge': 'rgba(120,120,128,0.10)',
    '--ls-track': 'rgba(120,120,128,0.20)', '--ls-tshadow': 'none',
    '--ls-danger-bg': 'rgba(255,59,48,0.14)', '--ls-danger-ink': '#C4271C',
  };
}

const EDITOR_STYLES = `
  .container {
    display: flex; flex-direction: column; gap: 20px;
    padding: 12px;
    color: var(--primary-text-color);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .section-title {
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: #888; margin-bottom: 2px;
  }
  .card-block {
    background: var(--card-background-color);
    border: 1px solid rgba(128,128,128,0.15);
    border-radius: 12px; overflow: hidden;
  }
  .text-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
  .text-row label { font-size: 14px; font-weight: 500; }
  .text-row .hint { font-size: 11px; color: #888; margin-top: -2px; }

  .select-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
  .select-row label { font-size: 14px; font-weight: 500; }
  .select-row .hint { font-size: 11px; color: #888; margin-top: -2px; }
  .select-row + .select-row { border-top: 1px solid rgba(128,128,128,0.10); }

  input[type="text"], input[type="number"] {
    width: 100%; box-sizing: border-box;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    border: 1px solid rgba(128,128,128,0.20);
    border-radius: 8px; padding: 10px 12px; font-size: 14px;
    font-family: inherit;
  }
  input[type="text"]:focus, input[type="number"]:focus { outline: none; border-color: #007AFF; }

  .entity-search {
    padding: 7px 12px !important; font-size: 12px !important;
    background: rgba(128,128,128,0.06) !important;
  }

  select {
    width: 100%;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    border: 1px solid rgba(128,128,128,0.20);
    border-radius: 8px; padding: 10px 12px; font-size: 14px;
    cursor: pointer; -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    padding-right: 32px;
  }
  select:focus { outline: none; border-color: #007AFF; }
  select option { background: var(--card-background-color); }

  .toggle-list { display: flex; flex-direction: column; }
  .toggle-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid rgba(128,128,128,0.08);
    min-height: 52px;
  }
  .toggle-item:last-child { border-bottom: none; }
  .toggle-label { font-size: 14px; font-weight: 500; flex: 1; padding-right: 12px; }
  .toggle-desc  { font-size: 11px; color: #888; margin-top: 2px; }

  /* iOS-style toggle */
  .toggle-switch { position: relative; width: 51px; height: 31px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle-track {
    position: absolute; inset: 0; border-radius: 31px;
    background: rgba(120,120,128,0.32); cursor: pointer;
    transition: background 0.25s ease;
  }
  .toggle-track::after {
    content: ''; position: absolute;
    width: 27px; height: 27px; border-radius: 50%;
    background: #fff; top: 2px; left: 2px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: transform 0.25s ease;
  }
  .toggle-switch input:checked + .toggle-track { background: #34C759; }
  .toggle-switch input:checked + .toggle-track::after { transform: translateX(20px); }

  .badge-optional {
    display: inline-block;
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(128,128,128,0.12); color: #888;
    border: 1px solid rgba(128,128,128,0.25);
    border-radius: 4px; padding: 1px 5px;
    margin-left: 6px; vertical-align: middle;
  }
  .layout-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px;
  }
  .layout-opt {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 10px 8px 9px; border-radius: 14px; cursor: pointer;
    background: rgba(128,128,128,0.06); color: var(--primary-text-color);
    border: 2px solid transparent; font-family: inherit;
    transition: border-color .15s, background .15s, transform .1s;
  }
  .layout-opt:active { transform: scale(0.97); }
  .layout-opt svg { width: 100%; max-width: 132px; height: auto; display: block; }
  .layout-opt .lo-name { font-size: 13px; font-weight: 600; }
  .layout-opt .lo-sub  { font-size: 11px; color: #888; margin-top: -4px; }
  .layout-opt.is-selected { border-color: #007AFF; background: rgba(0,122,255,0.08); }

  .seg {
    display: flex; padding: 2px; gap: 2px; border-radius: 10px;
    background: rgba(120,120,128,0.16);
  }
  .seg-btn {
    flex: 1; border: none; border-radius: 8px; padding: 8px 6px; cursor: pointer;
    background: transparent; color: var(--primary-text-color);
    font-family: inherit; font-size: 13px; font-weight: 600;
    transition: background .15s, box-shadow .15s;
  }
  .seg-btn.is-selected {
    background: var(--card-background-color, #fff);
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }
  .range-row { display: flex; align-items: center; gap: 10px; }
  .range-row span { font-size: 11px; color: #888; flex-shrink: 0; }
  input[type="range"] { flex: 1; accent-color: #007AFF; margin: 4px 0; }

  .preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .preset-opt {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; cursor: pointer;
    background: rgba(128,128,128,0.06); color: var(--primary-text-color);
    border: 2px solid transparent; font-family: inherit; font-size: 13px; font-weight: 600;
    transition: border-color .15s, background .15s;
  }
  .preset-opt.is-selected { border-color: #007AFF; background: rgba(0,122,255,0.08); }
  .preset-dots { display: inline-flex; }
  .preset-dots i { width: 14px; height: 14px; border-radius: 50%; margin-left: -4px; border: 1.5px solid var(--card-background-color, #fff); }
  .preset-dots i:first-child { margin-left: 0; }
  .select-row.color-row { flex-direction: row; align-items: center; gap: 10px; }
  .color-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .color-info label { font-size: 14px; font-weight: 500; }
  .color-info .hint { font-size: 11px; color: #888; margin: 0; }
  .color-prev { display: flex; gap: 4px; }
  .pv {
    width: 32px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; border: 1px solid rgba(128,128,128,0.25);
  }
  input[type="color"] {
    -webkit-appearance: none; appearance: none; width: 44px; height: 32px; padding: 0; flex-shrink: 0;
    border: 1px solid rgba(128,128,128,0.3); border-radius: 10px; background: none; cursor: pointer; overflow: hidden;
  }
  input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  input[type="color"]::-webkit-color-swatch { border: none; border-radius: 9px; }
  .reset-btn {
    border: none; background: none; color: #007AFF; font-family: inherit; font-size: 13px; font-weight: 600;
    cursor: pointer; padding: 8px 2px; flex-shrink: 0;
  }


  .badge-required {
    display: inline-block;
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(0,122,255,0.15); color: #007AFF;
    border: 1px solid rgba(0,122,255,0.30);
    border-radius: 4px; padding: 1px 5px;
    margin-left: 6px; vertical-align: middle;
  }
`;

// ───────────────────────────────────────────────────────────────────
//  STYLES
// ───────────────────────────────────────────────────────────────────

// Size scale: 1 = Compact (default), 1.2 = Regular. Every dimension is multiplied by --ls-s.
const S = n => `calc(${n}px * var(--ls-s, 1))`;

const STYLES = `
  :host { display: block; }
  [hidden] { display: none !important; }

  /* ── Liquid-glass surface ─────────────────────────────────────────
     Every colour comes from CSS variables set by _applyTheme() (light / dark /
     glass opacity / size) and _update() (the light's colour and brightness). */
  ha-card {
    position: relative; overflow: hidden; box-sizing: border-box;
    color: var(--ls-ink, #fff);
    font-family: ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
    background: linear-gradient(160deg, var(--ls-glass1), var(--ls-glass2));
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
    border: 1px solid var(--ls-edge);
    border-radius: ${S(24)};
    box-shadow: var(--ls-rest);
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    touch-action: pan-y;            /* vertical swipes still scroll the page; sideways ones dim the light */
    cursor: pointer;
    transition: transform .12s ease, border-radius .35s cubic-bezier(.34,1.2,.64,1);
  }
  ha-card:active:not(.dragging) { transform: scale(0.985); }
  ha-card.no-tap { cursor: default; }
  ha-card.no-tap:active { transform: none; }
  ha-card.dragging { cursor: grabbing; }
  /* soft glow in the light's colour, so the card feels alive even on a flat dashboard */
  ha-card::before {
    content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(80% 55% at 88% -8%, var(--ls-glow, transparent), transparent 72%);
    transition: background .4s;
  }
  /* optional tint for the unlit part */
  .ls-tint { position: absolute; inset: 0; z-index: 0; pointer-events: none; background: var(--ls-off, transparent); }
  /* the brightness: fills from the left as far as the light is turned up */
  .ls-fill {
    position: absolute; top: 0; bottom: 0; left: 0; z-index: 0; pointer-events: none;
    width: var(--ls-pct, 0%);
    background: linear-gradient(90deg, var(--ls-fill1), var(--ls-fill2));
    box-shadow: 0 0 18px var(--ls-glow);
    transition: width .35s cubic-bezier(0.34,1,0.64,1);
  }
  ha-card.dragging .ls-fill { transition: none; }
  .ls-inner { position: relative; z-index: 1; pointer-events: none; }
  .ls-disc { pointer-events: auto; }

  /* ── Shared bits ─────────────────────────────────────────────── */
  .ls-name {
    font-size: var(--ls-fs); font-weight: 600; letter-spacing: -0.01em; line-height: 1.25;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
    color: var(--ls-name-color, var(--ls-ink));
  }
  .ls-disc {
    position: relative;
    width: ${S(36)}; height: ${S(36)}; border-radius: 50%; flex-shrink: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    background: var(--ls-chip); border: 1px solid var(--ls-chipedge);
    box-shadow: inset 0 1px 0 var(--ls-hi);
    color: var(--ls-text);
    cursor: pointer;
    transition: color .3s, background .35s, border-color .35s, box-shadow .35s, transform .12s;
  }
  .ls-disc::after { content: ''; position: absolute; inset: -6px; }   /* a generous tap area */
  .ls-disc:active { transform: scale(0.92); }
  /* while the light is on, the disc fills with its colour */
  ha-card.is-on .ls-disc {
    background: linear-gradient(160deg, var(--ls-fill1), var(--ls-fill2));
    border-color: var(--ls-dot);
    box-shadow: inset 0 1px 0 var(--ls-hi), 0 0 12px var(--ls-glowcol);
  }
  .ls-icon {
    --mdc-icon-size: ${S(19)}; width: ${S(19)}; height: ${S(19)}; display: flex; align-items: center; justify-content: center;
    color: var(--ls-icon-color, var(--ls-icon-auto, var(--ls-text)));
  }
  .ls-icon svg { width: 100%; height: 100%; display: block; }
  .ls-mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; text-align: var(--ls-align, left); filter: var(--ls-tfilter, none); }   /* keeps text legible over the lit part */
  .ls-state {
    font-size: calc(var(--ls-fs) * 0.86); font-weight: 500; line-height: 1.25;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    color: var(--ls-state-color, var(--ls-text)); font-variant-numeric: tabular-nums;
  }
  ha-card.is-on .ls-state { color: var(--ls-state-color, var(--ls-ink)); opacity: 0.82; }   /* over the lit part */
  .ls-empty { padding: ${S(14)}; font-size: ${S(13)}; color: var(--ls-ink2); }

  /* ── Live Activity pill: one row (height is yours) ───────────── */
  .lay-pill { border-radius: ${S(28)}; }
  .lay-pill .ls-inner {
    display: flex; align-items: center; gap: ${S(10)};
    padding: ${S(8)} ${S(14)} ${S(8)} ${S(10)}; min-height: var(--ls-h); box-sizing: border-box;
  }
  .lay-pill.no-icon .ls-inner { padding-left: ${S(18)}; }

  /* ── Control Center tile: compact 2:1 ────────────────────────── */
  .lay-tile { aspect-ratio: 2 / 1; min-height: ${S(76)}; border-radius: ${S(22)}; container-type: inline-size; }
  .lay-tile .ls-inner {
    position: absolute; inset: 0; box-sizing: border-box; padding: 0 ${S(12)};
    display: flex; flex-direction: row; align-items: center; gap: ${S(10)};
  }
  .lay-tile .ls-disc { width: ${S(40)}; height: ${S(40)}; }
  .lay-tile .ls-icon { --mdc-icon-size: ${S(21)}; width: ${S(21)}; height: ${S(21)}; }

  /* ── Square: 1:1, icon top-left, name underneath ─────────────── */
  .lay-square { aspect-ratio: 1 / 1; min-height: ${S(96)}; border-radius: ${S(24)}; container-type: inline-size; }
  .lay-square .ls-inner {
    position: absolute; inset: 0; box-sizing: border-box; padding: ${S(12)};
    display: flex; flex-direction: column; justify-content: space-between; align-items: var(--ls-just, flex-start);
  }
  .lay-square .ls-disc { width: ${S(40)}; height: ${S(40)}; }
  .lay-square .ls-icon { --mdc-icon-size: ${S(21)}; width: ${S(21)}; height: ${S(21)}; }
  .lay-square .ls-mid { flex: 0 0 auto; width: 100%; }

  /* ── Motion ──────────────────────────────────────────────────────
     subtle : the fill glides to its new level
     full   : subtle + the icon breathes while the light is on
     off    : nothing moves        system : as subtle, but still if "Reduce Motion" is on */
  @keyframes ls-warm { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  ha-card.anim-full.is-on .ls-icon { animation: ls-warm 2.6s ease-in-out infinite; }
  ha-card.anim-off, ha-card.anim-off *, ha-card.anim-off::before { animation: none !important; transition: none !important; }
  @media (prefers-reduced-motion: reduce) {
    ha-card.anim-system, ha-card.anim-system *, ha-card.anim-system::before { animation: none !important; transition: none !important; }
  }
`;

const CLOSE_SVG = `
<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"
     stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;



const ACTIVE_STATES   = ['on', 'open', 'opening', 'playing', 'home', 'locked', 'heat', 'cool', 'heat_cool', 'heating', 'cooling', 'cleaning', 'running', 'charging', 'active', 'detected', 'armed_home', 'armed_away', 'armed_night'];
const INACTIVE_STATES = ['off', 'closed', 'closing', 'idle', 'standby', 'paused', 'stopped', 'not_home', 'unlocked', 'docked', 'clear', 'disarmed', 'inactive', 'ready'];

const BIN_LABELS = {
  door: ['Open', 'Closed'], window: ['Open', 'Closed'], opening: ['Open', 'Closed'], garage_door: ['Open', 'Closed'],
  motion: ['Detected', 'Clear'], occupancy: ['Detected', 'Clear'], presence: ['Detected', 'Clear'], moving: ['Moving', 'Still'],
  moisture: ['Wet', 'Dry'], smoke: ['Smoke', 'Clear'], gas: ['Gas', 'Clear'], carbon_monoxide: ['Detected', 'Clear'],
  battery: ['Low', 'Normal'], lock: ['Unlocked', 'Locked'], plug: ['Plugged in', 'Unplugged'], connectivity: ['Connected', 'Disconnected'],
  problem: ['Problem', 'OK'], safety: ['Unsafe', 'Safe'], tamper: ['Tampered', 'Clear'], vibration: ['Vibration', 'Clear'],
  sound: ['Sound', 'Clear'], light: ['Light', 'Dark'], cold: ['Cold', 'Normal'], heat: ['Hot', 'Normal'], running: ['Running', 'Not running'],
  update: ['Update available', 'Up to date'],
};


function fmtString(str, isEntityId = false) {
  if (!str) return '';
  let s = String(str);
  if (isEntityId && s.includes('.')) s = s.split('.').pop();
  return s.replace(/_/g, ' ').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// decimals: a number = fixed places; unset = automatic (at most 2, trailing zeros trimmed)
function fmtNumber(n, decimals) {
  const d = parseInt(decimals, 10);
  if (decimals !== undefined && decimals !== null && decimals !== '' && !isNaN(d)) return n.toFixed(Math.max(0, Math.min(6, d)));
  return String(Math.round(n * 100) / 100);
}

function timeAgo(iso) {
  if (!iso) return '--';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (isNaN(mins)) return '--';
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function timeAgoShort(iso) {
  const t = timeAgo(iso);
  return t === 'Just now' ? 'now' : t.replace(' mins ago', 'm').replace(' min ago', 'm').replace(' ago', '');
}
const hhmm = ms => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// "40m", "2h 5m", "3d" — how long something has been the way it is
function agoText(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  return r ? `${h}h ${r}m` : `${h}h`;
}
function clockAt(ms) {
  try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return '--'; }
}
function durText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

const AI_ICONS = {
  info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8v.01"/></svg>',
  power:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 16v4M16.5 18h4"/></svg>',
  chart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V11"/><path d="M12 20V5"/><path d="M19 20v-6"/></svg>',
  timeline:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><path d="M11 6h8M11 12h6M11 18h8"/></svg>',
  more:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18.5" cy="12" r="1"/></svg>',
  chat:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h14a2 2 0 012 2v8a2 2 0 01-2 2h-7l-4 3v-3H5a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>',
  send:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/></svg>',
};

// The icon Home Assistant would show if the entity has none of its own. Only used when the
// <ha-state-icon> element isn't available (older frontends) — normally HA resolves it itself.
function defaultIconFor(stateObj) {
  if (!stateObj) return 'mdi:bookmark';
  if (stateObj.attributes?.icon) return stateObj.attributes.icon;
  const domain = stateObj.entity_id.split('.')[0], dc = stateObj.attributes?.device_class, on = stateObj.state === 'on';
  switch (domain) {
    case 'light': return 'mdi:lightbulb';
    case 'switch': return dc === 'outlet' ? 'mdi:power-plug' : 'mdi:toggle-switch';
    case 'person': return 'mdi:account';
    case 'sun': return 'mdi:white-balance-sunny';
    case 'weather': return 'mdi:weather-cloudy';
    case 'climate': return 'mdi:thermostat';
    case 'lock': return stateObj.state === 'locked' ? 'mdi:lock' : 'mdi:lock-open';
    case 'media_player': return 'mdi:cast';
    case 'fan': return 'mdi:fan';
    case 'cover': return 'mdi:window-shutter';
    case 'input_boolean': return on ? 'mdi:check-circle-outline' : 'mdi:close-circle-outline';
    case 'binary_sensor':
      if (['door', 'garage_door', 'opening'].includes(dc)) return on ? 'mdi:door-open' : 'mdi:door-closed';
      if (dc === 'window') return on ? 'mdi:window-open' : 'mdi:window-closed';
      if (['motion', 'presence', 'occupancy'].includes(dc)) return 'mdi:motion-sensor';
      if (dc === 'moisture') return 'mdi:water-alert';
      if (dc === 'smoke') return 'mdi:smoke-detector';
      if (dc === 'gas') return 'mdi:gas-cylinder';
      if (dc === 'carbon_monoxide') return 'mdi:molecule-co';
      if (dc === 'plug') return 'mdi:power-plug';
      return 'mdi:radiobox-marked';
    case 'sensor':
      if (dc === 'temperature') return 'mdi:thermometer';
      if (dc === 'humidity') return 'mdi:water-percent';
      if (dc === 'battery') return 'mdi:battery';
      if (dc === 'power') return 'mdi:flash';
      if (dc === 'energy') return 'mdi:lightning-bolt';
      if (dc === 'illuminance') return 'mdi:brightness-5';
      if (dc === 'moisture') return 'mdi:water';
      if (dc === 'pressure') return 'mdi:gauge';
      return 'mdi:eye';
    default: return 'mdi:bookmark';
  }
}

// ───────────────────────────────────────────────────────────────────
//  CARD
// ───────────────────────────────────────────────────────────────────


// ───────────────────────────────────────────────────────────────────
//  LIGHT CONSTANTS
// ───────────────────────────────────────────────────────────────────

const LAYOUTS = ['pill', 'tile', 'square'];

const DEFAULT_ACTIVE = '#F1C40F';    // the light's colour when it has none of its own

const COLOR_PRESETS = [
  { id: 'sun',   name: 'Sunshine', colors: { active_color: '#F1C40F' } },
  { id: 'amber', name: 'Amber',    colors: { active_color: '#FF9F0A' } },
  { id: 'sky',   name: 'Sky',      colors: { active_color: '#64D2FF' } },
  { id: 'mint',  name: 'Mint',     colors: { active_color: '#30D158' } },
  { id: 'berry', name: 'Berry',    colors: { active_color: '#BF5AF2' } },
  { id: 'rose',  name: 'Rose',     colors: { active_color: '#FF375F' } },
];
// key, label, default, description, optional?
const COLOR_ROWS = [
  ['active_color',   'Light colour', DEFAULT_ACTIVE, 'Used when the light has no colour of its own — or always, if “Use the light’s own colour” is off', false],
  ['inactive_color', 'Unlit tint',   '#8E8E93',      'Optional — tints the part of the button that isn’t lit', true],
  ['name_color',     'Text',         '#FFFFFF',      'Optional — overrides the automatic name colour', true],
  ['icon_color',     'Icon',         '#FFFFFF',      'Optional — overrides the automatic icon colour', true],
];

const px = (v, def) => { const n = parseFloat(v); return isNaN(n) ? def : n; };

// ───────────────────────────────────────────────────────────────────
//  CARD
// ───────────────────────────────────────────────────────────────────

class CrowLightSliderCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = null;
    this._built = false;
    this._layout = null;
    this._dark = true;
    this._themeKey = null;
    this._popupOverlay = null;
    this._popupHours = 3;
    this._lpFired = false;
    this._suppressClick = false;
    this._dragging = false;
    this._holdUntil = 0;
    this._r = null;
  }

  static getConfigElement() { return document.createElement('crow-light-slider-card-editor'); }

  static getStubConfig(hass, entities) {
    const pick = (entities || []).find(e => e.startsWith('light.')) || '';
    return { entity: pick, layout: 'pill', appearance: 'auto', glass: 50 };
  }

  static get DEFAULTS() {
    return {
      entity: '', name: '',
      show_icon: true, icon: '', use_dynamic_icon: false, show_state: true,
      layout: 'pill', text_align: 'left', font_size: '14px', card_height: '56px',
      slider_enabled: true, follow_light_color: true,
      graph_hours: 3,
      appearance: 'auto', glass: 50, size: 'compact', animation: 'subtle',
    };
  }

  setConfig(config) {
    this._config = { ...CrowLightSliderCard.DEFAULTS, ...(config || {}) };
    if (this._built) {
      if (this._layoutKey() !== this._layout) this._build();
      this._update();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }

  getCardSize() { return this._config?.layout === 'square' ? 3 : this._config?.layout === 'tile' ? 2 : 1; }

  getGridOptions() {
    const l = this._config?.layout;
    if (l === 'square') return { columns: 6, rows: 3, min_columns: 3, min_rows: 2 };
    if (l === 'tile') return { columns: 6, rows: 2, min_columns: 3, min_rows: 2 };
    return { columns: 12, rows: 1, min_columns: 3, min_rows: 1 };
  }

  _stateId() { return this._config?.entity || ''; }

  // ── Icon mode: the light's own (HA-resolved) icon, or one the user picked ──
  _dynamicIcon() { return !!this._config.use_dynamic_icon || !this._config.icon; }

  _layoutKey() {
    const l = LAYOUTS.includes(this._config?.layout) ? this._config.layout : 'pill';
    return `${l}|${this._dynamicIcon() ? 'state' : 'fixed'}|${this._config.show_icon === false ? 'noicon' : 'icon'}`;
  }

  // ── Theme (light / dark / glass / size) ─────────────────────────
  _applyTheme() {
    const cfg = this._config || {};
    const mode = cfg.appearance || 'auto';
    let dark;
    if (mode === 'dark') dark = true;
    else if (mode === 'light') dark = false;
    else if (typeof this._hass?.themes?.darkMode === 'boolean') dark = this._hass.themes.darkMode;
    else dark = !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    let a = parseFloat(cfg.glass);
    a = isNaN(a) ? 0.5 : Math.min(1, Math.max(0, a / 100));
    const scale = cfg.size === 'regular' ? 1.2 : 1;

    const align = ['left', 'center', 'right'].includes(cfg.text_align) ? cfg.text_align : 'left';
    const key = `${dark}|${a}|${scale}|${align}|${cfg.font_size}|${cfg.card_height}|${cfg.layout}`;
    this._dark = dark;
    if (key === this._themeKey) return;
    this._themeKey = key;
    Object.entries(themeTokens(dark, a)).forEach(([k, v]) => this.style.setProperty(k, v));
    this.style.setProperty('--ls-s', String(scale));
    this.style.setProperty('--ls-rest', `inset 0 1px 0 var(--ls-hi), inset 0 -1px 0 var(--ls-lo), var(--ls-shadow)`);
    this.style.setProperty('--ls-fs', `calc(${px(cfg.font_size, 14)}px * var(--ls-s, 1))`);
    this.style.setProperty('--ls-h', `calc(${px(cfg.card_height, 56)}px * var(--ls-s, 1))`);
    this.style.setProperty('--ls-tfilter', dark ? 'drop-shadow(0 1px 5px rgba(0,0,0,0.35))' : 'none');
    const just = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
    this.style.setProperty('--ls-align', align);
    this.style.setProperty('--ls-just', just);
    this.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  // ── Build (once per layout / icon mode) ─────────────────────────
  _build() {
    const cfg = this._config;
    const key = this._layoutKey();
    const layout = key.split('|')[0];
    this._layout = key;

    const dynamic = this._dynamicIcon();
    this._iconTag = dynamic ? (customElements.get('ha-state-icon') ? 'ha-state-icon' : 'ha-icon') : 'ha-icon';
    const showIcon = cfg.show_icon !== false;
    const disc = showIcon ? `<div class="ls-disc"><${this._iconTag} class="ls-icon" id="ls-icon"></${this._iconTag}></div>` : '';
    const text = `<div class="ls-mid"><span class="ls-name" id="ls-name"></span><span class="ls-state" id="ls-state"></span></div>`;
    this.shadowRoot.innerHTML = `<style>${STYLES}</style><ha-card id="ls-card" class="lay-${layout}${showIcon ? '' : ' no-icon'}"><div class="ls-tint"></div><div class="ls-fill" id="ls-fill"></div><div class="ls-inner">${disc}${text}</div></ha-card>`;

    const card = this.shadowRoot.getElementById('ls-card');
    card.addEventListener('click', () => this._onCardTap());
    const discEl = card.querySelector('.ls-disc');
    if (discEl) discEl.addEventListener('click', e => this._onIconTap(e));
    this._attachGestures(card);
  }

  // ── State ───────────────────────────────────────────────────────
  _resolve() {
    const cfg = this._config, hass = this._hass;
    const stateObj = cfg.entity ? hass.states[cfg.entity] : null;
    if (!stateObj) return { stateObj: null };
    const raw = String(stateObj.state);
    const attrs = stateObj.attributes || {};
    const offline = raw === 'unavailable' || raw === 'unknown';
    const isOn = raw === 'on';
    const bri = Number(attrs.brightness);
    const hasBri = isOn && attrs.brightness !== undefined && attrs.brightness !== null && isFinite(bri);
    const pct = isOn ? (hasBri ? Math.max(1, Math.round(bri / 255 * 100)) : 100) : 0;
    const modes = attrs.supported_color_modes;
    const canDim = !offline && (Array.isArray(modes) ? modes.some(m => m !== 'onoff') : (attrs.brightness !== undefined || (Number(attrs.supported_features) & 1) === 1));
    const text = offline ? 'Offline' : isOn ? (hasBri ? `${pct}%` : 'On') : 'Off';
    const kind = offline ? 'offline' : isOn ? 'active' : 'inactive';
    const name = cfg.name || attrs.friendly_name || fmtString(cfg.entity, true);
    return { stateObj, raw, domain: 'light', attrs, offline, num: null, text, heroText: text, unit: '', kind, isOn, pct, canDim, name, hasRange: false };
  }

  // The colour the lit part takes: the light's own colour, or the one you chose
  _baseColour(r) {
    const cfg = this._config, a = r.attrs || {};
    const own = isHex(cfg.active_color) ? cfg.active_color.trim() : null;
    if (cfg.follow_light_color !== false) {
      if (Array.isArray(a.rgb_color) && a.rgb_color.length === 3) return _rgb2hex(...a.rgb_color);
      if (Array.isArray(a.hs_color) && a.hs_color.length === 2) return _hsl2hex(a.hs_color[0], Math.min(1, a.hs_color[1] / 100), 0.5);
      return own || DEFAULT_ACTIVE;
    }
    return own || DEFAULT_ACTIVE;
  }

  _palette(r) {
    const dark = this._dark;
    if (r.kind === 'active') return { pal: tuneColor(this._baseColour(r), dark), colored: true };
    return { pal: NEUTRAL_COLORS[dark ? 'dark' : 'light'], colored: false };
  }

  _syncIcon(stateObj) {
    const el = this.shadowRoot.getElementById('ls-icon');
    if (!el) return;
    if (this._iconTag === 'ha-state-icon') {
      el.hass = this._hass;
      el.stateObj = stateObj;
    } else {
      const icon = !this._dynamicIcon() ? this._config.icon : defaultIconFor(stateObj);
      if (el.icon !== icon) el.icon = icon;
      if (el.getAttribute('icon') !== icon) el.setAttribute('icon', icon);
    }
  }

  _update() {
    if (!this._hass || !this._config) return;
    const cfg = this._config, root = this.shadowRoot;
    const $ = id => root.getElementById(id);
    const card = $('ls-card');
    if (!card) return;

    this._applyTheme();
    const r = this._resolve();
    this._r = r;
    card.classList.toggle('no-tap', !r.stateObj);

    if (!r.stateObj) {
      const nameEl = $('ls-name'), stEl = $('ls-state');
      if (nameEl) nameEl.textContent = cfg.entity ? 'Light not found' : 'Choose a light';
      if (stEl) { stEl.textContent = cfg.entity || ''; stEl.hidden = !cfg.entity; }
      card.classList.remove('is-on');
      $('ls-fill')?.style.setProperty('--ls-pct', '0%');
      return;
    }

    const { pal, colored } = this._palette(r);
    const dark = this._dark;
    const on = r.kind === 'active';
    card.classList.toggle('is-on', on);
    card.classList.toggle('is-off', !on);
    card.classList.toggle('is-offline', r.kind === 'offline');

    card.style.setProperty('--ls-c1', pal.c1);
    card.style.setProperty('--ls-c2', pal.c2);
    card.style.setProperty('--ls-dot', pal.dot);
    card.style.setProperty('--ls-text', pal.text);
    card.style.setProperty('--ls-glow', colored ? hexA(pal.dot, dark ? 0.32 : 0.24) : 'transparent');
    if (colored) {
      const ft = fillTint(pal, dark);
      card.style.setProperty('--ls-fill1', hexA(pal.c1, ft.a1));
      card.style.setProperty('--ls-fill2', hexA(pal.c2, ft.a2));
      card.style.setProperty('--ls-glowcol', hexA(pal.dot, dark ? 0.55 : 0.42));
    }
    card.style.setProperty('--ls-icon-auto', on ? 'var(--ls-ink)' : 'var(--ls-text)');
    card.style.setProperty('--ls-off', isHex(cfg.inactive_color) ? hexA(cfg.inactive_color.trim(), dark ? 0.34 : 0.26) : 'transparent');
    isHex(cfg.name_color) ? card.style.setProperty('--ls-name-color', cfg.name_color.trim()) : card.style.removeProperty('--ls-name-color');
    isHex(cfg.name_color) ? card.style.setProperty('--ls-state-color', cfg.name_color.trim()) : card.style.removeProperty('--ls-state-color');
    isHex(cfg.icon_color) ? card.style.setProperty('--ls-icon-color', cfg.icon_color.trim()) : card.style.removeProperty('--ls-icon-color');

    const anim = ['off', 'full', 'system'].includes(cfg.animation) ? cfg.animation : 'subtle';
    card.classList.toggle('anim-off', anim === 'off');
    card.classList.toggle('anim-full', anim === 'full');
    card.classList.toggle('anim-system', anim === 'system');

    // brightness (not while a finger is dragging it, and briefly after, until the light reports back)
    if (!this._dragging && Date.now() > this._holdUntil) {
      $('ls-fill').style.setProperty('--ls-pct', `${on ? r.pct : 0}%`);
    }

    this._syncIcon(r.stateObj);
    const nameEl = $('ls-name'), stEl = $('ls-state');
    if (nameEl) nameEl.textContent = r.name;
    if (stEl && !this._dragging) { stEl.textContent = r.text; stEl.hidden = cfg.show_state === false; }
  }

  // ── Actions ─────────────────────────────────────────────────────
  _toggleEntity() {
    const id = this._config?.entity;
    if (id && this._hass) this._hass.callService('light', 'toggle', { entity_id: id });
  }
  _tapAction() { return null; }
  _runAction() { this._toggleEntity(); }
  _actionLabel() { return this._r?.isOn ? 'Turn off' : 'Turn on'; }
  _canAct() { return !!this._config?.entity; }
  _hasIcon() { return this._config?.show_icon !== false; }

  // Tapping the icon switches the light on or off…
  _onIconTap(e) {
    e.stopPropagation();
    if (this._suppressClick) { this._suppressClick = false; return; }
    if (this._lpFired) { this._lpFired = false; return; }
    this._toggleEntity();
  }

  // …tapping anywhere else on the card opens the details sheet (value, history, info).
  _onCardTap() {
    if (this._suppressClick) { this._suppressClick = false; return; }
    if (this._lpFired) { this._lpFired = false; return; }
    if (!this._r?.stateObj) return;
    this._openPopup();
  }

  // Long-press: the AI actions sheet, when AI features are on
  _onLongPress() {
    if (!this._r?.stateObj) return;
    if (this._aiEnabled()) this._openActionsSheet();
    else if (!this._hasIcon()) this._openPopup();
  }

  // Sideways drag anywhere on the card sets the brightness; a press-and-hold opens the actions sheet
  _attachGestures(card) {
    let sx = 0, sy = 0, mode = null, timer = null, pid = null, onDisc = false, lastBri = null, deb = null;
    const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const send = (pct) => {
      const bri = Math.round(pct / 100 * 255);
      if (bri === lastBri) return;
      lastBri = bri;
      const id = this._config.entity;
      if (pct <= 0) this._hass.callService('light', 'turn_off', { entity_id: id });
      else this._hass.callService('light', 'turn_on', { entity_id: id, brightness: Math.max(1, bri) });
    };
    card.addEventListener('pointerdown', e => {
      if (e.button) return;
      this._lpFired = false; this._suppressClick = false; this._pendingPct = null;
      sx = e.clientX; sy = e.clientY; mode = null; pid = e.pointerId; lastBri = null;
      onDisc = e.composedPath().some(n => n.classList && n.classList.contains('ls-disc'));
      clearTimer();
      timer = setTimeout(() => { timer = null; if (mode) return; this._lpFired = true; this._onLongPress(); }, 500);
    });
    card.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (!mode) {
        if (Math.hypot(dx, dy) < 8) return;
        clearTimer();
        const canSlide = this._config.slider_enabled !== false && this._r?.canDim && !onDisc;
        if (canSlide && Math.abs(dx) > Math.abs(dy) * 1.2) {
          mode = 'drag'; this._dragging = true; card.classList.add('dragging');
          try { card.setPointerCapture(e.pointerId); } catch (_) {}
        } else { mode = 'other'; return; }
      }
      if (mode !== 'drag') return;
      if (e.cancelable) e.preventDefault();
      const rect = card.getBoundingClientRect();
      const pct = Math.round(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100);
      card.querySelector('#ls-fill, .ls-fill').style.setProperty('--ls-pct', `${pct}%`);
      const st = this.shadowRoot.getElementById('ls-state');
      if (st && this._config.show_state !== false) st.textContent = pct > 0 ? `${pct}%` : 'Off';
      this._pendingPct = pct;
      clearTimeout(deb); deb = setTimeout(() => send(pct), 50);
    });
    const end = e => {
      if (e.pointerId !== pid) return;
      clearTimer();
      // anything that moved was a swipe, not a tap — the click that follows it is ignored
      if (mode) { this._suppressClick = true; setTimeout(() => { this._suppressClick = false; }, 60); }
      if (mode === 'drag') {
        clearTimeout(deb);
        if (this._pendingPct != null) send(this._pendingPct);
        this._dragging = false; card.classList.remove('dragging');
        this._holdUntil = Date.now() + 1500;           // keep the new level on screen until the light reports back
        try { card.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      mode = null; pid = null;
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('contextmenu', e => e.preventDefault());
  }


  // ── Details sheet ───────────────────────────────────────────────
  _closePopup() {
    if (!this._popupOverlay) return;
    const ov = this._popupOverlay;
    ov.style.transition = 'opacity 0.18s ease';
    ov.style.opacity = '0';
    setTimeout(() => { ov.parentNode?.removeChild(ov); }, 185);
    this._popupOverlay = null;
  }

  // Theme tokens for the sheet — it lives on document.body, outside the card's shadow root.
  _popupVars() {
    return this._dark
      ? '--ls-ink:#fff;--ls-ink2:rgba(255,255,255,0.68);--ls-line:rgba(255,255,255,0.12);--ls-chip:rgba(255,255,255,0.10);--ls-seg-on:rgba(255,255,255,0.22);--ls-track:rgba(255,255,255,0.16);' +
        '--ls-sheet:linear-gradient(160deg,rgba(70,70,80,0.90),rgba(30,30,36,0.95));--ls-sheet-edge:rgba(255,255,255,0.22);'
      : '--ls-ink:#1c1c1e;--ls-ink2:rgba(60,60,67,0.68);--ls-line:rgba(60,60,67,0.14);--ls-chip:rgba(120,120,128,0.12);--ls-seg-on:#ffffff;--ls-track:rgba(120,120,128,0.20);' +
        '--ls-sheet:linear-gradient(160deg,rgba(255,255,255,0.94),rgba(244,244,250,0.96));--ls-sheet-edge:rgba(255,255,255,0.9);';
  }

  _createPopupBase(titleText) {
    if (this._popupOverlay) return null;
    const overlay = document.createElement('div');
    overlay.className = 'ls-overlay';
    overlay.style.cssText = `
      ${this._popupVars()}
      position:fixed;inset:0;z-index:9999;box-sizing:border-box;
      display:flex;align-items:flex-end;justify-content:center;
      padding:12px;padding-bottom:max(12px, env(safe-area-inset-bottom));
      background:rgba(0,0,0,${this._dark ? 0.5 : 0.30});
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      animation:lsFadeIn 0.2s ease;`;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes lsFadeIn  { from{opacity:0} to{opacity:1} }
      @keyframes lsSheetUp { from{transform:translateY(40px);opacity:0} to{transform:none;opacity:1} }
      @media (min-width:700px) { .ls-overlay { align-items:center !important; } }
      .ls-popup {
        background:var(--ls-sheet); border:1px solid var(--ls-sheet-edge); border-radius:34px;
        box-shadow:0 24px 64px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.4);
        -webkit-backdrop-filter:blur(40px) saturate(180%);backdrop-filter:blur(40px) saturate(180%);
        padding:20px; width:100%; max-width:420px; max-height:88vh; overflow-y:auto; box-sizing:border-box;
        font-family:ui-rounded,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,system-ui,'Segoe UI',sans-serif;
        color:var(--ls-ink); animation:lsSheetUp 0.38s cubic-bezier(0.32,1.1,0.5,1);
      }
      .ls-close-btn { background:var(--ls-chip);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ls-ink2);padding:0;flex-shrink:0;font-family:inherit; }
      .ls-info-row { display:flex;align-items:flex-start;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--ls-line); }
      .ls-info-row:last-child { border-bottom:none; }
      .ls-info-label { font-size:13px;color:var(--ls-ink2);font-weight:500;flex-shrink:0;padding-right:12px; }
      .ls-info-value { font-size:13px;font-weight:600;color:var(--ls-ink);text-align:right;word-break:break-all; }
      .ls-seg { display:flex;background:var(--ls-chip);border-radius:12px;padding:3px;gap:2px;margin-bottom:12px; }
      .ls-seg-btn { flex:1;text-align:center;padding:7px 4px;font-size:12px;font-weight:600;border-radius:9px;cursor:pointer;color:var(--ls-ink2);border:none;background:none;transition:all .2s;font-family:inherit;touch-action:manipulation; }
      .ls-seg-btn.active { background:var(--ls-seg-on);color:var(--ls-ink);box-shadow:0 1px 4px rgba(0,0,0,0.25); }
      .ls-graph { position:relative;height:150px;margin-bottom:14px;touch-action:pan-y; }
      .ls-graph-msg { display:flex;align-items:center;justify-content:center;height:100%;color:var(--ls-ink2);font-size:12px; }
      .ls-btn-row { display:flex;gap:10px;margin-top:14px; }
      .ls-btn { flex:1;border:none;border-radius:16px;height:46px;padding:0 16px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;background:var(--ls-chip);color:var(--ls-ink);transition:opacity .15s,transform .1s; }
      .ls-btn:active { transform:scale(0.98); }
      .ls-tip { position:absolute;top:0;pointer-events:none;padding:5px 9px;border-radius:10px;background:var(--ls-sheet-edge);background:var(--ls-chip);border:1px solid var(--ls-line);font-size:12px;font-weight:600;white-space:nowrap;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);display:none;color:var(--ls-ink); }
      .ls-tip small { display:block;font-weight:500;color:var(--ls-ink2);font-size:10px; }
      .ls-sec { margin-bottom:16px; }
      .ls-sec[hidden] { display:none; }
      .ls-sec-label { font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--ls-ink2);margin-bottom:6px; }
      .ls-local { font-size:14px;color:var(--ls-ink2);line-height:1.4; }
      .ls-ai-text { font-size:17px;line-height:1.4;color:var(--ls-ink);font-weight:500; }
      .ls-skel { height:14px;border-radius:7px;margin:9px 0;background:linear-gradient(90deg,var(--ls-chip) 25%,var(--ls-line) 50%,var(--ls-chip) 75%);background-size:200% 100%;animation:lsShimmer 1.2s linear infinite; }
      @keyframes lsShimmer { from{background-position:200% 0} to{background-position:-200% 0} }
      .ls-chips-q { display:flex;flex-wrap:wrap;gap:8px; }
      .ls-q { border:1px solid var(--ls-line);background:var(--ls-chip);color:var(--ls-ink);border-radius:999px;padding:10px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left; }
      .ls-q:active { transform:scale(0.98); }
      .ls-answer { margin-top:12px;padding:12px 14px;border-radius:16px;background:var(--ls-chip); }
      .ls-q-title { font-size:12px;font-weight:700;color:var(--ls-ink2);margin-bottom:6px; }
      .ls-ans-body { font-size:15px;line-height:1.45;color:var(--ls-ink); }
      .ls-foot { margin-top:14px;font-size:11px;line-height:1.45;color:var(--ls-ink2); }
      .ls-rows { display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:var(--ls-chip); }
      .ls-row { display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:15px 16px;background:none;border:none;border-top:1px solid var(--ls-line);color:var(--ls-ink);font:inherit;font-size:17px;font-weight:500;text-align:left;cursor:pointer; }
      .ls-row:first-child { border-top:none; }
      .ls-row:active { background:var(--ls-line); }
      .ls-row svg { width:22px;height:22px;flex-shrink:0;color:var(--ls-ink2); }
      .ls-row.is-danger, .ls-row.is-danger svg { color:#FF453A; }
      .ls-stats { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px; }
      .ls-stat { border-radius:16px;background:var(--ls-chip);padding:12px 14px; }
      .ls-stat b { display:block;font-size:21px;font-weight:700;letter-spacing:-0.02em; }
      .ls-stat span { font-size:12px;color:var(--ls-ink2); }
      .ls-ask-row { display:flex;gap:8px;margin-top:14px; }
      .ls-ask-input { flex:1;min-width:0;box-sizing:border-box;height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--ls-line);background:var(--ls-chip);color:var(--ls-ink);font:inherit;font-size:16px; }
      .ls-ask-input:focus { outline:none;border-color:#0A84FF; }
      .ls-send { width:44px;height:44px;flex-shrink:0;border-radius:50%;border:none;background:#0A84FF;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer; }
      .ls-send svg { width:20px;height:20px; }
      .ls-tl-head { font-size:13px;color:var(--ls-ink2);margin-bottom:8px;line-height:1.4; }
      .ls-tl { display:flex;flex-direction:column;border-radius:16px;background:var(--ls-chip);padding:2px 14px;margin-bottom:12px; }
      .ls-tl-row { display:flex;align-items:baseline;gap:12px;padding:10px 0;border-top:1px solid var(--ls-line); }
      .ls-tl-row:first-child { border-top:none; }
      .ls-tl-time { width:52px;flex-shrink:0;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ls-ink2); }
      .ls-tl-label { flex:1;min-width:0;font-size:16px;font-weight:600; }
      .ls-tl-dur { font-size:13px;color:var(--ls-ink2);font-variant-numeric:tabular-nums; }
      .ls-note { font-size:13px;color:var(--ls-ink2);line-height:1.4;margin:0 0 6px; }
    `;
    overlay.appendChild(style);
    const openedAt = Date.now();   // ignore the tail of the long-press that opened it
    overlay.addEventListener('click', e => { if (e.target === overlay && Date.now() - openedAt > 350) this._closePopup(); });

    const popup = document.createElement('div');
    popup.className = 'ls-popup';
    popup.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    popup.addEventListener('click', e => e.stopPropagation());

    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;';
    hdr.innerHTML = `
      <span style="font-size:22px;font-weight:700;letter-spacing:-0.01em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(titleText)}</span>
      <button type="button" class="ls-close-btn" aria-label="Close">${CLOSE_SVG}</button>`;
    hdr.querySelector('.ls-close-btn').addEventListener('click', () => this._closePopup());
    popup.appendChild(hdr);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    this._popupOverlay = overlay;
    return popup;
  }

  _openPopup() {
    const r = this._r || this._resolve();
    if (!r?.stateObj || this._popupOverlay) return;
    const cfg = this._config;
    const { pal } = this._palette(r);
    const popup = this._createPopupBase(r.name);
    if (!popup) return;

    // hero
    const hero = document.createElement('div');
    hero.style.cssText = 'display:flex;align-items:baseline;gap:8px;margin:2px 0 4px;';
    hero.innerHTML = `
      <div style="font-size:${r.heroText.length > 9 ? 34 : 48}px;font-weight:700;letter-spacing:-0.03em;line-height:1;color:${pal.text};">${esc(r.heroText)}</div>
      ${r.unit ? `<div style="font-size:16px;color:var(--ls-ink2);font-weight:500;">${esc(r.unit)}</div>` : ''}`;
    popup.appendChild(hero);
    const sub = document.createElement('div');
    sub.style.cssText = 'font-size:13px;color:var(--ls-ink2);margin-bottom:14px;';
    sub.textContent = `Updated ${timeAgo(r.stateObj.last_changed || r.stateObj.last_updated).toLowerCase()}`;
    popup.appendChild(sub);

    // history (numeric line, or on/off timeline) — nothing for free-text states
    const binary = r.domain === 'binary_sensor' || (r.raw === 'on' || r.raw === 'off');
    if (r.num !== null || binary) {
      this._popupHours = [1, 3, 6, 12, 24].includes(parseInt(cfg.graph_hours, 10)) ? parseInt(cfg.graph_hours, 10) : 3;
      const seg = document.createElement('div'); seg.className = 'ls-seg';
      const graph = document.createElement('div'); graph.className = 'ls-graph';
      [1, 3, 6, 12, 24].forEach(h => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'ls-seg-btn' + (h === this._popupHours ? ' active' : ''); b.textContent = `${h}h`; b.dataset.hours = h;
        b.addEventListener('click', () => {
          this._popupHours = h;
          seg.querySelectorAll('.ls-seg-btn').forEach(x => x.classList.toggle('active', parseInt(x.dataset.hours, 10) === h));
          this._loadGraph(graph, h, r);
        });
        seg.appendChild(b);
      });
      popup.appendChild(seg);
      popup.appendChild(graph);
      this._loadGraph(graph, this._popupHours, r);
    }

    // info rows
    const info = document.createElement('div');
    const rows = [['State', `${r.text}${r.unit ? ' ' + r.unit : ''}`], ['Last changed', timeAgo(r.stateObj.last_changed || r.stateObj.last_updated)]];
    rows.forEach(([l, v]) => {
      const row = document.createElement('div'); row.className = 'ls-info-row';
      row.innerHTML = `<span class="ls-info-label">${esc(l)}</span><span class="ls-info-value">${esc(v)}</span>`;
      info.appendChild(row);
    });
    popup.appendChild(info);

    // actions
    const btns = document.createElement('div'); btns.className = 'ls-btn-row';
    if (this._canAct()) {
      const t = document.createElement('button'); t.type = 'button'; t.className = 'ls-btn';
      t.textContent = this._actionLabel();
      t.addEventListener('click', () => { this._toggleEntity(); });
      btns.appendChild(t);
    }
    if (btns.children.length) popup.appendChild(btns);
  }

  // ── AI (Home Assistant's conversation agent) ────────────────────
  // Long-press opens an actions sheet: Insight, Ask AI, What happened?, This week (+ Details / Toggle).
  // Everything goes through the agent chosen in the editor, and only when a sheet is opened —
  // nothing runs in the background.

  _aiEnabled() {
    const c = this._config;
    return !!(c?.ai_features_enabled && c?.ai_conversation_agent);
  }

  async _aiConverse(prompt, { ttl = 600000, key = null, force = false } = {}) {
    if (!this._aiEnabled() || !this._hass?.connection) return null;
    if (!this._aiCache) this._aiCache = new Map();
    const ck = key || prompt.slice(0, 1500);
    const hit = this._aiCache.get(ck);
    if (!force && hit && Date.now() - hit.t < ttl) return hit.v;
    try {
      const resp = await this._hass.connection.sendMessagePromise({
        type: 'conversation/process', text: prompt,
        agent_id: this._config.ai_conversation_agent, language: navigator.language || 'en',
      });
      if (resp?.response?.response_type === 'error') return null;
      const text = resp?.response?.speech?.plain?.speech || null;
      if (!text) return null;
      this._aiCache.set(ck, { t: Date.now(), v: text });
      return text;
    } catch (e) {
      console.warn('[Crow AI]', e);
      return null;
    }
  }

  // Strips markdown fences and parses the first {...} block
  _aiExtractJson(raw) {
    if (!raw) return null;
    const s = String(raw).split('```json').join('').split('```').join('');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (_) { return null; }
  }

  // What kind of thing this is, in words the assistant can use, plus wording for the sheets
  _aiSpec() {
    const r = this._r || this._resolve();
    const dc = r.attrs?.device_class, d = r.domain;
    const dcWord = dc ? String(dc).replace(/_/g, ' ') : '';
    const kindWords = { light: 'light', switch: 'switch', lock: 'smart lock', cover: 'cover', climate: 'thermostat', fan: 'fan', media_player: 'media player', person: 'person', input_boolean: 'toggle', humidifier: 'humidifier', vacuum: 'robot vacuum', camera: 'camera', weather: 'weather entity' };
    const appliance = (d === 'sensor' || d === 'binary_sensor') ? (dcWord ? `${dcWord} sensor` : (d === 'sensor' ? 'sensor' : 'binary sensor')) : (kindWords[d] || 'device');
    const numeric = r.num !== null;
    const nouns = { door: 'opening', window: 'opening', opening: 'opening', garage_door: 'opening', motion: 'detection', occupancy: 'detection', presence: 'detection', light: 'time on', switch: 'time on' };
    const runNoun = nouns[dc] || nouns[d] || 'activation';
    const security = ['lock', 'cover', 'alarm_control_panel'].includes(d) || ['door', 'window', 'opening', 'garage_door', 'smoke', 'gas', 'carbon_monoxide', 'motion', 'occupancy', 'presence'].includes(dc);
    return {
      appliance, numeric, runNoun,
      guidance: 'Only use the facts given above and never invent readings. Be practical and cautious. Do not give safety-critical or security assurances (never say a home is secure or that something is safe); if you are unsure, say so.',
      disclaimer: security ? 'AI-generated. Never rely on it for security or safety — check for yourself.' : 'AI-generated. Double-check before you act on it.',
      defaultQuestions: numeric
        ? ['Is this reading normal?', 'What could affect this?', 'Should I be concerned?']
        : security
          ? ['How long has it been like this?', 'What usually triggers this?', 'Is there anything I should check?']
          : ['How long has it been like this?', 'What usually triggers this?', 'Anything worth checking?'],
      isActive: s => ACTIVE_STATES.includes(String(s)),
      stateLabel: s => {
        s = String(s);
        if (s === 'unavailable' || s === 'unknown') return 'Offline';
        if (d === 'binary_sensor') { const l = BIN_LABELS[dc] || ['On', 'Off']; return s === 'on' ? l[0] : s === 'off' ? l[1] : fmtString(s); }
        if (d === 'lock') return s === 'locked' ? 'Locked' : s === 'unlocked' ? 'Unlocked' : fmtString(s);
        return fmtString(s);
      },
    };
  }

  // A one-line description of the entity right now (used in every prompt)
  _aiSnapshot() {
    const r = this._r || this._resolve();
    if (!r?.stateObj) return { facts: ['no data yet'], key: 'nodata', local: '' };
    const so = r.stateObj, now = Date.now();
    const since = Date.parse(so.last_changed || so.last_updated);
    const facts = [`state ${r.text}${r.unit ? ' ' + r.unit : ''}`];
    if (!isNaN(since) && now - since >= 60000) facts.push(`unchanged for ${agoText(now - since)}`);
    if (r.attrs.device_class) facts.push(`device class ${String(r.attrs.device_class).replace(/_/g, ' ')}`);
    if (r.hasRange) facts.push(`normal range ${r.min} to ${r.max}`);
    // a few short, meaningful attributes (brightness, battery, target temperature…)
    const skip = new Set(['friendly_name', 'icon', 'entity_picture', 'supported_features', 'device_class', 'unit_of_measurement', 'state_class', 'attribution', 'restored', 'editable', 'id', 'last_reset', 'options', 'entity_id']);
    let n = 0;
    Object.entries(r.attrs).forEach(([k, v]) => {
      if (n >= 6 || skip.has(k)) return;
      if (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 40)) { facts.push(`${k.replace(/_/g, ' ')} ${v}`); n++; }
    });
    const local = `${r.text}${r.unit ? ' ' + r.unit : ''}${!isNaN(since) ? ' · ' + timeAgo(so.last_changed || so.last_updated).toLowerCase() : ''}`;
    return { facts, key: `${r.raw}|${Math.floor(now / 600000)}`, local };
  }

  _aiContextText() {
    const spec = this._aiSpec(), snap = this._aiSnapshot(), r = this._r;
    const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [
      `You are the assistant inside a smart-home dashboard card for a ${spec.appliance} named "${r?.name || 'this entity'}".`,
      `Local time: ${clock}.`,
      `Current state: ${snap.facts.join('; ')}.`,
      spec.guidance,
    ].filter(Boolean).join(' ');
  }

  _aiCacheKey(prefix, extra = '') { return `${prefix}|${this._stateId()}|${this._aiSnapshot().key}|${extra}`; }

  async _aiLoadInsight(force = false) {
    const prompt = `${this._aiContextText()}
Reply with ONLY a JSON object, no markdown: {"status":"...","next":"..."}
- status: one sentence (max 24 words) saying what the current state or reading means, plus one practical tip if it helps. Only use facts given above.
- next: one short sentence (max 16 words) with a sensible next step, or "" if there is nothing to do.
Plain text only. No emojis.`;
    const raw = await this._aiConverse(prompt, { key: this._aiCacheKey('insight'), force });
    if (!raw) return null;
    const j = this._aiExtractJson(raw);
    if (j && typeof j.status === 'string') return { status: j.status.trim(), next: (j.next || '').trim() };
    return { status: String(raw).replace(/[{}"]/g, '').trim(), next: '' };   // agent ignored the JSON format
  }

  async _aiAnswer(question, force = false) {
    const prompt = `${this._aiContextText()}
Question: "${question}"
Answer in at most 45 words, plain text, no markdown or emojis. Be practical and cautious; if you don't know, say so.`;
    const raw = await this._aiConverse(prompt, { key: this._aiCacheKey('ans', question), force });
    return raw ? String(raw).trim() : null;
  }

  // ── History (for "What happened?" and "This week") ──────────────
  async _aiHistory(id, startMs, endMs) {
    const res = await this._hass.connection.sendMessagePromise({
      type: 'history/history_during_period',
      start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString(),
      entity_ids: [id], include_start_time_state: true, significant_changes_only: false,
      minimal_response: true, no_attributes: true,
    });
    return (res?.[id] || []).map(p => {
      const ts = p.lc ?? p.lu ?? p.last_changed ?? p.last_updated;
      const t = typeof ts === 'number' ? ts * 1000 : Date.parse(ts);
      return { t: Math.max(startMs, t), s: p.s ?? p.state };
    }).filter(p => !isNaN(p.t));
  }

  // consecutive "active" stretches (short gaps, e.g. a brief "unavailable", are bridged)
  _aiRuns(series, isActive, endMs) {
    const runs = []; let start = null;
    for (const p of series) {
      const on = !!isActive(p.s);
      if (on && start === null) start = p.t;
      else if (!on && start !== null) { runs.push({ a: start, b: p.t }); start = null; }
    }
    if (start !== null) runs.push({ a: start, b: endMs });
    const merged = [];
    runs.forEach(r => {
      const last = merged[merged.length - 1];
      if (last && r.a - last.b < 300000) last.b = r.b; else merged.push({ ...r });
    });
    return merged.filter(r => r.b - r.a >= 60000);
  }

  _aiRunStats(runs) {
    if (!runs.length) return { count: 0, totalMs: 0, longestMs: 0, busiest: null };
    const byDay = {};
    runs.forEach(r => {
      const d = new Date(r.a).toLocaleDateString([], { weekday: 'long' });
      (byDay[d] = byDay[d] || { count: 0, ms: 0 });
      byDay[d].count += 1; byDay[d].ms += r.b - r.a;
    });
    const busiest = Object.entries(byDay).sort((x, y) => y[1].count - x[1].count || y[1].ms - x[1].ms)[0];
    return { count: runs.length, totalMs: runs.reduce((s, r) => s + (r.b - r.a), 0), longestMs: Math.max(...runs.map(r => r.b - r.a)), busiest: { day: busiest[0], count: busiest[1].count } };
  }

  // numeric history → time-weighted average, extremes (with when), and per-day averages
  _aiNumStats(series, startMs, endMs) {
    const pts = series.filter(p => isFinite(p.s) && p.s !== '').map(p => ({ t: p.t, v: parseFloat(p.s) })).sort((a, b) => a.t - b.t);
    if (pts.length < 2) return null;
    let area = 0, dur = 0;
    pts.forEach((p, i) => { const t1 = i + 1 < pts.length ? pts[i + 1].t : endMs; const d = Math.max(0, t1 - p.t); area += p.v * d; dur += d; });
    const min = pts.reduce((m, p) => p.v < m.v ? p : m, pts[0]);
    const max = pts.reduce((m, p) => p.v > m.v ? p : m, pts[0]);
    const days = {};
    pts.forEach(p => { const k = new Date(p.t).toLocaleDateString([], { weekday: 'long' }) + '|' + new Date(p.t).toDateString(); (days[k] = days[k] || []).push(p.v); });
    const perDay = Object.entries(days).map(([k, vs]) => ({ day: k.split('|')[0], avg: vs.reduce((s, v) => s + v, 0) / vs.length }));
    const hiDay = perDay.reduce((m, d) => d.avg > m.avg ? d : m, perDay[0]);
    const loDay = perDay.reduce((m, d) => d.avg < m.avg ? d : m, perDay[0]);
    return { pts, avg: dur ? area / dur : pts.reduce((s, p) => s + p.v, 0) / pts.length, min, max, first: pts[0], last: pts[pts.length - 1], hiDay, loDay, dayCount: perDay.length };
  }

  // ── Sheet building blocks ───────────────────────────────────────
  _aiSection(parent, label) {
    const sec = document.createElement('div');
    sec.className = 'ls-sec';
    if (label) { const l = document.createElement('div'); l.className = 'ls-sec-label'; l.textContent = label; sec.appendChild(l); }
    const body = document.createElement('div');
    sec.appendChild(body);
    parent.appendChild(sec);
    return { sec, body };
  }
  _aiSkeleton(el, lines = 2) {
    el.innerHTML = Array.from({ length: lines }, (_, i) => `<div class="ls-skel" style="width:${i === lines - 1 ? 62 : 100}%"></div>`).join('');
  }
  _aiFooter(popup, text) {
    const f = document.createElement('div');
    f.className = 'ls-foot';
    f.textContent = text;
    popup.appendChild(f);
  }

  // Long-press sheet
  _openActionsSheet() {
    const r = this._r; if (!r?.stateObj) return;
    const popup = this._createPopupBase(r.name);
    if (!popup) return;
    const cfg = this._config;
    const rows = [{ icon: 'info', label: 'Details', fn: () => this._openPopup() }];
    if (this._canAct()) rows.push({ icon: 'power', danger: false, label: this._actionLabel(), fn: () => this._toggleEntity() });
    if (this._aiEnabled()) {
      if (cfg.ai_enable_insight !== false) rows.push({ icon: 'sparkle', label: 'Insight', fn: () => this._openInsightSheet() });
      if (cfg.ai_enable_ask !== false) rows.push({ icon: 'chat', label: 'Ask AI…', fn: () => this._openAskSheet() });
      if (cfg.ai_enable_recap !== false) rows.push({ icon: 'timeline', label: 'What happened?', fn: () => this._openRecapSheet() });
      if (cfg.ai_enable_week !== false) rows.push({ icon: 'chart', label: 'This week', fn: () => this._openWeekSheet() });
    }
    const list = document.createElement('div');
    list.className = 'ls-rows';
    rows.forEach(row => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'ls-row' + (row.danger ? ' is-danger' : '');
      b.innerHTML = `${AI_ICONS[row.icon]}<span>${esc(row.label)}</span>`;
      b.addEventListener('click', () => { this._closePopup(); setTimeout(() => row.fn(), 60); });
      list.appendChild(b);
    });
    popup.appendChild(list);
  }

  // Insight: the state in plain words, plus a tip and a next step
  async _openInsightSheet() {
    const r = this._r; if (!r?.stateObj) return;
    const spec = this._aiSpec();
    const popup = this._createPopupBase(r.name);
    if (!popup) return;
    const now = this._aiSection(popup, 'Now');
    now.body.innerHTML = `<div class="ls-local">${esc(this._aiSnapshot().local || '—')}</div>`;
    const assist = this._aiSection(popup, 'Insight');
    const next = this._aiSection(popup, 'Next step'); next.sec.hidden = true;
    this._aiFooter(popup, spec.disclaimer);
    const alive = () => popup.isConnected;
    this._aiSkeleton(assist.body, 2);
    const res = await this._aiLoadInsight(false);
    if (!alive()) return;
    if (!res) { assist.body.innerHTML = `<div class="ls-ai-text">I couldn’t reach the assistant. Check the AI settings in this card’s editor, then try again.</div>`; return; }
    assist.body.innerHTML = `<div class="ls-ai-text">${esc(res.status)}</div>`;
    if (res.next) { next.sec.hidden = false; next.body.innerHTML = `<div class="ls-ai-text">${esc(res.next)}</div>`; }
  }

  // Typed question (+ suggestion chips)
  _openAskSheet() {
    const r = this._r; if (!r?.stateObj) return;
    const spec = this._aiSpec();
    const popup = this._createPopupBase('Ask AI');
    if (!popup) return;
    const chips = document.createElement('div'); chips.className = 'ls-chips-q'; popup.appendChild(chips);
    const answer = document.createElement('div'); popup.appendChild(answer);
    const row = document.createElement('div'); row.className = 'ls-ask-row';
    row.innerHTML = `<input type="text" class="ls-ask-input" placeholder="Ask about this ${esc(spec.appliance)}…" autocomplete="off" enterkeyhint="send">
                     <button type="button" class="ls-send" aria-label="Send">${AI_ICONS.send}</button>`;
    popup.appendChild(row);
    this._aiFooter(popup, spec.disclaimer);
    const input = row.querySelector('input'), send = row.querySelector('button');
    const alive = () => popup.isConnected;
    const ask = async q => {
      q = (q || '').trim(); if (!q) return;
      answer.innerHTML = `<div class="ls-answer"><div class="ls-q-title">${esc(q)}</div><div class="ls-ans-body"></div></div>`;
      const bodyEl = answer.querySelector('.ls-ans-body');
      this._aiSkeleton(bodyEl, 2);
      const a = await this._aiAnswer(q);
      if (!alive()) return;
      bodyEl.textContent = a || 'Sorry, I couldn’t get an answer just now.';
    };
    spec.defaultQuestions.forEach(q => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ls-q'; b.textContent = q;
      b.addEventListener('click', () => { input.value = ''; ask(q); });
      chips.appendChild(b);
    });
    send.addEventListener('click', () => { ask(input.value); input.value = ''; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { ask(input.value); input.value = ''; } });
  }

  // Last 7 days from history, with a short AI summary
  async _openWeekSheet() {
    const r = this._r; if (!r?.stateObj) return;
    const spec = this._aiSpec();
    const popup = this._createPopupBase('This week');
    if (!popup) return;
    const body = document.createElement('div'); popup.appendChild(body);
    this._aiSkeleton(body, 3);
    this._aiFooter(popup, spec.disclaimer);
    const alive = () => popup.isConnected;
    const end = Date.now(), start = end - 7 * 86400000;
    let series = [];
    try { series = await this._aiHistory(this._stateId(), start, end); } catch (e) { console.warn('[Crow AI] history', e); }
    if (!alive()) return;
    const tile = (v, l) => `<div class="ls-stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    const noHistory = `<div class="ls-ai-text">I couldn’t find any history for this ${esc(spec.appliance)} in the last 7 days. (Home Assistant’s recorder needs to keep this entity.)</div>`;
    const sum = document.createElement('div'); sum.className = 'ls-ai-text';
    const dec = this._config.decimals;
    const fv = v => `${fmtNumber(v, dec)}${r.unit ? ' ' + r.unit : ''}`;
    let facts = '';

    if (spec.numeric) {
      const st = this._aiNumStats(series, start, end);
      if (!st) { body.innerHTML = noHistory; return; }
      const when = p => `${new Date(p.t).toLocaleDateString([], { weekday: 'short' })} ${hhmm(p.t)}`;
      body.innerHTML = `<div class="ls-stats">
        ${tile(fv(st.avg), 'average')}
        ${tile(fv(st.max.v), `highest · ${when(st.max)}`)}
        ${tile(fv(st.min.v), `lowest · ${when(st.min)}`)}
        ${st.dayCount > 1 ? tile(st.hiDay.day, `highest day · avg ${fv(st.hiDay.avg)}`) : ''}
      </div>`;
      body.appendChild(sum);
      facts = `average ${fv(st.avg)}; highest ${fv(st.max.v)} on ${when(st.max)}; lowest ${fv(st.min.v)} on ${when(st.min)}; ${st.dayCount > 1 ? `highest day ${st.hiDay.day} (average ${fv(st.hiDay.avg)}), lowest day ${st.loDay.day} (average ${fv(st.loDay.avg)}); ` : ''}now ${fv(r.num)}`;
    } else {
      if (!series.length) { body.innerHTML = noHistory; return; }
      const runs = this._aiRuns(series, spec.isActive, end), st = this._aiRunStats(runs);
      const pl = n => /(s|sh|ch|x)$/.test(n) ? n + 'es' : n + 's';
      const noun = spec.runNoun === 'time on' ? 'time on' : spec.runNoun;
      body.innerHTML = `<div class="ls-stats">
        ${tile(String(st.count), spec.runNoun === 'time on' ? 'times on this week' : `${st.count === 1 ? noun : pl(noun)} this week`)}
        ${tile(st.count ? durText(st.totalMs) : '—', 'total active time')}
        ${tile(st.count ? durText(st.longestMs) : '—', 'longest')}
        ${tile(st.busiest ? st.busiest.day : '—', 'busiest day')}
      </div>`;
      body.appendChild(sum);
      if (!st.count) { sum.textContent = `Nothing active in the last 7 days.`; return; }
      facts = `${st.count} ${spec.runNoun === 'time on' ? 'times switched on' : (st.count === 1 ? noun : pl(noun))} in the last 7 days; total active time ${durText(st.totalMs)}; longest ${durText(st.longestMs)}; busiest day ${st.busiest.day}`;
    }
    this._aiSkeleton(sum, 2);
    const raw = await this._aiConverse(
      `You are the assistant inside a smart-home card for a ${spec.appliance} named "${r.name}". Facts: ${facts}. Write at most two short, friendly sentences summarising this week. Plain text, no markdown or emojis. Do not add anything that is not in the facts.`,
      { key: `week|${this._stateId()}|${facts}`, ttl: 3600000 });
    if (!alive()) return;
    if (raw) sum.textContent = String(raw).trim(); else sum.remove();
  }

  // Recent activity: the latest stretch as a timeline (on/off entities) or the last 24 hours (numbers)
  async _openRecapSheet() {
    const r = this._r; if (!r?.stateObj) return;
    const spec = this._aiSpec();
    const popup = this._createPopupBase('What happened?');
    if (!popup) return;
    const body = document.createElement('div'); popup.appendChild(body);
    this._aiSkeleton(body, 4);
    this._aiFooter(popup, spec.disclaimer);
    const alive = () => popup.isConnected;
    const end = Date.now();
    const start = end - (spec.numeric ? 24 * 3600000 : 7 * 86400000);
    let series = [];
    try { series = await this._aiHistory(this._stateId(), start, end); } catch (e) { console.warn('[Crow AI] history', e); }
    if (!alive()) return;
    const dec = this._config.decimals;
    const fv = v => `${fmtNumber(v, dec)}${r.unit ? ' ' + r.unit : ''}`;
    const tile = (v, l) => `<div class="ls-stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    const sum = document.createElement('div'); sum.className = 'ls-ai-text'; sum.style.marginTop = '10px';
    let prompt = '', key = '';

    if (spec.numeric) {
      const st = this._aiNumStats(series, start, end);
      if (!st) { body.innerHTML = `<div class="ls-ai-text">I couldn’t find enough history for this ${esc(spec.appliance)} in the last 24 hours.</div>`; return; }
      const change = r.num - st.first.v, sign = change > 0 ? '+' : '';
      const when = p => hhmm(p.t);
      body.innerHTML = `<div class="ls-tl-head">Last 24 hours</div>
        <div class="ls-stats">
          ${tile(fv(r.num), 'now')}
          ${tile(`${sign}${fmtNumber(change, dec)}${r.unit ? ' ' + r.unit : ''}`, 'change over 24h')}
          ${tile(fv(st.max.v), `highest · ${when(st.max)}`)}
          ${tile(fv(st.min.v), `lowest · ${when(st.min)}`)}
        </div>`;
      body.appendChild(sum);
      const facts = `now ${fv(r.num)}; 24 hours ago ${fv(st.first.v)} (change ${sign}${fmtNumber(change, dec)}); highest ${fv(st.max.v)} at ${when(st.max)}; lowest ${fv(st.min.v)} at ${when(st.min)}; average ${fv(st.avg)}`;
      prompt = `You are the assistant inside a smart-home card for a ${spec.appliance} named "${r.name}". Facts about the last 24 hours: ${facts}. Write at most two short sentences describing what happened and whether it looks unusual. Plain text, no markdown or emojis. Do not add anything that is not in the facts.`;
      key = `recap|${this._stateId()}|${facts}`;
    } else {
      const runs = series.length ? this._aiRuns(series, spec.isActive, end) : [];
      if (!runs.length) { body.innerHTML = `<div class="ls-ai-text">I couldn’t find any recent activity for this ${esc(spec.appliance)} in the last 7 days. (Home Assistant’s recorder needs to keep this entity.)</div>`; return; }
      const run = runs[runs.length - 1];
      const live = spec.isActive(series[series.length - 1].s) && run.b >= end - 1000;
      const evs = [];
      series.forEach(p => {
        if (p.t < run.a - 120000 || p.t > run.b + 1000) return;
        const label = spec.stateLabel(p.s);
        const prev = evs[evs.length - 1];
        if (prev && prev.label === label) return;
        evs.push({ t: p.t, label });
      });
      evs.forEach((e, i) => { const nextT = i + 1 < evs.length ? evs[i + 1].t : (live ? end : null); e.dur = (e.t < run.b || live) && nextT ? Math.max(0, nextT - e.t) : null; });
      const notes = [];
      const prevDur = runs.slice(0, -1).map(x => x.b - x.a).sort((a, b) => a - b);
      if (!live && prevDur.length >= 3) {
        const med = prevDur[Math.floor(prevDur.length / 2)], d = run.b - run.a;
        if (d > med * 1.4 && d - med >= 600000) notes.push(`Longer than usual (about ${durText(med)}).`);
        else if (d < med * 0.6 && med - d >= 600000) notes.push(`Shorter than usual (about ${durText(med)}).`);
      }
      evs.forEach(e => { if (/^offline$/i.test(e.label) && e.dur >= 60000) notes.push(`It dropped offline for ${durText(e.dur)}.`); });
      const day = new Date(run.a).toLocaleDateString([], { weekday: 'short' });
      const head = live ? `Active now — since ${clockAt(run.a)} (${durText(end - run.a)} so far)` : `Latest activity — ${day} ${clockAt(run.a)}–${clockAt(run.b)} · ${durText(run.b - run.a)}`;
      body.innerHTML = `<div class="ls-tl-head">${esc(head)}</div>
        <div class="ls-tl">${evs.map(e => `<div class="ls-tl-row"><span class="ls-tl-time">${esc(clockAt(e.t))}</span><span class="ls-tl-label">${esc(e.label)}</span><span class="ls-tl-dur">${e.dur != null ? esc(durText(e.dur)) : ''}</span></div>`).join('')}</div>
        ${notes.map(n => `<div class="ls-note">${esc(n)}</div>`).join('')}`;
      body.appendChild(sum);
      const tl = evs.map(e => `${clockAt(e.t)} ${e.label}${e.dur != null ? ` (${durText(e.dur)})` : ''}`).join('; ');
      prompt = `You are the assistant inside a smart-home card for a ${spec.appliance} named "${r.name}". Timeline of the ${live ? 'current' : 'latest'} activity: ${tl}. Total ${durText((live ? end : run.b) - run.a)}. Write at most two short sentences describing what happened. Plain text, no markdown or emojis. Do not add anything that is not in the timeline.`;
      key = `recap|${this._stateId()}|${run.a}|${live ? 'live' : run.b}`;
    }
    this._aiSkeleton(sum, 2);
    const raw = await this._aiConverse(prompt, { key, ttl: 1800000 });
    if (!alive()) return;
    if (raw) sum.textContent = String(raw).trim(); else sum.remove();
  }

  // ── History graph ───────────────────────────────────────────────
  async _loadGraph(container, hours, r) {
    const entity = this._stateId();
    if (!entity || !this._hass) return;
    container._gen = (container._gen || 0) + 1;
    const gen = container._gen;
    const msg = t => `<div class="ls-graph-msg">${t}</div>`;
    container.innerHTML = msg('Loading…');
    const end = new Date(), start = new Date(end - hours * 3600000);
    const color = tuneColor(this._baseColour(r), this._dark).dot;
    try {
      const resp = await this._hass.callApi('GET',
        `history/period/${start.toISOString()}?filter_entity_id=${entity}&end_time=${end.toISOString()}&minimal_response=true&no_attributes=true`);
      if (container._gen !== gen) return;
      const raw = (resp && resp[0]) || [];
      if (r.num !== null) {
        const pts = raw.filter(s => isFinite(s.state) && s.state !== '').map(s => ({ t: Date.parse(s.last_changed || s.last_updated), v: parseFloat(s.state) })).filter(p => !isNaN(p.t));
        if (pts.length < 2) { container.innerHTML = msg('Not enough history in this period'); return; }
        this._renderLine(container, pts, start.getTime(), end.getTime(), color, r);
      } else {
        const pts = raw.filter(s => s.state === 'on' || s.state === 'off').map(s => ({ t: Date.parse(s.last_changed || s.last_updated), on: s.state === 'on' })).filter(p => !isNaN(p.t));
        if (!pts.length) { container.innerHTML = msg('No history in this period'); return; }
        this._renderSteps(container, pts, start.getTime(), end.getTime(), color, r);
      }
    } catch (e) {
      if (container._gen === gen) container.innerHTML = msg('Could not load history');
    }
  }

  // Wires a graph's crosshair with real
  // touchstart/touchmove listeners with an explicit preventDefault(), not
  // just Pointer Events. Pointer Events alone (plus touch-action:none)
  // usually stop the page from scrolling under a drag, but some embedded
  // webviews (e.g. the Home Assistant companion app) still hand a
  // horizontal drag over to native scrolling partway through, which
  // looks like the crosshair "getting stuck" at one position. Calling
  // preventDefault() on the touch events themselves is what reliably
  // stops that everywhere.
  _wireDrag(svg, show) {
    let dragging = false;
    svg.addEventListener('touchstart', e => { dragging = true; e.preventDefault(); e.stopPropagation(); show(e.touches[0].clientX); }, { passive: false });
    svg.addEventListener('touchmove', e => { if (!dragging) return; e.preventDefault(); e.stopPropagation(); show(e.touches[0].clientX); }, { passive: false });
    svg.addEventListener('touchend', e => { e.stopPropagation(); dragging = false; }, { passive: false });
    svg.addEventListener('touchcancel', () => { dragging = false; });
    svg.addEventListener('mousedown', e => { dragging = true; show(e.clientX); });
    svg.addEventListener('mousemove', e => show(e.clientX));
    svg.addEventListener('mouseup', () => { dragging = false; });
    svg.addEventListener('mouseleave', () => { dragging = false; });
  }

  _renderLine(container, pts, t0, t1, color, r) {
    const W = 300, H = 120, padT = 14, padB = 16;
    let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
    if (hi === lo) { hi += 1; lo -= 1; }
    const span = hi - lo, pad = span * 0.08; lo -= pad; hi += pad;
    const X = t => ((Math.min(Math.max(t, t0), t1) - t0) / (t1 - t0)) * W;
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const last = { t: t1, v: pts[pts.length - 1].v };
    const series = [...pts, last];
    const d = series.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ');
    const area = `${d} L${X(last.t).toFixed(1)},${H - padB} L${X(series[0].t).toFixed(1)},${H - padB} Z`;
    const dec = this._config.decimals;
    const f = v => fmtNumber(v, dec !== undefined && dec !== '' ? dec : undefined);
    const vmin = Math.min(...pts.map(p => p.v)), vmax = Math.max(...pts.map(p => p.v));
    const gid = 'lsg' + Math.random().toString(36).slice(2, 7);
    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;display:block;overflow:visible;touch-action:none;cursor:crosshair;">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="0.42"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
        <line x1="0" y1="${Y(vmax).toFixed(1)}" x2="${W}" y2="${Y(vmax).toFixed(1)}" stroke="var(--ls-line)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>
        <line x1="0" y1="${Y(vmin).toFixed(1)}" x2="${W}" y2="${Y(vmin).toFixed(1)}" stroke="var(--ls-line)" stroke-dasharray="3 4" vector-effect="non-scaling-stroke"/>
        <path d="${area}" fill="url(#${gid})"/>
        <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>
      <div style="position:absolute;left:0;top:0;font-size:10px;font-weight:600;color:var(--ls-ink2);">${f(vmax)}${r.unit ? ' ' + esc(r.unit) : ''}</div>
      <div style="position:absolute;left:0;bottom:16px;font-size:10px;font-weight:600;color:var(--ls-ink2);">${f(vmin)}</div>
      <div style="position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:space-between;font-size:10px;color:var(--ls-ink2);"><span>${hhmm(t0)}</span><span>${hhmm(t1)}</span></div>
      <div class="ls-xline" style="position:absolute;top:${(padT / H * 100).toFixed(2)}%;bottom:${(padB / H * 100).toFixed(2)}%;width:1px;background:${color};opacity:.7;display:none;pointer-events:none;"></div>
      <div class="ls-xdot" style="position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:${color};border:2px solid var(--ls-ink);box-sizing:border-box;display:none;pointer-events:none;"></div>
      <div class="ls-xpill" style="position:absolute;top:6px;min-width:54px;box-sizing:border-box;padding:6px 12px;border-radius:14px;text-align:center;pointer-events:none;display:none;border:0.75px solid var(--ls-chipedge);box-shadow:0 4px 14px rgba(0,0,0,0.35);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);">
        <div class="ls-xpill-val" style="font-size:13px;font-weight:700;line-height:1.15;color:${color};white-space:nowrap;"></div>
        <div class="ls-xpill-time" style="font-size:10px;font-weight:500;color:var(--ls-ink2);margin-top:2px;white-space:nowrap;"></div>
      </div>`;

    const svg = container.querySelector('svg');
    const xline = container.querySelector('.ls-xline'), xdot = container.querySelector('.ls-xdot'), xpill = container.querySelector('.ls-xpill');
    const xval = xpill.querySelector('.ls-xpill-val'), xtime = xpill.querySelector('.ls-xpill-time');
    xpill.style.background = `linear-gradient(${hexA(color, 0.16)},${hexA(color, 0.16)}),var(--ls-chip)`;

    // Glass-pill crosshair readout — real CSS backdrop-filter glass on an
    // HTML overlay, not SVG. Text and the dot were briefly drawn inside
    // the chart's SVG (which uses preserveAspectRatio="none" so the line
    // and area fill the box exactly), but that same non-uniform scaling
    // squashed the SVG text and dot — HTML text and a real border-radius
    // circle can't be distorted that way.
    //
    // The value at any dragged time is interpolated along `series` (the
    // same points the path itself connects with straight lines) rather
    // than snapped to the last real reading — snapping meant the dot's
    // height stayed pinned to an old value while its x position kept
    // moving with your finger, so it visually came off the line whenever
    // you were between two readings.
    const valueAt = t => {
      if (t <= series[0].t) return series[0].v;
      for (let i = 1; i < series.length; i++) {
        if (t <= series[i].t) {
          const a = series[i - 1], b = series[i];
          const frac = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
          return a.v + (b.v - a.v) * frac;
        }
      }
      return series[series.length - 1].v;
    };
    const show = clientX => {
      const rect = container.getBoundingClientRect();
      const px = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const t = t0 + (px / rect.width) * (t1 - t0);
      const val = valueAt(t);
      // The line/dot follow the finger's actual position (bx = px), not
      // a snapped data point's fixed pixel — that was the earlier bug
      // where dragging past the last real reading looked like it had no
      // effect.
      const bx = px, by = (Y(val) / H) * rect.height;
      xline.style.display = xdot.style.display = xpill.style.display = 'block';
      xline.style.left = `${bx}px`;
      xdot.style.left = `${bx}px`; xdot.style.top = `${by}px`;
      xval.textContent = `${f(val)}${r.unit ? ' ' + r.unit : ''}`;
      xtime.textContent = hhmm(t);
      // Flip the pill below the point when it's near the top, so the dot
      // never sits on top of the pill's time text.
      xpill.style.top = by < 56 ? `${by + 14}px` : '6px';
      const pw = xpill.offsetWidth;
      xpill.style.left = `${Math.min(Math.max(bx - pw / 2, 0), rect.width - pw)}px`;
    };

    // The readout is never auto-cleared — it
    // stays on screen after you lift your finger or move the mouse away,
    // and simply updates the next time you touch or hover the chart.
    this._wireDrag(svg, show);
  }

  _renderSteps(container, pts, t0, t1, color, r) {
    const W = 300, barH = 36, padT = 44, H = padT + barH;
    // each state runs until the next change; the window is clipped to [t0, t1]
    const segs = pts.map((p, i) => ({ a: Math.max(p.t, t0), b: Math.min(i + 1 < pts.length ? pts[i + 1].t : t1, t1), on: p.on })).filter(s => s.b > s.a);
    const onMs = segs.filter(s => s.on).reduce((n, s) => n + (s.b - s.a), 0);
    const total = segs.reduce((n, s) => n + (s.b - s.a), 0) || 1;
    const X = t => ((t - t0) / (t1 - t0)) * W;
    const dur = ms => { const m = Math.round(ms / 60000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim(); };
    const labels = BIN_LABELS[r?.attrs?.device_class] || ['On', 'Off'];
    container.innerHTML = `
      <div style="position:relative;">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:${H}px;display:block;touch-action:none;cursor:crosshair;">
          <rect x="0" y="${padT}" width="${W}" height="${barH}" rx="10" fill="var(--ls-track)"/>
          ${segs.filter(s => s.on).map(s => `<rect x="${X(s.a).toFixed(1)}" y="${padT}" width="${Math.max(1.5, X(s.b) - X(s.a)).toFixed(1)}" height="${barH}" fill="${color}"/>`).join('')}
        </svg>
        <div class="ls-xline" style="position:absolute;top:0;bottom:0;width:1px;background:${color};opacity:.7;display:none;pointer-events:none;"></div>
        <div class="ls-xdot" style="position:absolute;top:${padT + barH / 2}px;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;border:2px solid var(--ls-ink);box-sizing:border-box;display:none;pointer-events:none;"></div>
        <div class="ls-xpill" style="position:absolute;top:0;min-width:54px;box-sizing:border-box;padding:6px 12px;border-radius:14px;text-align:center;pointer-events:none;display:none;border:0.75px solid var(--ls-chipedge);box-shadow:0 4px 14px rgba(0,0,0,0.35);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);">
          <div class="ls-xpill-val" style="font-size:13px;font-weight:700;line-height:1.15;white-space:nowrap;"></div>
          <div class="ls-xpill-time" style="font-size:10px;font-weight:500;color:var(--ls-ink2);margin-top:2px;white-space:nowrap;"></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--ls-ink2);margin-top:6px;"><span>${hhmm(t0)}</span><span>${hhmm(t1)}</span></div>
      <div style="margin-top:10px;font-size:13px;color:var(--ls-ink2);"><b style="color:var(--ls-ink);">On for ${dur(onMs)}</b> · ${Math.round(onMs / total * 100)}% of this period</div>`;

    const svg = container.querySelector('svg');
    const xline = container.querySelector('.ls-xline'), xdot = container.querySelector('.ls-xdot'), xpill = container.querySelector('.ls-xpill');
    const xval = xpill.querySelector('.ls-xpill-val'), xtime = xpill.querySelector('.ls-xpill-time');

    // Same HTML/CSS glass-pill crosshair as the line graph — real
    // backdrop-filter, immune to the SVG stretching that squashed the
    // earlier SVG-native version — adapted to a segmented timeline:
    // instead of a value it shows which state the entity was in at the
    // touched point, tinted by that state.
    const show = clientX => {
      const rect = svg.getBoundingClientRect();
      const px = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const t = t0 + (px / rect.width) * (t1 - t0);
      let seg = segs[0]; for (const s of segs) { if (s.a <= t) seg = s; else break; }
      if (!seg) return;
      const tint = seg.on ? color : null;
      xline.style.display = xdot.style.display = xpill.style.display = 'block';
      xline.style.left = xdot.style.left = `${px}px`;
      xdot.style.background = xline.style.background = tint || 'var(--ls-ink2)';
      xpill.style.background = tint ? `linear-gradient(${hexA(tint, 0.16)},${hexA(tint, 0.16)}),var(--ls-chip)` : 'var(--ls-chip)';
      xval.textContent = labels[seg.on ? 0 : 1];
      xval.style.color = tint || 'var(--ls-ink2)';
      xtime.textContent = hhmm(t);
      const pw = xpill.offsetWidth;
      xpill.style.left = `${Math.min(Math.max(px - pw / 2, 0), rect.width - pw)}px`;
    };

    // Same drag wiring as the line graph — see _wireDrag.
    this._wireDrag(svg, show);
  }
}

// ───────────────────────────────────────────────────────────────────
//  EDITOR
// ───────────────────────────────────────────────────────────────────

const EDITOR_EXTRA = `
  .sel-host { display: block; }
  .sel-host > * { display: block; width: 100%; }
  .fallback-icon { display: flex; align-items: center; gap: 10px; }
  .fallback-icon .fi-prev { width: 38px; height: 38px; flex-shrink: 0; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: rgba(128,128,128,0.10); --mdc-icon-size: 22px; }
  .range-row b { font-size: 12px; font-weight: 600; min-width: 52px; text-align: right; flex-shrink: 0; }
`;

const _thumb = inner => `
  <svg viewBox="0 0 96 64" aria-hidden="true">
    <defs>
      <linearGradient id="lt-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6a4bdc"/><stop offset="0.55" stop-color="#e4597f"/><stop offset="1" stop-color="#ff9b3d"/>
      </linearGradient>
      <linearGradient id="lt-a" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFC15A"/><stop offset="1" stop-color="#FF8A1F"/>
      </linearGradient>
    </defs>
    <rect width="96" height="64" rx="10" fill="url(#lt-bg)"/>
    ${inner}
  </svg>`;
const _glass = (x, y, w, h, r) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.55)" stroke-width="0.8"/>`;

const LAYOUT_OPTIONS = [
  { id: 'pill', name: 'Live Activity', sub: 'One row · drag to dim', svg: _thumb(
      `<clipPath id="lt-cp"><rect x="8" y="22" width="80" height="20" rx="10"/></clipPath>` +
      _glass(8, 22, 80, 20, 10) +
      `<rect x="8" y="22" width="50" height="20" fill="url(#lt-a)" opacity="0.7" clip-path="url(#lt-cp)"/>` +
      `<circle cx="20" cy="32" r="6" fill="rgba(255,255,255,0.75)"/>` +
      `<rect x="31" y="26" width="22" height="4" rx="2" fill="rgba(255,255,255,0.95)"/><rect x="31" y="33" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.6)"/>`) },
  { id: 'tile', name: 'Tile', sub: 'Compact · icon + name', svg: _thumb(
      `<clipPath id="lt-cp"><rect x="16" y="17" width="64" height="30" rx="9"/></clipPath>` +
      _glass(16, 17, 64, 30, 9) +
      `<rect x="16" y="17" width="40" height="30" fill="url(#lt-a)" opacity="0.7" clip-path="url(#lt-cp)"/>` +
      `<circle cx="29" cy="32" r="7" fill="rgba(255,255,255,0.75)"/>` +
      `<rect x="41" y="26" width="26" height="4" rx="2" fill="rgba(255,255,255,0.95)"/><rect x="41" y="33" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.6)"/>`) },
  { id: 'square', name: 'Square', sub: 'Icon on top, name below', svg: _thumb(
      `<clipPath id="lt-cp"><rect x="25" y="9" width="46" height="46" rx="11"/></clipPath>` +
      _glass(25, 9, 46, 46, 11) +
      `<rect x="25" y="9" width="30" height="46" fill="url(#lt-a)" opacity="0.7" clip-path="url(#lt-cp)"/>` +
      `<circle cx="36" cy="20" r="6" fill="rgba(255,255,255,0.75)"/>` +
      `<rect x="31" y="39" width="26" height="4" rx="2" fill="rgba(255,255,255,0.95)"/><rect x="31" y="46" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.6)"/>`) },
];

class CrowLightSliderCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) this._render();
    else this.shadowRoot.querySelectorAll('ha-selector').forEach(s => { s.hass = hass; });
  }

  setConfig(config) {
    this._config = { ...CrowLightSliderCard.DEFAULTS, ...config };
    if (!this._initialized && this._hass) this._render();
    else if (this._initialized) this._syncUI();
  }

  _defaultIcon() {
    const so = this._hass?.states?.[this._config.entity];
    return so ? defaultIconFor(so) : 'mdi:lightbulb';
  }

  // ── Render ──────────────────────────────────────────────────────
  _render() {
    if (!this._hass || !this._config) return;
    this._initialized = true;
    const tog = (id, label, desc) => `
              <div class="toggle-item">
                <div><div class="toggle-label">${label}</div><div class="toggle-desc">${desc}</div></div>
                <label class="toggle-switch"><input type="checkbox" id="${id}"><span class="toggle-track"></span></label>
              </div>`;
    const slider = (id, label, hint, min, max, step) => `
            <div class="select-row">
              <label for="${id}">${label}</label>
              <div class="hint">${hint}</div>
              <div class="range-row"><span>${min}</span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}"><b id="${id}_v"></b></div>
            </div>`;

    this.shadowRoot.innerHTML = `
      <style>${EDITOR_STYLES}${EDITOR_EXTRA}</style>
      <div class="container">

        <!-- Entity -->
        <div>
          <div class="section-title">Light <span class="badge-required">Required</span></div>
          <div class="card-block">
            <div class="select-row">
              <label>Light</label>
              <div class="hint">The light this card dims and switches</div>
              <div class="sel-host" id="ent-host"></div>
            </div>
          </div>
        </div>

        <!-- Layout -->
        <div>
          <div class="section-title">Layout</div>
          <div class="card-block">
            <div class="layout-grid" id="layout_grid" style="grid-template-columns:repeat(3,minmax(0,1fr));">
              ${LAYOUT_OPTIONS.map(o => `
                <button type="button" class="layout-opt" data-layout="${o.id}" aria-pressed="false">
                  ${o.svg}
                  <span class="lo-name">${o.name}</span>
                  <span class="lo-sub">${o.sub}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Icon -->
        <div>
          <div class="section-title">Icon</div>
          <div class="card-block">
            <div class="toggle-list">
              ${tog('show_icon', 'Show icon', 'Tap the icon to switch the light on or off')}
            </div>
            <div id="icon_wrap">
              <div class="select-row" id="icon_row" style="border-top:1px solid rgba(128,128,128,0.08);">
                <label>Choose an icon</label>
                <div class="hint">Pick any Home Assistant icon (the full Material Design Icons library — type to search). Leave it empty to use the icon Home Assistant shows for the entity.</div>
                <div class="sel-host" id="icon-host"></div>
              </div>
              <div class="toggle-list" style="border-top:1px solid rgba(128,128,128,0.08);">
                ${tog('use_dynamic_icon', 'Use the entity\'s own icon', 'The icon Home Assistant shows for this light — ignores the icon chosen above')}
              </div>
            </div>
          </div>
        </div>

        <!-- Display -->
        <div>
          <div class="section-title">Display</div>
          <div class="card-block">
            <div class="text-row">
              <label for="name">Name</label>
              <div class="hint">Leave empty to use the entity's own name</div>
              <input type="text" id="name" placeholder="Entity name">
            </div>
            <div class="toggle-list" style="border-top:1px solid rgba(128,128,128,0.08);">
              ${tog('show_state', 'Show brightness', 'Show the brightness (or “Off”) under the name')}
            </div>
            <div class="select-row" style="border-top:1px solid rgba(128,128,128,0.08);">
              <label>Text alignment</label>
              <div class="seg" id="align_seg">
                <button type="button" class="seg-btn" data-align="left">Left</button>
                <button type="button" class="seg-btn" data-align="center">Centre</button>
                <button type="button" class="seg-btn" data-align="right">Right</button>
              </div>
            </div>
            ${slider('font_size', 'Font size', 'Size of the name (the state line is a little smaller)', 10, 28, 1)}
            ${slider('card_height', 'Height', 'For the Live Activity layout — Tile and Square keep their proportions', 40, 110, 2)}
          </div>
        </div>

        <!-- Slider -->
        <div>
          <div class="section-title">Brightness slider</div>
          <div class="card-block">
            <div class="toggle-list">
              ${tog('slider_enabled', 'Drag to dim', 'Slide a finger sideways anywhere on the card to set the brightness. Lights that can only switch on and off just switch.')}
            </div>
            <div class="select-row" style="border-top:1px solid rgba(128,128,128,0.08);">
              <div class="hint">Tap the icon to switch the light on or off. Tap anywhere else on the card for the details — the current level, its history and when it last changed. A long-press opens the AI actions sheet when AI features are on.</div>
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div>
          <div class="section-title">Appearance</div>
          <div class="card-block">
            <div class="select-row">
              <label>Theme</label>
              <div class="hint">Auto follows your Home Assistant theme</div>
              <div class="seg" id="appearance_seg">
                <button type="button" class="seg-btn" data-appearance="auto">Auto</button>
                <button type="button" class="seg-btn" data-appearance="light">Light</button>
                <button type="button" class="seg-btn" data-appearance="dark">Dark</button>
              </div>
            </div>
            <div class="select-row">
              <label>Size</label>
              <div class="hint">Compact matches standard iOS widget sizing; Regular is about 20% larger</div>
              <div class="seg" id="size_seg">
                <button type="button" class="seg-btn" data-size="compact">Compact</button>
                <button type="button" class="seg-btn" data-size="regular">Regular</button>
              </div>
            </div>
            <div class="select-row">
              <label>Animations</label>
              <div class="hint">Subtle lets the fill glide to its new level; Full also lets the icon breathe while the light is on. System is Subtle but stays still if your iPhone's Reduce Motion is on.</div>
              <div class="seg" id="anim_seg">
                <button type="button" class="seg-btn" data-anim="subtle">Subtle</button>
                <button type="button" class="seg-btn" data-anim="full">Full</button>
                <button type="button" class="seg-btn" data-anim="off">Off</button>
                <button type="button" class="seg-btn" data-anim="system">System</button>
              </div>
            </div>
            <div class="select-row">
              <label for="glass">Glass</label>
              <div class="hint">How see-through the button is (needs a wallpaper or coloured view behind it)</div>
              <div class="range-row"><span>Clear</span><input type="range" id="glass" min="0" max="100" step="5"><span>Frosted</span></div>
            </div>
          </div>
        </div>

        <!-- AI -->
        ${this._aiMarkup()}

        <!-- Colours -->
        <div>
          <div class="section-title">Colours</div>
          <div class="card-block">
            <div class="select-row">
              <label>Preset</label>
              <div class="hint">One tap sets the light colour — then adjust it or add the optional ones below</div>
              <div class="preset-grid" id="preset_grid">
                ${COLOR_PRESETS.map(pr => `
                  <button type="button" class="preset-opt" data-preset="${pr.id}" aria-pressed="false">
                    <span class="preset-dots"><i style="background:${pr.colors.active_color}"></i></span>
                    ${pr.name}
                  </button>`).join('')}
              </div>
            </div>
            <div class="toggle-list" style="border-top:1px solid rgba(128,128,128,0.08);">
              ${tog('follow_light_color', 'Use the light’s own colour', 'Coloured lights show the colour they are set to; the Light colour below is used for white lights')}
            </div>
            ${COLOR_ROWS.map(([k, label, def, desc]) => `
              <div class="select-row color-row" id="row_${k}">
                <div class="color-info"><label for="color_${k}">${label}</label><div class="hint">${desc}</div></div>
                <div class="color-prev" title="Dark theme / light theme">
                  <span class="pv" id="pvd_${k}">Aa</span><span class="pv" id="pvl_${k}">Aa</span>
                </div>
                <input type="color" id="color_${k}" value="${def}">
                <button type="button" class="reset-btn" id="reset_${k}" hidden>Reset</button>
              </div>`).join('')}
            <div class="select-row">
              <div class="hint">The light’s colour is adjusted automatically so the card stays readable in both light and dark themes. Text and icon colours you choose are used exactly as picked.</div>
            </div>
          </div>
        </div>

      </div>`;

    this._mountEntity('ent-host', 'entity');
    this._mountIcon();
    this._attachListeners();
    this._aiListen();
    this._syncUI();
  }

  // ── Home Assistant's own pickers (with a plain fallback) ────────
  _mountEntity(hostId, key) {
    const host = this.shadowRoot.getElementById(hostId);
    this._entSel = this._entSel || {};
    if (customElements.get('ha-selector')) {
      const el = document.createElement('ha-selector');
      el.hass = this._hass; el.selector = { entity: { domain: 'light' } }; el.value = this._config[key] || ''; el.label = '';
      el.addEventListener('value-changed', e => { e.stopPropagation(); this._set(key, e.detail?.value || ''); });
      host.appendChild(el);
      this._entSel[key] = el;
      return;
    }
    const ids = Object.keys(this._hass.states).filter(e => e.startsWith('light.')).sort();
    host.innerHTML = `
      <input type="text" class="entity-search" placeholder="Search lights…">
      <select style="margin-top:6px;"><option value="">— None —</option>${ids.map(e => `<option value="${e}">${esc(this._hass.states[e].attributes.friendly_name || e)} (${e})</option>`).join('')}</select>`;
    const sel = host.querySelector('select'), search = host.querySelector('input');
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      [...sel.options].forEach(o => { o.hidden = !!q && o.value !== '' && !o.textContent.toLowerCase().includes(q); });
    });
    sel.addEventListener('change', () => this._set(key, sel.value));
    this._entSel[key] = sel;
  }

  _mountIcon() {
    const host = this.shadowRoot.getElementById('icon-host');
    if (customElements.get('ha-selector')) {
      const el = document.createElement('ha-selector');
      el.hass = this._hass; el.selector = { icon: { placeholder: this._defaultIcon() } }; el.value = this._config.icon || ''; el.label = '';
      el.addEventListener('value-changed', e => { e.stopPropagation(); this._set('icon', e.detail?.value || ''); });
      host.appendChild(el);
      this._iconSel = el;
      return;
    }
    host.innerHTML = `
      <div class="fallback-icon">
        <div class="fi-prev"><ha-icon id="icon_prev"></ha-icon></div>
        <input type="text" id="icon_text" placeholder="mdi:lightbulb" spellcheck="false" autocomplete="off">
      </div>`;
    const input = host.querySelector('#icon_text');
    input.addEventListener('change', () => {
      const v = input.value.trim();
      if (v === '' || /^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(v)) this._set('icon', v);
      else this._syncUI();
    });
    this._iconText = input;
  }

  // ── Sync UI to config ───────────────────────────────────────────
  _syncUI() {
    const root = this.shadowRoot, cfg = this._config;
    const set = (id, val) => { const el = root.getElementById(id); if (el && root.activeElement !== el) el.value = val ?? ''; };
    const chk = (id, val) => { const el = root.getElementById(id); if (el) el.checked = !!val; };

    ['entity'].forEach(k => { const el = this._entSel?.[k]; if (el && el.value !== (cfg[k] || '')) el.value = cfg[k] || ''; });
    if (this._iconSel) {
      if (this._iconSel.value !== (cfg.icon || '')) this._iconSel.value = cfg.icon || '';
      this._iconSel.selector = { icon: { placeholder: this._defaultIcon() } };
    }
    if (this._iconText) {
      if (root.activeElement !== this._iconText) this._iconText.value = cfg.icon || '';
      const prev = root.getElementById('icon_prev');
      if (prev) { const ic = cfg.icon || this._defaultIcon(); prev.setAttribute('icon', ic); prev.icon = ic; }
    }

    chk('show_state', cfg.show_state !== false);
    chk('show_icon', cfg.show_icon !== false);
    chk('use_dynamic_icon', cfg.use_dynamic_icon);
    chk('slider_enabled', cfg.slider_enabled !== false);
    chk('follow_light_color', cfg.follow_light_color !== false);
    set('name', cfg.name);
    set('glass', Number.isFinite(parseFloat(cfg.glass)) ? parseFloat(cfg.glass) : 50);
    const fs = px(cfg.font_size, 14), ch = px(cfg.card_height, 56);
    set('font_size', fs); set('card_height', ch);
    const lab = (id, t) => { const el = root.getElementById(id); if (el) el.textContent = t; };
    lab('font_size_v', `${fs}px`); lab('card_height_v', `${ch}px`);

    const dim = (id, on) => { const el = root.getElementById(id); if (el) { el.style.opacity = on ? '0.4' : ''; el.style.pointerEvents = on ? 'none' : ''; } };
    dim('icon_wrap', cfg.show_icon === false);
    dim('icon_row', cfg.use_dynamic_icon);
    const heightRow = root.getElementById('card_height'); if (heightRow) heightRow.closest('.select-row').style.opacity = (cfg.layout === 'tile' || cfg.layout === 'square') ? '0.4' : '';

    root.querySelectorAll('.layout-opt').forEach(b => { const on = b.dataset.layout === (LAYOUTS.includes(cfg.layout) ? cfg.layout : 'pill'); b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    root.querySelectorAll('[data-align]').forEach(b => b.classList.toggle('is-selected', b.dataset.align === (cfg.text_align || 'left')));
    root.querySelectorAll('[data-appearance]').forEach(b => b.classList.toggle('is-selected', b.dataset.appearance === (cfg.appearance || 'auto')));
    root.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('is-selected', b.dataset.size === (cfg.size || 'compact')));
    const anim = ['subtle', 'full', 'off', 'system'].includes(cfg.animation) ? cfg.animation : 'subtle';
    root.querySelectorAll('[data-anim]').forEach(b => b.classList.toggle('is-selected', b.dataset.anim === anim));

    this._syncColours();
    this._aiSync();
  }

  _syncColours() {
    const root = this.shadowRoot, cfg = this._config;
    const surf = { d: SURFACE.dark, l: SURFACE.light };
    COLOR_ROWS.forEach(([k, , def, , optional]) => {
      const own = isHex(cfg[k]) ? cfg[k].trim() : null;
      const base = own || def;
      const inp = root.getElementById(`color_${k}`);
      if (inp) inp.value = /^#[0-9a-f]{6}$/i.test(base) ? base : def;
      const rs = root.getElementById(`reset_${k}`); if (rs) rs.hidden = !own;
      const d = root.getElementById(`pvd_${k}`), l = root.getElementById(`pvl_${k}`);
      if (!d || !l) return;
      d.style.background = surf.d; l.style.background = surf.l;
      if (k === 'active_color' || k === 'inactive_color') {   // adjusted for each theme
        d.style.color = tuneColor(base, true).text; l.style.color = tuneColor(base, false).text;
        d.style.opacity = l.style.opacity = (optional && !own) ? '0.35' : '';
      } else {                                                // used exactly as picked
        d.style.color = l.style.color = own || '';
        if (!own) { d.style.color = '#fff'; l.style.color = '#1c1c1e'; d.style.opacity = l.style.opacity = '0.35'; } else { d.style.opacity = l.style.opacity = ''; }
      }
    });
    root.querySelectorAll('.preset-opt').forEach(b => {
      const pr = COLOR_PRESETS.find(x => x.id === b.dataset.preset);
      const cur = (isHex(cfg.active_color) ? cfg.active_color.trim() : DEFAULT_ACTIVE).toLowerCase();
      const on = cur === pr.colors.active_color.toLowerCase();
      b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // ── AI settings ─────────────────────────────────────────────────
  _aiMarkup() {
    const cfg = this._config;
    const on = cfg.ai_features_enabled === true;
    const tog = (id, label, desc, checked) => `
              <div class="toggle-item">
                <div><div class="toggle-label">${label}</div><div class="toggle-desc">${desc}</div></div>
                <label class="toggle-switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''}><span class="toggle-track"></span></label>
              </div>`;
    return `
        <div>
          <div class="section-title">AI Features <span class="badge-optional">Optional</span></div>
          <div class="card-block">
            <div class="toggle-list">
              ${tog('ai_features_enabled', 'Enable AI features', 'Long-press the card for an actions sheet: Insight, Ask AI, What happened? and This week.', on)}
            </div>
            <div id="ai_rows" style="${on ? '' : 'display:none'}">
              <div class="select-row" style="border-top:1px solid rgba(128,128,128,0.10);">
                <label for="ai_conversation_agent">Conversation agent</label>
                <div class="hint">Set one up in Settings → Voice assistants (e.g. Google Generative AI or OpenAI). AI stays off until you choose one. Nothing is sent until you open one of the sheets.</div>
                <select id="ai_conversation_agent"><option value="">Choose an agent…</option></select>
              </div>
              <div class="toggle-list" style="border-top:1px solid rgba(128,128,128,0.10);">
                ${tog('ai_enable_insight', 'Insight', 'What the light’s current state means, with a tip and a next step', cfg.ai_enable_insight !== false)}
                ${tog('ai_enable_ask', 'Ask AI', 'Type a question about this entity, or tap a suggestion', cfg.ai_enable_ask !== false)}
                ${tog('ai_enable_recap', 'What happened?', 'The latest activity as a timeline, with a short summary', cfg.ai_enable_recap !== false)}
                ${tog('ai_enable_week', 'This week', 'Seven days of history as a few numbers, with a short summary', cfg.ai_enable_week !== false)}
              </div>
            </div>
          </div>
        </div>`;
  }

  // Display-only: never writes config (only the user's own changes do)
  _aiSync() {
    const root = this.shadowRoot, cfg = this._config;
    const chk = (id, v) => { const el = root.getElementById(id); if (el) el.checked = !!v; };
    chk('ai_features_enabled', cfg.ai_features_enabled === true);
    ['ai_enable_insight', 'ai_enable_ask', 'ai_enable_recap', 'ai_enable_week'].forEach(id => chk(id, cfg[id] !== false));
    const rows = root.getElementById('ai_rows');
    if (rows) rows.style.display = cfg.ai_features_enabled === true ? '' : 'none';
    this._aiLoadAgents();
  }

  _aiLoadAgents() {
    const sel = this.shadowRoot.getElementById('ai_conversation_agent');
    if (!sel || !this._hass?.connection) return;
    const saved = this._config.ai_conversation_agent || '';
    if (this._aiAgentsLoaded) {
      if (saved && ![...sel.options].some(o => o.value === saved)) {
        const o = document.createElement('option'); o.value = saved; o.textContent = this._hass.states?.[saved]?.attributes?.friendly_name || saved; sel.appendChild(o);
      }
      sel.value = saved; return;
    }
    this._aiAgentsLoaded = true;
    this._hass.connection.sendMessagePromise({ type: 'conversation/agent/list' }).then(resp => {
      const cur = this._config.ai_conversation_agent || '';
      const agents = (resp?.agents || []).filter(a => {
        const id = (a.id || '').toLowerCase(), nm = (a.name || '').toLowerCase();
        return a.id !== 'conversation.home_assistant' && !id.includes('assistant_sdk') && !id.includes('google_assistant') && !nm.includes('sdk');
      });
      const opts = ['<option value="">Choose an agent…</option>'];
      agents.forEach(a => opts.push(`<option value="${esc(a.id)}">${esc(a.name || a.id)}</option>`));
      if (cur && !agents.some(a => a.id === cur)) opts.push(`<option value="${esc(cur)}">${esc(this._hass.states?.[cur]?.attributes?.friendly_name || cur)}</option>`);   // never let a saved choice vanish
      sel.innerHTML = opts.join('');
      sel.value = cur;
    }).catch(() => { this._aiAgentsLoaded = false; });
  }

  _aiListen() {
    const root = this.shadowRoot, get = id => root.getElementById(id);
    get('ai_features_enabled').addEventListener('change', e => {
      this._set('ai_features_enabled', e.target.checked);
      const rows = get('ai_rows'); if (rows) rows.style.display = e.target.checked ? '' : 'none';
    });
    get('ai_conversation_agent').addEventListener('change', e => this._set('ai_conversation_agent', e.target.value || null));
    ['ai_enable_insight', 'ai_enable_ask', 'ai_enable_recap', 'ai_enable_week'].forEach(id => {
      const el = get(id); if (el) el.addEventListener('change', ev => this._set(id, ev.target.checked));
    });
  }

  // ── Listeners ───────────────────────────────────────────────────
  _attachListeners() {
    const root = this.shadowRoot, $ = id => root.getElementById(id);

    root.querySelectorAll('.layout-opt').forEach(b => b.addEventListener('click', () => this._set('layout', b.dataset.layout)));
    root.querySelectorAll('[data-align]').forEach(b => b.addEventListener('click', () => this._set('text_align', b.dataset.align)));
    root.querySelectorAll('[data-appearance]').forEach(b => b.addEventListener('click', () => this._set('appearance', b.dataset.appearance)));
    root.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => this._set('size', b.dataset.size)));
    root.querySelectorAll('[data-anim]').forEach(b => b.addEventListener('click', () => this._set('animation', b.dataset.anim)));

    ['show_state', 'show_icon', 'use_dynamic_icon', 'slider_enabled', 'follow_light_color'].forEach(id => $(id).addEventListener('change', e => this._set(id, e.target.checked)));
    $('name').addEventListener('input', e => this._set('name', e.target.value));
    $('font_size').addEventListener('input', e => this._set('font_size', `${e.target.value}px`));
    $('card_height').addEventListener('input', e => this._set('card_height', `${e.target.value}px`));
    $('glass').addEventListener('input', e => this._set('glass', parseInt(e.target.value, 10)));

    root.querySelectorAll('.preset-opt').forEach(b => b.addEventListener('click', () => {
      const pr = COLOR_PRESETS.find(x => x.id === b.dataset.preset); if (!pr) return;
      this._config = { ...this._config, ...pr.colors };
      this._dispatch(); this._syncUI();
    }));
    COLOR_ROWS.forEach(([k]) => {
      $(`color_${k}`).addEventListener('input', e => { this._config = { ...this._config, [k]: e.target.value }; this._dispatch(); this._syncColours(); });
      $(`reset_${k}`).addEventListener('click', () => { const c = { ...this._config }; delete c[k]; this._config = c; this._dispatch(); this._syncUI(); });
    });
  }

  _set(key, value) {
    const cfg = { ...this._config, [key]: value };
    if (value === null || value === '' || value === undefined) delete cfg[key];
    this._config = cfg;
    this._dispatch();
    this._syncUI();
  }

  _dispatch() {
    // never write the built-in defaults into the user's YAML — only what they've actually chosen
    const out = { ...this._config };
    Object.entries(CrowLightSliderCard.DEFAULTS).forEach(([k, v]) => { if (out[k] === v && k !== 'entity') delete out[k]; });
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: { type: this._config.type, ...out } }, bubbles: true, composed: true }));
  }
}

// ───────────────────────────────────────────────────────────────────
//  REGISTRATION
// ───────────────────────────────────────────────────────────────────

if (!customElements.get('crow-light-slider-card')) customElements.define('crow-light-slider-card', CrowLightSliderCard);
if (!customElements.get('crow-light-slider-card-editor')) customElements.define('crow-light-slider-card-editor', CrowLightSliderCardEditor);

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'crow-light-slider-card')) {
  window.customCards.push({
    type: 'crow-light-slider-card',
    name: 'Crow Light Slider Card',
    preview: true,
    description: 'A liquid-glass light card — drag sideways to dim, tap the icon to switch, pill, tile or square, coloured lights, your own Home Assistant icon and light and dark themes.',
  });
}

})();
