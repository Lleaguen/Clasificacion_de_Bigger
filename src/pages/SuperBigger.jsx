import { useState, useMemo, useCallback, memo } from "react";
import PageWrapper from "../components/PageWrapper";
import { parseCSVFile } from "../utils/csvParser";
import { parseXLSXFile } from "../utils/xlsxParser";
import { exportFinal } from "../utils/exportExcel";

/* ---------- clasificación ----------
   Peso en gramos → kg. Dimensiones en cm.
------------------------------------------------ */
function classify(row) {
  const weightKg = (Number(row.weight) || 0) / 1000;
  const maxDim   = Math.max(Number(row.length) || 0, Number(row.height) || 0, Number(row.width) || 0);
  if (weightKg > 50 || maxDim > 200) return "SUPER BIGGER";
  if (weightKg > 30 || maxDim > 150) return "BIGGER";
  return null;
}

const BADGE = {
  "SUPER BIGGER": "bg-red-500/20 text-red-400 border border-red-500/40",
  "BIGGER":       "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
};

/* ---------- Tabla virtualizada simple ----------
   Solo renderiza las primeras PAGE_SIZE filas + botón "cargar más"
   Evita pintar miles de <tr> de golpe.
------------------------------------------------ */
const PAGE_SIZE = 200;

const VirtualTable = memo(function VirtualTable({ rows, columns }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = rows.slice(0, limit);

  return (
    <>
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400 text-[11px] uppercase bg-white/5">
          <tr>
            {columns.map((c) => <th key={c.key} className="p-3">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {visible.map((r, i) => (
            <tr key={i} className="border-t border-white/10 hover:bg-white/5">
              {columns.map((c) => (
                <td key={c.key} className={`p-3 ${c.mono ? "font-mono" : ""}`}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <button
          onClick={() => setLimit((l) => l + PAGE_SIZE)}
          className="w-full py-2 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10"
        >
          Mostrar más ({rows.length - limit} restantes)
        </button>
      )}
    </>
  );
});

/* ---------- Acordeón de seller ---------- */
const SellerAccordion = memo(function SellerAccordion({ seller, items, isOpen, onToggle, columns }) {
  const superCount  = useMemo(() => items.filter((r) => (r.category || r.categoryFinal) === "SUPER BIGGER").length, [items]);
  const biggerCount = useMemo(() => items.filter((r) => (r.category || r.categoryFinal) === "BIGGER").length, [items]);

  return (
    <div className="mb-2 rounded-lg border border-white/10 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 text-left"
      >
        <span className="font-bold text-sm">{seller}</span>
        <div className="flex gap-2 items-center">
          {superCount > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE["SUPER BIGGER"]}`}>
              Super Bigger: {superCount}
            </span>
          )}
          {biggerCount > 0 && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE["BIGGER"]}`}>
              Bigger: {biggerCount}
            </span>
          )}
          <span className="text-slate-500 text-xs">{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>
      {isOpen && <VirtualTable rows={items} columns={columns} />}
    </div>
  );
});

/* ---------- Columnas reutilizables ---------- */
const COLS_BIGGER = [
  { key: "shipmentId", label: "Shipment ID", mono: true },
  { key: "weight",     label: "Weight" },
  { key: "length",     label: "Length" },
  { key: "height",     label: "Height" },
  { key: "width",      label: "Width" },
  { key: "category",   label: "Categoría", render: (r) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE[r.category]}`}>{r.category}</span>
  )},
];

const COLS_COMP = [
  { key: "shipmentId",    label: "Shipment ID", mono: true },
  { key: "inboundDate",   label: "Inbound Date" },
  { key: "weight",        label: "Weight" },
  { key: "length",        label: "Length" },
  { key: "height",        label: "Height" },
  { key: "width",         label: "Width" },
  { key: "description",   label: "Description", render: (r) => r.description || "—" },
  { key: "categoryFinal", label: "Categoría", render: (r) => r.categoryFinal
    ? <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE[r.categoryFinal]}`}>{r.categoryFinal}</span>
    : <span className="text-slate-600 text-[10px]">—</span>
  },
  { key: "reason", label: "Motivo", render: (r) => (
    <span className="text-[10px] text-slate-400">{r.reason}</span>
  )},
];

/* ============================================================ */
export default function SuperBigger() {
  const [tmsData, setTmsData]         = useState([]);
  const [pymData, setPymData]         = useState([]);
  const [activeTab, setActiveTab]     = useState("tms");
  const [openSeller, setOpenSeller]   = useState(null);
  const [openSellerComp, setOpenSellerComp] = useState(null);
  const [loadingTms, setLoadingTms]   = useState(false);
  const [loadingPym, setLoadingPym]   = useState(false);
  const [descData, setDescData]       = useState([]); // 3er archivo: shipment + descripción
  const [loadingDesc, setLoadingDesc] = useState(false);
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");

  /* ---------------- CSV → TMS ---------------- */
  const handleCSV = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoadingTms(true);
    try {
      const parsed = await parseCSVFile(file);
      setTmsData(
        parsed.map((r) => ({
          shipmentId:  String(r["Shipment ID"] ?? ""),
          weight:      r["Weight"]    ?? "",
          height:      r["Height"]    ?? "",
          length:      r["Length"]    ?? "",
          width:       r["Width"]     ?? "",
          sellerId:    String(r["Seller ID"] ?? ""),
          inboundDate: r["Inbound Date Included"] ?? r["INBOUND DATE INCLUDED"] ?? r["Inbound date included"] ?? r["Inbound Date"] ?? r["INBOUND DATE"] ?? "",
        }))
      );
    } finally {
      setLoadingTms(false);
    }
  }, []);

  /* ---------------- XLSX → PYM ---------------- */
/*  const handleXLSX = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoadingPym(true);
    try {
      const parsed = await parseXLSXFile(file);
      setPymData(
        parsed.map((r) => ({
          shipmentId:  String(r["Shipment ID"] ?? r["SHIPMENT ID"] ?? r["shipment_id"] ?? ""),
          weight:      r["Weight"]      ?? r["WEIGHT"]      ?? "",
          height:      r["Height"]      ?? r["HEIGHT"]      ?? "",
          length:      r["Length"]      ?? r["LENGTH"]      ?? "",
          width:       r["Width"]       ?? r["WIDTH"]        ?? "",
          description: r["Description"] ?? r["DESCRIPTION"] ?? r["Descripcion"] ?? r["DESCRIPCION"] ?? "",
        }))
      );
    } finally {
      setLoadingPym(false);
    }
  }, []);*/
   const handleXLSX = useCallback(async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setLoadingPym(true);

  try {
    const parsed = await parseXLSXFile(file);

    const toNumber = (val) => {
      const num = parseFloat(String(val).replace(/[^\d.-]/g, ""));
      return isNaN(num) ? 0 : num;
    };

    const normalized = parsed.map((r) => ({
      shipmentId: String(
        r["SHIPMENT ID"] ??
        r["SHIPMENT"] ??
        r["shipment_id"] ??
        ""
      ).trim(),

      weight: toNumber(r["peso real"] ?? r["PESO"] ?? r["Weight"] ?? r["WEIGHT"]),
      height: toNumber(r["L3-Real"] ?? r["Height"]),
      length: toNumber(r["L1-Real"] ?? r["Length"]),
      width:  toNumber(r["L2-Real"] ?? r["Width"]),

      description:
        r["DESCRIPCION"] ??
        r["Description"] ??
        r["DESCRIPTION"] ??
        r["Descripcion"] ??
        "",
    })).filter((r) => r.shipmentId !== "" && r.shipmentId !== "0");

    console.log("RAW XLSX:", parsed[0]);
    console.log("NORMALIZED XLSX:", normalized[0]);

    setPymData(normalized);
  } finally {
    setLoadingPym(false);
  }
}, []);

  /* ---------------- XLSX → Descripcion (3er archivo) ---------------- */
  const handleDesc = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoadingDesc(true);
    try {
      const parsed = await new Promise((resolve, reject) => {
        const Papa = require("papaparse");
        Papa.parse(file, {
          header: true,
          delimiter: ",",
          skipEmptyLines: true,
          worker: true,
          complete: (r) => resolve(r.data),
          error: reject,
        });
      });
      setDescData(
        parsed
          .map((r) => ({
            shipmentId:  String(r["Shipment"] ?? r["Shipment ID"] ?? r["SHIPMENT"] ?? r["shipment_id"] ?? "").trim(),
            description: String(r["Descripcion"] ?? r["Description"] ?? r["DESCRIPTION"] ?? r["DESCRIPCION"] ?? "").trim(),
          }))
          .filter((r) => r.shipmentId !== "" && r.shipmentId !== "0")
      );
    } finally {
      setLoadingDesc(false);
    }
  }, []);

  /* ---------- Bigger TMS ---------- */
  const biggerBySeller = useMemo(() => {
    const map = {};
    for (const r of tmsData) {
      const cat = classify(r);
      if (!cat) continue;
      const seller = r.sellerId || "UNKNOWN";
      (map[seller] ??= []).push({ ...r, category: cat });
    }
    return map;
  }, [tmsData]);

  /* ---------- Comparación ----------
     Flujo:
     1. Para cada pieza de PYM que clasifica como BIGGER o SUPER BIGGER:
        a. Buscar en Bigger TMS
           - Si está y categoría coincide → ignorar
           - Si está como BIGGER pero PYM dice SUPER BIGGER → Comparación
        b. Si NO está en Bigger TMS → buscar en TMS crudo
           - Si está → clasificar con datos PYM → Comparación
     Seller e inboundDate siempre de TMS crudo.
  ------------------------------------------------ */
  const comparisonBySeller = useMemo(() => {
    const tmsMap = new Map(tmsData.map((r) => [String(r.shipmentId).trim(), r]));

    const biggerTmsMap = new Map();
    for (const items of Object.values(biggerBySeller)) {
      for (const r of items) biggerTmsMap.set(String(r.shipmentId).trim(), r.category);
    }

    const map = {};

    for (const pym of pymData) {
      const catPym = classify(pym);
      if (!catPym) continue;

      const id  = String(pym.shipmentId).trim();
      const tms = tmsMap.get(id);
      if (!tms) continue;

      const seller       = tms.sellerId || "UNKNOWN";
      const inboundDate  = tms.inboundDate ?? "";
      const catBiggerTms = biggerTmsMap.get(id);

      let reason;
      if (catBiggerTms) {
        if (catBiggerTms === catPym) continue;
        if (catBiggerTms === "BIGGER" && catPym === "SUPER BIGGER") {
          reason = "Recategorizado: BIGGER → SUPER BIGGER";
        } else {
          continue;
        }
      } else {
        reason = "TMS no lo clasificó como Bigger";
      }

      (map[seller] ??= []).push({
        shipmentId:    pym.shipmentId,
        seller,
        weight:        pym.weight,
        length:        pym.length,
        height:        pym.height,
        width:         pym.width,
        description:   pym.description,
        inboundDate,
        categoryFinal: catPym,
        reason,
      });
    }

    return map;
  }, [pymData, tmsData, biggerBySeller]);

  /* ---------- Función auxiliar para parsear fechas ---------- */
  const parseInboundDate = useCallback((dateStr) => {
    if (!dateStr) return null;
    const raw = String(dateStr);
    const parts = raw.includes("/") ? raw.split("/") : raw.split("-");
    if (parts[0].length === 4) return new Date(raw);
    else if (parseInt(parts[1]) > 12) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    else return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
  }, []);

  /* ---------- Comparación filtrada por fechas ---------- */
  const filteredComparisonBySeller = useMemo(() => {
    if (!dateFrom && !dateTo) return comparisonBySeller;
    const filtered = {};
    for (const [seller, items] of Object.entries(comparisonBySeller)) {
      const filteredItems = items.filter((r) => {
        if (!r.inboundDate) return false;
        const d = parseInboundDate(r.inboundDate);
        if (!d || isNaN(d)) return true;
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo   && d > new Date(dateTo))   return false;
        return true;
      });
      if (filteredItems.length > 0) filtered[seller] = filteredItems;
    }
    return filtered;
  }, [comparisonBySeller, dateFrom, dateTo, parseInboundDate]);

  /* ---------- Matcheo por descripción (3er archivo) ----------
     Para cada shipment en TMS que NO clasifica como Bigger y NO está en PYM,
     si su descripción (del 3er archivo) coincide con la descripción de un shipment
     que SÍ clasifica como Bigger/Super Bigger → incluirlo con esa categoría.
     Resultado: mapa { shipmentId → { category, description } }
  ------------------------------------------------ */
  const descMatchMap = useMemo(() => {
    if (!descData.length) return new Map();

    // Mapa shipmentId → descripción del 3er archivo
    const descById = new Map(descData.map((r) => [String(r.shipmentId).trim(), r.description]));

    // Mapa descripción → { category, sourceRecord } (de shipments que SÍ clasifican en TMS o PYM)
    const catByDesc = new Map();

    // Primero cargar categorías de Bigger TMS
    for (const items of Object.values(biggerBySeller)) {
      for (const r of items) {
        const desc = descById.get(String(r.shipmentId).trim());
        if (desc) {
          const existing = catByDesc.get(desc);
          if (!existing || (existing.category === "BIGGER" && r.category === "SUPER BIGGER")) {
            catByDesc.set(desc, { category: r.category, sourceRecord: r });
          }
        }
      }
    }

    // Luego cargar categorías de Comparación (PYM reclasifica)
    for (const items of Object.values(comparisonBySeller)) {
      for (const r of items) {
        const desc = descById.get(String(r.shipmentId).trim());
        if (desc) {
          const existing = catByDesc.get(desc);
          if (!existing || (existing.category === "BIGGER" && r.categoryFinal === "SUPER BIGGER")) {
            catByDesc.set(desc, { category: r.categoryFinal, sourceRecord: r });
          }
        }
      }
    }

    // Para cada shipment del 3er archivo, ver si su descripción tiene categoría conocida
    const result = new Map();
    const tmsById = new Map(tmsData.map((r) => [String(r.shipmentId).trim(), r]));
    for (const [shipId, desc] of descById) {
      const match = catByDesc.get(desc);
      if (match) {
        const src = match.sourceRecord;
        result.set(shipId, {
          category:    match.category,
          description: desc,
          tmsRecord:   tmsById.get(shipId),
          // medidas del shipment fuente que clasificó
          weight: src.weight,
          length: src.length,
          height: src.height,
          width:  src.width,
        });
      }
    }

    return result;
  }, [descData, biggerBySeller, comparisonBySeller, tmsData]);

  const TAB_CLASS = (tab) =>
    `px-5 py-2 rounded-t font-semibold text-sm transition ${
      activeTab === tab ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  const biggerCount      = useMemo(() => {
    const ids = new Set();
    // Bigger TMS
    for (const items of Object.values(biggerBySeller))
      for (const r of items) if (r.category === "BIGGER") ids.add(String(r.shipmentId).trim());
    // Comparación: los que PYM reclasificó como BIGGER (no los que subieron a SUPER BIGGER)
    for (const items of Object.values(comparisonBySeller))
      for (const r of items) if (r.categoryFinal === "BIGGER") ids.add(String(r.shipmentId).trim());
    // Descripción
    for (const [id, m] of descMatchMap)
      if (m.category === "BIGGER") ids.add(id);
    return ids.size;
  }, [biggerBySeller, comparisonBySeller, descMatchMap]);

  const superBiggerCount = useMemo(() => {
    const ids = new Set();
    // Bigger TMS (los que ya eran SUPER BIGGER en TMS)
    for (const items of Object.values(biggerBySeller))
      for (const r of items) if (r.category === "SUPER BIGGER") ids.add(String(r.shipmentId).trim());
    // Comparación: reclasificados como SUPER BIGGER por PYM
    for (const items of Object.values(comparisonBySeller))
      for (const r of items) if (r.categoryFinal === "SUPER BIGGER") ids.add(String(r.shipmentId).trim());
    // Descripción
    for (const [id, m] of descMatchMap)
      if (m.category === "SUPER BIGGER") ids.add(id);
    return ids.size;
  }, [biggerBySeller, comparisonBySeller, descMatchMap]);

  const TMS_COLS = useMemo(() => [
    { key: "shipmentId", label: "Shipment ID", mono: true },
    { key: "sellerId",   label: "Seller ID" },
    { key: "weight",     label: "Weight" },
    { key: "length",     label: "Length" },
    { key: "height",     label: "Height" },
    { key: "width",      label: "Width" },
  ], []);

  const PYM_COLS = useMemo(() => [
    { key: "shipmentId",  label: "Shipment ID", mono: true },
    { key: "weight",      label: "Weight" },
    { key: "length",      label: "Length" },
    { key: "height",      label: "Height" },
    { key: "width",       label: "Width" },
    { key: "description", label: "Description" },
  ], []);

  return (
    <PageWrapper>
      {/* FILE INPUTS */}
      <div className="flex flex-wrap gap-6 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-widest">CSV — TMS</span>
          <input type="file" accept=".csv" onChange={handleCSV} className="text-xs text-slate-300" />
          {loadingTms && <span className="text-xs text-blue-400 animate-pulse">Procesando...</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-widest">XLSX — PYM</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleXLSX} className="text-xs text-slate-300" />
          {loadingPym && <span className="text-xs text-blue-400 animate-pulse">Procesando...</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-widest">CSV — Descripcion</span>
          <input type="file" accept=".csv" onChange={handleDesc} className="text-xs text-slate-300" />
          {loadingDesc && <span className="text-xs text-blue-400 animate-pulse">Procesando...</span>}
        </label>
      </div>

      {/* TABS + CONTADORES */}
      <div className="flex items-center justify-between mb-0">
        <div className="flex gap-1">
          <button className={TAB_CLASS("tms")}         onClick={() => setActiveTab("tms")}>TMS</button>
          <button className={TAB_CLASS("pym")}         onClick={() => setActiveTab("pym")}>PYM</button>
          <button className={TAB_CLASS("biggertms")}   onClick={() => setActiveTab("biggertms")}>Bigger TMS</button>
          <button className={TAB_CLASS("comparacion")} onClick={() => setActiveTab("comparacion")}>Comparación</button>
        </div>
        <div className="flex gap-2 items-center pr-1">
          <span className={`text-[11px] px-3 py-1 rounded-full font-semibold ${BADGE["BIGGER"]}`}>
            Bigger: {biggerCount}
          </span>
          <span className={`text-[11px] px-3 py-1 rounded-full font-semibold ${BADGE["SUPER BIGGER"]}`}>
            Super Bigger: {superBiggerCount}
          </span>
        </div>
      </div>

      {/* TAB PANEL */}
      <div className="bg-white/5 rounded-b rounded-tr-xl border border-white/10 overflow-x-auto">

        {activeTab === "tms" && (
          tmsData.length === 0
            ? <p className="p-4 text-center text-slate-500 text-xs">Sube un archivo CSV para ver los datos</p>
            : <VirtualTable rows={tmsData} columns={TMS_COLS} />
        )}

        {activeTab === "pym" && (
          pymData.length === 0
            ? <p className="p-4 text-center text-slate-500 text-xs">Sube un archivo XLSX para ver los datos</p>
            : <VirtualTable rows={pymData} columns={PYM_COLS} />
        )}

        {activeTab === "biggertms" && (
          <div className="p-3">
            {Object.keys(biggerBySeller).length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-4">
                {tmsData.length === 0 ? "Sube un archivo CSV para ver los datos" : "No hay shipments Bigger o Super Bigger"}
              </p>
            ) : Object.entries(biggerBySeller).map(([seller, items]) => (
              <SellerAccordion
                key={seller}
                seller={seller}
                items={items}
                isOpen={openSeller === seller}
                onToggle={() => setOpenSeller((s) => s === seller ? null : seller)}
                columns={COLS_BIGGER}
              />
            ))}
          </div>
        )}

        {activeTab === "comparacion" && (
          <div className="p-3">
            {Object.keys(comparisonBySeller).length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-4">
                {tmsData.length === 0 && pymData.length === 0
                  ? "Sube los archivos CSV y XLSX para comparar"
                  : "No hay datos en PYM"}
              </p>
            ) : (
              <>
                {/* Filtro de fechas + exportar */}
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Desde</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">Hasta</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white"
                    />
                  </label>
                  <button
                    onClick={() => exportFinal(biggerBySeller, comparisonBySeller, descMatchMap, dateFrom, dateTo)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                  >
                    Exportar Excel
                  </button>
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); }}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 text-xs rounded"
                    >
                      Limpiar filtro
                    </button>
                  )}
                </div>

                {Object.keys(filteredComparisonBySeller).length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-4">
                    No hay datos que coincidan con el rango de fechas seleccionado
                  </p>
                ) : (
                  Object.entries(filteredComparisonBySeller).map(([seller, items]) => (
                    <SellerAccordion
                      key={seller}
                      seller={seller}
                      items={items}
                      isOpen={openSellerComp === seller}
                      onToggle={() => setOpenSellerComp((s) => s === seller ? null : seller)}
                      columns={COLS_COMP}
                    />
                  ))
                )}
              </>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
