import { useState, useMemo, useCallback, memo } from "react";
import PageWrapper from "../components/PageWrapper";
import { parseCSVFile } from "../utils/csvParser";
import { parseXLSXFile } from "../utils/xlsxParser";
import { exportComparacion } from "../utils/exportExcel";

/* ---------- clasificación ----------
   Peso en gramos → kg. Dimensiones en cm.
------------------------------------------------ */
function classify(row) {
  const weightKg = (Number(row.weight) || 0) / 1000;
  const maxDim   = Math.max(Number(row.length) || 0, Number(row.height) || 0, Number(row.width) || 0);
  if (weightKg >= 50 || maxDim >= 200) return "SUPER BIGGER";
  if (weightKg >= 30 || maxDim >= 150) return "BIGGER";
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
        a. Buscar en Bigger TMS (biggerBySeller)
           - Si está y categoría coincide → ignorar
           - Si está como BIGGER pero PYM dice SUPER BIGGER → Comparación (mal clasificado)
        b. Si NO está en Bigger TMS → buscar en TMS crudo
           - Si está en TMS crudo → clasificar con datos PYM → Comparación (TMS no lo detectó)
     Seller siempre de TMS crudo.
  ------------------------------------------------ */
  const comparisonBySeller = useMemo(() => {
    const tmsMap = new Map(tmsData.map((r) => [String(r.shipmentId), r]));

    // Mapa plano de todos los shipments en Bigger TMS: id → categoría
    const biggerTmsMap = new Map();
    for (const items of Object.values(biggerBySeller)) {
      for (const r of items) biggerTmsMap.set(String(r.shipmentId), r.category);
    }

    const map = {};

    for (const pym of pymData) {
      const catPym = classify(pym);
      if (!catPym) continue; // PYM no lo clasifica → no interesa

      const id = String(pym.shipmentId);
      const tms = tmsMap.get(id);
      if (!tms) continue; // no existe en TMS crudo → fuera de scope

      const seller = tms.sellerId || "UNKNOWN";
      const catBiggerTms = biggerTmsMap.get(id); // categoría en Bigger TMS (o undefined)

      let reason;

      if (catBiggerTms) {
        // Está en Bigger TMS
        if (catBiggerTms === catPym) continue; // coincide → ignorar
        if (catBiggerTms === "BIGGER" && catPym === "SUPER BIGGER") {
          reason = "Recategorizado: BIGGER → SUPER BIGGER";
        } else {
          continue; // cualquier otro caso → ignorar
        }
      } else {
        // No está en Bigger TMS → TMS no lo detectó
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
        inboundDate:   tms.inboundDate ?? "",
        categoryFinal: catPym,
        reason,
      });
    }

    return map;
  }, [pymData, tmsData, biggerBySeller]);

  const TAB_CLASS = (tab) =>
    `px-5 py-2 rounded-t font-semibold text-sm transition ${
      activeTab === tab ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"
    }`;

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
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-0">
        <button className={TAB_CLASS("tms")}         onClick={() => setActiveTab("tms")}>TMS</button>
        <button className={TAB_CLASS("pym")}         onClick={() => setActiveTab("pym")}>PYM</button>
        <button className={TAB_CLASS("biggertms")}   onClick={() => setActiveTab("biggertms")}>Bigger TMS</button>
        <button className={TAB_CLASS("comparacion")} onClick={() => setActiveTab("comparacion")}>Comparación</button>
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
                  : "No hay discrepancias entre TMS y PYM"}
              </p>
            ) : (
              <>
                <button
                  onClick={() => exportComparacion(comparisonBySeller)}
                  className="mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                >
                  Exportar Excel
                </button>
                {Object.entries(comparisonBySeller).map(([seller, items]) => (
                  <SellerAccordion
                    key={seller}
                    seller={seller}
                    items={items}
                    isOpen={openSellerComp === seller}
                    onToggle={() => setOpenSellerComp((s) => s === seller ? null : seller)}
                    columns={COLS_COMP}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
