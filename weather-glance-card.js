/*
 * weather-glance-card: at-a-glance weather for Home Assistant wall panels.
 *
 * Columns (forecast outlook with high/low, current temperature and feels like,
 * then optional humidity, wind and any extra entities) over a UV bar shaded to
 * the day's forecast maximum.
 * Daily forecast sensors are named with a {d} day index (0 today, 1
 * tomorrow); when today's values are gone for the evening the card shows
 * tomorrow's, marked "Tmrw".
 *
 * The UV row is a bar-lines-card (Blazely-Family/bar-lines-card), embedded
 * like any nested card; install that card too. See README.md.
 */

const VERSION = "0.2.1";

const EMPTY = ["unknown", "unavailable", "none", "None", ""];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function stateOf(hass, id) {
  const st = id && hass.states[id];
  return st && !EMPTY.includes(String(st.state)) ? st.state : null;
}

function numOf(hass, id) {
  const v = parseFloat(stateOf(hass, id));
  return Number.isNaN(v) ? null : v;
}

function attrOf(hass, id, a) {
  const st = id && hass.states[id];
  return st ? st.attributes[a] : undefined;
}

// "9:10am" from a timestamp state.
function clock(hass, id) {
  const v = stateOf(hass, id);
  if (!v || Number.isNaN(Date.parse(v))) return "";
  const x = new Date(v);
  let hh = x.getHours();
  const mm = x.getMinutes();
  const ap = hh < 12 ? "am" : "pm";
  hh = hh % 12 || 12;
  return hh + (mm ? ":" + String(mm).padStart(2, "0") : "") + ap;
}

// A colour from config: a Home Assistant colour name ("success", "green",
// "deep-orange" -> var(--<name>-color), as tile cards take them) or any CSS colour.
function cssColor(c) {
  if (!c) return "";
  return /^[a-z][a-z-]*$/.test(c) ? `var(--${c}-color)` : c;
}

function day(id, d) {
  return id ? String(id).replace(/\{d\}/g, d) : id;
}

function moreInfo(el, entityId) {
  if (!entityId) return;
  el.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

class WeatherGlanceCard extends HTMLElement {
  setConfig(config) {
    this._cfg = config || {};
    this._sig = null;
    this._uvSig = null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-card><div class="wg"></div><div class="dv"></div><div class="uv"></div></ha-card>`;
      this.shadowRoot.querySelector("ha-card").addEventListener("click", (ev) => {
        const path = ev.composedPath();
        // The UV bar opens its own entity.
        if (path.some((n) => n.localName === "bar-lines-card")) return;
        const col = path.find((n) => n.dataset && n.dataset.entity);
        moreInfo(this, col ? col.dataset.entity : this._cfg.entity);
      });
    }
    if (this._hass) this._render(true);
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  connectedCallback() {
    // Day rollover and the "Tmrw" switch happen without a state change.
    this._timer = setInterval(() => this._render(), 60000);
  }

  disconnectedCallback() {
    clearInterval(this._timer);
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: "full", rows: 3 };
  }

  static getStubConfig() {
    return { entity: "weather.home" };
  }

  _render(force) {
    const hass = this._hass;
    if (!hass || !this.shadowRoot || !this._cfg) return;
    let html = "";
    try {
      html = this._columns(hass);
    } catch (e) {
      console.warn("weather-glance-card:", e);
    }
    if (force || html !== this._sig) {
      this._sig = html;
      this.shadowRoot.querySelector(".wg").innerHTML = html;
    }
    this._renderUv(hass, force);
  }

  // The UV row: a nested bar-lines-card, rebuilt only when its bar changes.
  _renderUv(hass, force) {
    const box = this.shadowRoot.querySelector(".uv");
    const uv = this._cfg.uv;
    if (!uv || !uv.entity) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const conf = { card: false, bars: [this._uvBar(hass, uv)] };
    const sig = JSON.stringify(conf);
    let el = box.firstElementChild;
    if (!customElements.get("bar-lines-card")) {
      if (!el || el.localName === "bar-lines-card") {
        box.innerHTML = '<div class="missing">Install bar-lines-card for the UV bar</div>';
        customElements.whenDefined("bar-lines-card").then(() => this._render(true));
      }
      return;
    }
    if (!el || el.localName !== "bar-lines-card") {
      box.innerHTML = "";
      el = document.createElement("bar-lines-card");
      box.appendChild(el);
      force = true;
    }
    if (force || sig !== this._uvSig) {
      this._uvSig = sig;
      el.setConfig(conf);
    }
    el.hass = hass;
  }

  _columns(hass) {
    const c = this._cfg;
    const fc = c.forecast || {};
    const r = (v) => (v === null ? "\u2013" : Math.round(v));

    // Outlook: today's forecast, or tomorrow's once today's high is gone.
    const hi0 = numOf(hass, day(fc.high, 0));
    const tmrw = hi0 === null && !!fc.high;
    const d = tmrw ? 1 : 0;
    const hi = tmrw ? numOf(hass, day(fc.high, 1)) : hi0;
    // Today's low also drops once the morning has passed; `low_fallback` covers it.
    const lo = numOf(hass, day(fc.low, d)) ?? (tmrw ? null : numOf(hass, fc.low_fallback));
    const icon = stateOf(hass, day(fc.icon, d)) || "mdi:weather-partly-cloudy";
    const words = (stateOf(hass, day(fc.text, d)) || "").replace(/\.\s*$/, "");

    const t = numOf(hass, c.temperature);
    const fl = numOf(hass, c.feels_like);
    const h = numOf(hass, c.humidity);
    const w = numOf(hass, c.wind);
    const wg = attrOf(hass, c.wind, c.wind_gust_attribute || "gust");
    const wb = attrOf(hass, c.wind, c.wind_bearing_attribute || "bearing");

    const col = (...a) => this._col(...a);
    const cols = [
      ["1.25fr", col(icon, `${r(hi)}\u00b0${lo === null ? "" : `<span class="u"> / ${r(lo)}\u00b0</span>`}`, esc((tmrw ? "Tmrw \u00b7 " : "") + words), c.entity)],
      ["1fr", col("mdi:thermometer", `${t === null ? "\u2013" : t.toFixed(0)}\u00b0`, `Feels ${r(fl)}\u00b0`, c.temperature)],
    ];
    if (c.humidity) cols.push(["1fr", col("mdi:water-percent", `${r(h)}%`, "Humidity", c.humidity)]);
    if (c.wind) cols.push(["1.1fr", col("mdi:weather-windy", `${r(w)}<span class="u"> km/h</span>`, esc(`${wb || ""}${wg != null ? " \u00b7 gusts " + Math.round(wg) : ""}`), c.wind)]);
    // Extra columns size to their words first; the rest share what is left.
    for (const x of [].concat(c.extra || [])) cols.push(["minmax(min-content, 1fr)", this._extra(hass, x)]);
    return `<div class="g" style="grid-template-columns: ${cols.map((x) => x[0]).join(" ")}">` + cols.map((x) => x[1]).join("") + `</div>`;
  }

  _col(ic, val, sub, entity, cls = "", style = "") {
    return `<div class="c${cls}"${entity ? ` data-entity="${esc(entity)}"` : ""}${style ? ` style="${esc(style)}"` : ""}><ha-icon icon="${esc(ic)}"></ha-icon><div class="v">${val}</div><div class="s">${sub}</div></div>`;
  }

  // An extra column: any entity's state as HA formats it, with its name below.
  // `colors` maps a state to a theme colour; `max_age` (hours) greys out a
  // value that hasn't changed for that long.
  _extra(hass, x) {
    const e = typeof x === "string" ? { entity: x } : x || {};
    const st = e.entity && hass.states[e.entity];
    const ok = st && !EMPTY.includes(String(st.state));
    const val = ok ? (hass.formatEntityState ? hass.formatEntityState(st) : st.state) : "\u2013";
    const name = e.name || (st && st.attributes.friendly_name) || e.entity || "";
    const icon = e.icon || (st && st.attributes.icon) || "mdi:information-outline";
    const age = st ? (Date.now() - Date.parse(st.last_changed)) / 3600000 : 0;
    const stale = ok && e.max_age != null && age > Number(e.max_age);
    const colors = e.colors || {};
    const color = ok && !stale ? cssColor(colors[st.state]) : "";
    return this._col(icon, esc(val), esc(name), e.entity, " x" + (stale ? " stale" : ""), color ? `--wg-value-color: ${color}` : "");
  }

  // UV now, shaded to the forecast max, with the forecast's UV window.
  _uvBar(hass, uv) {
    const now = numOf(hass, uv.entity) || 0;
    const m0 = numOf(hass, day(uv.max, 0));
    const tmrw = m0 === null && !!uv.max;
    const d = tmrw ? 1 : 0;
    const mx = tmrw ? numOf(hass, day(uv.max, 1)) : m0;
    const from = clock(hass, day(uv.start, d));
    const to = clock(hass, day(uv.end, d));
    const cat = now < 3 ? "Low" : now < 6 ? "Moderate" : now < 8 ? "High" : now < 11 ? "Very High" : "Extreme";
    return {
      entity: uv.entity,
      name: uv.name || "UV",
      after: "\u00b7 " + cat,
      detail: from && to ? from + " \u2013 " + to : "",
      icon: uv.icon || "mdi:sun-wireless",
      scale: "uv",
      max: 12,
      unit: "",
      decimals: 1,
      forecast: mx,
      forecast_label: tmrw ? "TMRW" : "MAX",
    };
  }
}

const STYLE = `
:host { display: block; height: 100%; }
ha-card { height: 100%; box-sizing: border-box; padding: 10px 12px; display: flex; flex-direction: column; cursor: pointer; }
/* The theme's glass layer, mirrored from Frosted Glass (transparent card, tint
   on ::before; the wall panel screensaver deepens --ha-card-glass-tint), so it
   shows even where the theme's card-mod styles don't reach this card. Same
   pseudo-element as the theme's, so it never doubles up. Other themes: their
   normal card background. */
ha-card { position: relative; isolation: isolate; background: transparent; }
ha-card::before { content: var(--frosted-glass-card-layer-content, ""); position: absolute; inset: 0; z-index: -1; pointer-events: none; border-radius: inherit; background: var(--ha-card-glass-tint, var(--ha-card-background, var(--card-background-color))); }
.wg { flex: 1 1 auto; min-height: 0; overflow: hidden; line-height: normal; container-type: inline-size; display: flex; flex-direction: column; justify-content: space-evenly; color: var(--primary-text-color); }
.wg .g { display: grid; grid-template-columns: 1.25fr 1fr 1fr 1.1fr; text-align: center; }
.wg .c .v { color: var(--wg-value-color, inherit); }
/* Extra columns hold words ("Moderate"), so a step smaller and never spilling into the next column. */
.wg .c.x .v { font-size: var(--ha-font-size-xl, 20px); line-height: var(--ha-line-height-condensed, 1.2); padding-top: 4px; overflow: hidden; text-overflow: ellipsis; }
.wg .c.stale .v, .wg .c.stale ha-icon { color: var(--disabled-text-color, var(--secondary-text-color)); }
.wg .c { min-width: 0; }
.wg ha-icon { --mdc-icon-size: 40px; color: var(--secondary-text-color); margin: 0 auto 2px; display: block; width: 40px; height: 40px; }
.wg .v { font-size: var(--ha-font-size-2xl, 24px); font-weight: var(--ha-font-weight-medium, 500); margin-top: 2px; white-space: nowrap; }
.wg .u { font-size: var(--ha-font-size-s, 12px); font-weight: var(--ha-font-weight-normal, 400); color: var(--secondary-text-color); }
.wg .s { font-size: var(--ha-font-size-s, 12px); color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
/* The divider sits outside the clipped columns so it always shows. */
.dv { flex: none; border-top: 1px solid var(--divider-color, rgba(234, 235, 238, 0.12)); margin: 12px 6px 0; }
@container (max-width: 340px) {
  .wg ha-icon { --mdc-icon-size: 30px; width: 30px; height: 30px; }
  .wg .v { font-size: var(--ha-font-size-l, 16px); }
}
.uv { flex: none; min-width: 0; margin: 8px 6px 7px; }
.uv[hidden] { display: none; }
.missing { font-size: var(--ha-font-size-s, 12px); color: var(--secondary-text-color); }
`;

if (!customElements.get("weather-glance-card")) {
  customElements.define("weather-glance-card", WeatherGlanceCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "weather-glance-card",
    name: "Weather glance",
    description: "Outlook, temperature, optional humidity, wind and extra entities, and a UV bar at a glance.",
  });
  console.info(`%c WEATHER-GLANCE-CARD %c ${VERSION} `, "background:#3a7ca5;color:#fff", "");
}
