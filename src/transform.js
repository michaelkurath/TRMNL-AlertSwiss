function transform(input) {
  const payload = input.merge_variables?.IDX_0 ?? input.IDX_0 ?? input;
  const rawAlerts = payload?.alerts ?? [];

  const cantonsRaw =
    input.trmnl?.plugin_settings?.custom_fields_values?.cantons ?? "";
  const cantons = String(cantonsRaw)
    .toUpperCase()
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const showAll = cantons.includes("CH"); // <-- CH means: no canton filtering

  const limitRaw =
    input.trmnl?.plugin_settings?.custom_fields_values?.limit ?? 7;
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

  const filtered = Array.isArray(rawAlerts)
    ? rawAlerts.filter(matchesCanton).slice(0, limit)
    : [];

  const normalized = filtered.map((a) => {
    const regions = getAlertRegions(a);
    const regionCode = a?.nationWide === true ? "CH" : (regions[0] || "");

    const firstArea = Array.isArray(a.areas) && a.areas.length ? a.areas[0] : null;
    const areaName = pick(firstArea?.description, a.area_label, a.area);

    const title = pick(a.title, a.headline, a.message, a.text) || "Alert";
    const description = oneLine(pick(a.description, a.summary, a.details));

    const instructionLines = Array.isArray(a.instructions)
      ? a.instructions.map(i => clean(i?.text)).filter(Boolean)
      : [];

    return {
      title,
      description,
      instructions: instructionLines,     // array of strings
      event: String(a.event ?? "").trim(),
      region: regionCode ? (areaName ? `${regionCode}: ${areaName}` : regionCode) : areaName
    };
  });

  return { data: { cantons, limit, showAll, alerts: normalized } };
}
