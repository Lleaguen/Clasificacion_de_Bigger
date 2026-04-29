import * as XLSX from "xlsx";

export const exportToExcel = (data, filename = "audit.xlsx") => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Audit");
  XLSX.writeFile(workbook, filename);
};

export const exportComparacion = (comparisonBySeller, filename = "comparacion.xlsx") => {
  const workbook = XLSX.utils.book_new();
  Object.entries(comparisonBySeller).forEach(([seller, items]) => {
    const rows = items.map((r) => ({
      "Shipment ID":     r.shipmentId,
      "Seller ID":       seller,
      "Inbound Date":    r.inboundDate || "",
      "Weight":          r.weight,
      "Length":          r.length,
      "Height":          r.height,
      "Width":           r.width,
      "Description":     r.description || "",
      "Categoría Final": r.categoryFinal || "—",
      "Motivo":          r.reason || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, ws, String(seller).slice(0, 31));
  });
  XLSX.writeFile(workbook, filename);
};

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const raw = String(dateStr);
  const parts = raw.includes("/") ? raw.split("/") : raw.split("-");
  if (parts[0].length === 4) return new Date(raw);
  if (parseInt(parts[1]) > 12) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
  return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
};

const inRange = (dateStr, from, to) => {
  if (!from && !to) return true;
  const d = parseDate(dateStr);
  if (!d || isNaN(d)) return true; // sin fecha → siempre incluir
  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
};

/**
 * Export final en una sola hoja:
 * 1. Todo Bigger TMS — si el shipment está en Comparación, se reemplaza con datos de PYM
 * 2. Shipments de Comparación que NO estaban en Bigger TMS (TMS no los detectó)
 * 3. Shipments del 3er archivo matcheados por descripción (no duplicados)
 * Filtrado por rango de fechas si se provee.
 */
export const exportFinal = (biggerBySeller, comparisonBySeller, descMatchMap, dateFrom, dateTo, filename = "bigger_final.xlsx") => {
  console.log("exportFinal - biggerBySeller sellers:", Object.keys(biggerBySeller).length);
  console.log("exportFinal - comparisonBySeller sellers:", Object.keys(comparisonBySeller).length);
  console.log("exportFinal - comparisonBySeller sample:", Object.entries(comparisonBySeller).slice(0,2).map(([s,i]) => `${s}: ${i.length} items`));
  console.log("exportFinal - from:", dateFrom, "to:", dateTo);
  // Mostrar inboundDate de los primeros items de comparación
  const firstCompItems = Object.values(comparisonBySeller)[0] || [];
  console.log("exportFinal - comp items inboundDate sample:", firstCompItems.slice(0,3).map(r => r.inboundDate));
  const compMap = new Map();
  for (const items of Object.values(comparisonBySeller)) {
    for (const r of items) compMap.set(String(r.shipmentId).trim(), r);
  }

  const from = dateFrom ? new Date(dateFrom) : null;
  const to   = dateTo   ? new Date(dateTo)   : null;

  const includedIds = new Set();
  const rows = [];

  // 1. Bigger TMS — reemplazar con Comparación si existe
  for (const [seller, items] of Object.entries(biggerBySeller)) {
    for (const tms of items) {
      const id  = String(tms.shipmentId).trim();
      const comp = compMap.get(id);
      const rec  = comp ?? tms;
      const inboundDate = tms.inboundDate ?? "";

      if (!inRange(inboundDate, from, to)) continue;

      includedIds.add(id);
      rows.push({
        "Shipment ID":  id,
        "Seller ID":    seller,
        "Inbound Date": inboundDate,
        "Weight":       rec.weight,
        "Length":       rec.length,
        "Height":       rec.height,
        "Width":        rec.width,
        "Description":  rec.description || "",
        "Categoría":    comp ? `${comp.categoryFinal} por sistema` : `${tms.category} por sistema`,
        "Motivo":       comp ? comp.reason : "",
      });
    }
  }

  // 2. Comparación: shipments que TMS no detectó (no estaban en Bigger TMS)
  for (const [seller, items] of Object.entries(comparisonBySeller)) {
    for (const r of items) {
      const id = String(r.shipmentId).trim();
      console.log("COMP item:", id, "already included:", includedIds.has(id), "category:", r.categoryFinal);
      if (includedIds.has(id)) continue;

      const inboundDate = r.inboundDate ?? "";
      if (!inRange(inboundDate, from, to)) continue;

      includedIds.add(id);
      rows.push({
        "Shipment ID":  id,
        "Seller ID":    seller,
        "Inbound Date": inboundDate,
        "Weight":       r.weight,
        "Length":       r.length,
        "Height":       r.height,
        "Width":        r.width,
        "Description":  r.description || "",
        "Categoría":    `${r.categoryFinal} por sistema`,
        "Motivo":       r.reason || "",
      });
    }
  }

  // 3. Matcheo por descripción (3er archivo)
  for (const [shipId, match] of (descMatchMap || new Map())) {
    if (includedIds.has(shipId)) continue;

    const inboundDate = match.tmsRecord?.inboundDate ?? "";
    const seller      = match.tmsRecord?.sellerId    ?? "UNKNOWN";

    if (!inRange(inboundDate, from, to)) continue;

    rows.push({
      "Shipment ID":  shipId,
      "Seller ID":    seller,
      "Inbound Date": inboundDate,
      "Weight":       match.weight ?? match.tmsRecord?.weight ?? "",
      "Length":       match.length ?? match.tmsRecord?.length ?? "",
      "Height":       match.height ?? match.tmsRecord?.height ?? "",
      "Width":        match.width  ?? match.tmsRecord?.width  ?? "",
      "Description":  match.description,
      "Categoría":    `${match.category} por descripción`,
      "Motivo":       "Clasificado por descripción similar",
    });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bigger Final");
  XLSX.writeFile(wb, filename);
};
