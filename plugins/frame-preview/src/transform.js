const SWISS_MAP = { left: 5.9, top: 47.85, xScale: 165, yScale: 240 };
const NOTICE_STYLES = {
  alert: { label: 'Alert', ink: '#ac1428', fill: '#f47070', tint: '#ffe0e3', rank: 5 },
  warning: { label: 'Warning', ink: '#8e4700', fill: '#ffcb42', tint: '#fff1b7', rank: 4 },
  information: { label: 'Information', ink: '#145594', fill: '#7bbce9', tint: '#dceefa', rank: 3 },
  other: { label: 'Notice', ink: '#455660', fill: '#aeb9bd', tint: '#e9eff0', rank: 2 },
  allClear: { label: 'All-clear', ink: '#176842', fill: '#87d19b', tint: '#dcf3df', rank: 1 }
};
const SWISS_CANTONS = new Set('AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH'.split(' '));

function noticeStyle(alert) {
  if (alert.allClear === true) return NOTICE_STYLES.allClear;
  switch (String(alert.severity ?? '').toLowerCase()) {
    case 'extreme':
    case 'severe': return NOTICE_STYLES.alert;
    case 'moderate': return NOTICE_STYLES.warning;
    case 'minor': return NOTICE_STYLES.information;
    default: return NOTICE_STYLES.other;
  }
}

function project(lon, lat) {
  return [
    Math.round((lon - SWISS_MAP.left) * SWISS_MAP.xScale + 24),
    Math.round((SWISS_MAP.top - lat) * SWISS_MAP.yScale + 18)
  ];
}

function point(pair) {
  if (!Array.isArray(pair) || pair.length !== 2 ||
      pair.some(value => typeof value !== 'number' &&
        (typeof value !== 'string' || value.trim() === ''))) return null;
  const [lat, lon] = pair.map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return project(lon, lat);
}

function ring(coordinates) {
  if (!Array.isArray(coordinates)) return null;
  const projected = [];
  for (const coordinate of coordinates) {
    const xy = point(coordinate);
    if (!xy) return null;
    const previous = projected[projected.length - 1];
    if (!previous || xy[0] !== previous[0] || xy[1] !== previous[1]) projected.push(xy);
  }
  if (projected.length > 1 && String(projected[0]) === String(projected[projected.length - 1])) {
    projected.pop();
  }
  if (projected.length < 3) return null;
  return { path: 'M' + projected.join('L') + 'Z', points: projected };
}

function mapAlert(alert) {
  const shapes = [];
  let anchor = null;
  let largest = 0;
  for (const area of Array.isArray(alert.areas) ? alert.areas : []) {
    for (const poly of Array.isArray(area?.polygons) ? area.polygons : []) {
      const outer = ring(poly?.coordinates);
      if (!outer) {
        if (!anchor && Array.isArray(poly?.coordinates)) anchor = poly.coordinates.map(point).find(Boolean);
        continue;
      }
      const holes = (Array.isArray(poly.excludes) ? poly.excludes : [])
        .map(hole => ring(hole?.coordinates ?? hole)).filter(Boolean);
      const path = outer.path + holes.map(hole => hole.path).join('');
      shapes.push({ path });
      const xs = outer.points.map(xy => xy[0]);
      const ys = outer.points.map(xy => xy[1]);
      const left = Math.min(...xs), right = Math.max(...xs);
      const top = Math.min(...ys), bottom = Math.max(...ys);
      const size = (right - left) * (bottom - top);
      if (!anchor || size > largest) {
        largest = size;
        anchor = [(left + right) / 2, (top + bottom) / 2];
      }
    }
    for (const circle of Array.isArray(area?.circles) ? area.circles : []) {
      const center = point(circle?.centerPosition);
      const radius = Number(circle?.radius);
      if (!center || !Number.isFinite(radius) || radius <= 0) continue;
      // Alertswiss circle radii are in kilometres. This projection is ~2.16 SVG units/km.
      const rx = Math.round(radius * SWISS_MAP.xScale /
        (111.32 * Math.cos(Number(circle.centerPosition[0]) * Math.PI / 180)) * 10) / 10;
      const ry = Math.round(radius * SWISS_MAP.yScale / 111.32 * 10) / 10;
      if (rx > 0 && ry > 0) shapes.push({ cx: center[0], cy: center[1], rx, ry });
      if (!anchor || rx * ry * 4 > largest) {
        largest = rx * ry * 4;
        anchor = center;
      }
    }
  }
  if (anchor && (anchor[0] < 0 || anchor[0] > 800 || anchor[1] < 0 || anchor[1] > 530)) {
    anchor = null;
  }
  return { shapes, anchor };
}

function placeMarkers(alerts) {
  const placed = [];
  const offsets = [[0, 0], [24, -24], [24, 24], [-24, 24], [-24, -24],
    [46, 0], [0, 46], [-46, 0], [0, -46]];
  for (const alert of alerts) {
    if (!alert.anchor) continue;
    const [x, y] = alert.anchor;
    const candidates = offsets.map(([dx, dy]) => [
      Math.round(Math.max(45, Math.min(775, x + dx))),
      Math.round(Math.max(35, Math.min(505, y + dy)))
    ]);
    const [mx, my] = candidates.find(([px, py]) =>
      placed.every(([ax, ay]) => Math.hypot(px - ax, py - ay) >= 31)) ?? candidates[0];
    placed.push([mx, my]);
    alert.marker = { x, y, mx, my };
    delete alert.anchor;
  }
}

function demoAlerts() {
  return [
    {
      severity: 'severe', title: { title: 'River flooding near Sargans' },
      description: { description: 'The exercise area covers low-lying ground in the Rhine valley.' },
      instructions: [{ text: 'Example instruction: avoid the riverbank.' }],
      areas: [{ description: { description: 'Sargans area' }, regions: [{ region: 'SG' }],
        polygons: [{ coordinates: [[47.095, 9.385], [47.145, 9.47], [47.125, 9.55],
          [47.053, 9.49], [47.055, 9.41], [47.095, 9.385]] }] }]
    },
    {
      severity: 'moderate', title: { title: 'Boil-water exercise' },
      description: { description: 'A small example zone shows how local notices appear on the map.' },
      areas: [{ description: { description: 'Hasle bei Burgdorf' }, regions: [{ region: 'BE' }],
        circles: [{ centerPosition: [47.014, 7.656], radius: 1.2 }] }]
    },
    {
      severity: 'minor', title: { title: 'Road closure exercise' },
      description: { description: 'An example information notice in the Rhône valley.' },
      areas: [{ description: { description: 'Sion area' }, regions: [{ region: 'VS' }],
        circles: [{ centerPosition: [46.233, 7.36], radius: 11 }] }]
    },
    { severity: 'minor', nationWide: true, title: { title: 'Nationwide exercise notice' },
      description: { description: 'Nationwide notices are included with every canton filter.' } },
    {
      allClear: true, title: { title: 'Exercise ended near Payerne' },
      description: { description: 'This sample shows how the map marks an all-clear.' },
      areas: [{ description: { description: 'Payerne area' }, regions: [{ region: 'VD' }],
        circles: [{ centerPosition: [46.822, 6.937], radius: 3 }] }]
    }
  ];
}

function run(input) {
  return transform(input);
}

function transform(input) {
  const payload = input.merge_variables?.IDX_0 ?? input.IDX_0 ??
    (Array.isArray(input.merge_variables?.alerts) ? input.merge_variables : input);
  const settings = input.trmnl?.plugin_settings?.custom_fields_values ?? {};
  const mode = String(settings.preview_mode || 'demo').toLowerCase();
  const demo = mode !== 'live';
  const rawAlerts = {
    demo: demoAlerts,
    empty: () => [],
    unavailable: () => null,
    live: () => payload?.alerts
  };
  const alerts = Object.hasOwn(rawAlerts, mode) ? rawAlerts[mode]() : demoAlerts();
  const available = Array.isArray(alerts);

  const cantonsRaw =
    settings.cantons ?? "";
  const cantons = String(cantonsRaw)
    .toUpperCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const showAll = cantons.includes("CH"); // <-- CH means: no canton filtering

  const limitRaw =
    settings.limit ?? 7;
  const limit = Math.max(1, Math.min(20, Number(limitRaw) || 7));

  const clean = (s) =>
    String(s ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const oneLine = (s) => clean(s).replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();

  const pick = (...vals) => {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v === "object") {
        if (typeof v.title === "string" && v.title.trim()) return v.title.trim();
        if (typeof v.description === "string" && v.description.trim()) return v.description.trim();
        if (typeof v.text === "string" && v.text.trim()) return v.text.trim();
      }
    }
    return "";
  };

  const getAlertRegions = (a) => {
    const regions = new Set();
    const areas = Array.isArray(a?.areas) ? a.areas : [];
    for (const area of areas) {
      const rs = Array.isArray(area?.regions) ? area.regions : [];
      for (const r of rs) {
        const code = String(r?.region ?? "").toUpperCase().trim();
        if (code) regions.add(code);
      }
    }
    return [...regions];
  };

  const matchesCanton = (a) => {
    if (a?.nationWide === true) return true;     // always include nationwide
    if (showAll) return true;                    // CH => show all cantons
    if (!cantons.length) return true;            // empty => show all (optional behavior)

    const regs = getAlertRegions(a);
    if (!regs.length) return false;
    return regs.some(r => cantons.includes(r));
  };

  const matching = available ? alerts.filter(a => a && typeof a === 'object' && matchesCanton(a)) : [];
  const cantonLevels = new Map();
  let nationwideCount = 0;
  let hasOtherLevel = false;
  for (const alert of matching) {
    const style = noticeStyle(alert);
    if (style === NOTICE_STYLES.other) hasOtherLevel = true;
    if (alert.nationWide === true) {
      nationwideCount += 1;
      continue;
    }
    for (const code of getAlertRegions(alert)) {
      if (SWISS_CANTONS.has(code) && style.rank > (cantonLevels.get(code)?.rank ?? 0)) {
        cantonLevels.set(code, style);
      }
    }
  }
  const cantonColors = Object.fromEntries([...cantonLevels].map(([code, style]) => [code, style.fill]));
  const filtered = matching.slice(0, Math.min(5, Math.floor(limit)));

  const normalized = filtered.map((a, index) => {
    const regions = getAlertRegions(a);
    const regionCode = a?.nationWide === true ? "CH" : (regions[0] || "");

    const firstArea = Array.isArray(a.areas) && a.areas.length ? a.areas[0] : null;
    const areaName = pick(firstArea?.description, a.area_label, a.area);

    const title = pick(a.title, a.headline, a.message, a.text) || "Alert";
    const description = oneLine(pick(a.description, a.summary, a.details));

    const instructionLines = Array.isArray(a.instructions)
      ? a.instructions.map(i => clean(i?.text)).filter(Boolean)
      : [];

    const nationwide = a.nationWide === true;
    const { label: levelLabel, ink: color, tint } = noticeStyle(a);
    const { shapes, anchor } = nationwide ? { shapes: [], anchor: null } : mapAlert(a);

    return {
      number: index + 1,
      levelLabel,
      color,
      tint,
      nationwide,
      isTest: a.testAlert === true || a.technicalTestAlert === true,
      shapes,
      anchor,
      title,
      description,
      instructions: instructionLines,     // array of strings
      event: String(a.event ?? "").trim(),
      region: regionCode ? (areaName ? `${regionCode}: ${areaName}` : regionCode) : areaName
    };
  });

  placeMarkers(normalized);
  return { data: {
    cantons, limit, showAll, alerts: normalized, available, demo, cantonColors, nationwideCount, hasOtherLevel,
    scope: showAll || cantons.length === 0 ? 'All Switzerland' : cantons.join(', '),
    hidden: matching.length - normalized.length,
    snapshotCheckedAt: !demo && typeof payload?.checked_at === 'string' ? payload.checked_at : ''
  } };
}
