import { useState, useMemo } from "react";
import PageWrapper from "../components/PageWrapper";
import { parseCSVFile } from "../utils/csvParser";
import { parseXLSXFile } from "../utils/xlsxParser";

/* ---------- clasificación ----------
   Peso viene en gramos → convertir a kg
   Dimensiones vienen en cm → comparar directo
------------------------------------------------ */
function classify(row) {
  const weightKg = (Number(row.weight) || 0) / 1000;
  const l  = Number(row.length) || 0;
  const h  = Number(row.height) || 0;
  const wi = Number(row.width)  || 0;
  const maxDim = Math.max(l, h, wi);

  if (weightKg >= 50 || maxDim >= 200) return "SUPER BIGGER";
  if (weightKg >= 30 || maxDim >= 150) return "BIGGER";
  return null;
}

const BADGE = {
  "SUPER BIGGER": "bg-red-500/20 text-red-400 border border-red-500/40",
  "BIGGER":       "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40",
};

export default function SuperBigger() {
  const [tmsData, setTmsData] = useState([]);
  const [pymData, setPymData] = useState([]);
  const [activeTab, setActiveTab] = useState("tms");
  const [openSeller, setOpenSeller] = useState(null);
  const [openSellerComp, setOpenSellerComp] = useState(null);

  /* ---------------- CSV → TMS ---------------- */
  const handleCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = await parseCSVFile(file);
    setTmsData(
      parsed.map((r) => ({
        shipmentId: String(r["Shipment ID"] ?? ""),
        weight:     r["Weight"]  ?? "",
        height:     r["Height"]  ?? "",
        length:     r["Length"]  ?? "",
        width:      r["Width"]   ?? "",
        sellerId:   String(r["Seller ID"] ?? ""),
      }))
    );
  };

  /* ---------------- XLSX → PYM ---------------- */
  const handleXLSX = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
  };

  /* ---------- Bigger TMS: agrupar por Seller ID y clasificar ---------- */
  const biggerBySeller = useMemo(() => {
    const map = {};
    tmsData.forEach((r) => {
      const cat = classify(r);
      if (!cat) return;
      const seller = r.sellerId || "UNKNOWN";
      if (!map[seller]) map[seller] = [];
      map[seller].push({ ...r, category: cat });
    });
    return map;
  }, [tmsData]);

  /* ---------- Comparación: unión de Bigger TMS + PYM bigger, sin duplicados ----------
     Prioridad: si el shipment está en PYM → usar datos PYM (tiene description y reclasifica)
                si solo está en TMS bigger → usar datos TMS
     Seller viene siempre de TMS. Si no está en TMS → "SIN SELLER EN TMS"
  ------------------------------------------------ */
  const comparisonBySeller = useMemo(() => {
    const tmsMap = new Map();
    tmsData.forEach((r) => tmsMap.set(String(r.shipmentId), r));

    const pymMap = new Map();
    pymData.forEach((r) => pymMap.set(String(r.shipmentId), r));

    // Conjunto unificado: clave = shipmentId
    const unified = new Map();

    // 1. Agregar todos los Bigger TMS
    tmsData.forEach((tms) => {
      const catTms = classify(tms);
      if (!catTms) return;
      unified.set(String(tms.shipmentId), {
        shipmentId:   tms.shipmentId,
        seller:       tms.sellerId || "UNKNOWN",
        weight:       tms.weight,
        length:       tms.length,
        height:       tms.height,
        width:        tms.width,
        description:  "",
        categoryFinal: catTms,
        categoryTms:  catTms,
        categoryPym:  null,
        inPym:        false,
        inTms:        true,
      });
    });

    // 2. Agregar / actualizar con datos PYM (si clasifica como bigger/super bigger)
    pymData.forEach((pym) => {
      const catPym = classify(pym);
      const tms    = tmsMap.get(String(pym.shipmentId));
      const seller = tms?.sellerId || "SIN SELLER EN TMS";
      const catTms = tms ? classify(tms) : null;

      // Solo incluir si clasifica en PYM O ya estaba en TMS bigger
      if (!catPym && !unified.has(String(pym.shipmentId))) return;

      unified.set(String(pym.shipmentId), {
        shipmentId:    pym.shipmentId,
        seller,
        weight:        pym.weight,
        length:        pym.length,
        height:        pym.height,
        width:         pym.width,
        description:   pym.description,
        categoryFinal: catPym || catTms,   // reclasifica con PYM; fallback a TMS
        categoryTms:   catTms,
        categoryPym:   catPym,
        inPym:         true,
        inTms:         !!tms,
      });
    });

    // 3. Agrupar por seller
    const map = {};
    unified.forEach((record) => {
      if (!record.categoryFinal) return; // descartar si ninguna fuente lo clasifica
      if (!map[record.seller]) map[record.seller] = [];
      map[record.seller].push(record);
    });

    return map;
  }, [pymData, tmsData]);

  const TAB_CLASS = (tab) =>
    `px-5 py-2 rounded-t font-semibold text-sm transition ${
      activeTab === tab
        ? "bg-blue-600 text-white"
        : "bg-white/5 text-slate-400 hover:text-white"
    }`;

  return (
    <PageWrapper>
      {/* FILE INPUTS */}
      <div className="flex flex-wrap gap-6 mb-6">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-widest">CSV — TMS</span>
          <input type="file" accept=".csv" onChange={handleCSV} className="text-xs text-slate-300" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-widest">XLSX — PYM</span>
          <input type="file" accept=".xlsx,.xls" onChange={handleXLSX} className="text-xs text-slate-300" />
        </label>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-0">
        <button className={TAB_CLASS("tms")}        onClick={() => setActiveTab("tms")}>TMS</button>
        <button className={TAB_CLASS("pym")}        onClick={() => setActiveTab("pym")}>PYM</button>
        <button className={TAB_CLASS("biggertms")}  onClick={() => setActiveTab("biggertms")}>Bigger TMS</button>
        <button className={TAB_CLASS("comparacion")} onClick={() => setActiveTab("comparacion")}>Comparación</button>
      </div>

      {/* TAB PANEL */}
      <div className="bg-white/5 rounded-b rounded-tr-xl border border-white/10 overflow-x-auto">

        {/* ── TMS ── */}
        {activeTab === "tms" && (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400 text-[11px] uppercase bg-white/5">
              <tr>
                <th className="p-3">Shipment ID</th>
                <th className="p-3">Seller ID</th>
                <th className="p-3">Weight</th>
                <th className="p-3">Length</th>
                <th className="p-3">Height</th>
                <th className="p-3">Width</th>
              </tr>
            </thead>
            <tbody>
              {tmsData.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500 text-xs">Sube un archivo CSV para ver los datos</td></tr>
              ) : tmsData.map((r, i) => (
                <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-3 font-mono">{r.shipmentId}</td>
                  <td className="p-3">{r.sellerId}</td>
                  <td className="p-3">{r.weight}</td>
                  <td className="p-3">{r.length}</td>
                  <td className="p-3">{r.height}</td>
                  <td className="p-3">{r.width}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── PYM ── */}
        {activeTab === "pym" && (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400 text-[11px] uppercase bg-white/5">
              <tr>
                <th className="p-3">Shipment ID</th>
                <th className="p-3">Weight</th>
                <th className="p-3">Length</th>
                <th className="p-3">Height</th>
                <th className="p-3">Width</th>
                <th className="p-3">Description</th>
              </tr>
            </thead>
            <tbody>
              {pymData.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500 text-xs">Sube un archivo XLSX para ver los datos</td></tr>
              ) : pymData.map((r, i) => (
                <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-3 font-mono">{r.shipmentId}</td>
                  <td className="p-3">{r.weight}</td>
                  <td className="p-3">{r.length}</td>
                  <td className="p-3">{r.height}</td>
                  <td className="p-3">{r.width}</td>
                  <td className="p-3">{r.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* ── BIGGER TMS ── */}
        {activeTab === "biggertms" && (
          <div className="p-3">
            {Object.keys(biggerBySeller).length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-4">
                {tmsData.length === 0
                  ? "Sube un archivo CSV para ver los datos"
                  : "No hay shipments clasificados como Bigger o Super Bigger"}
              </p>
            ) : (
              Object.entries(biggerBySeller).map(([seller, items]) => {
                const superCount  = items.filter((r) => r.category === "SUPER BIGGER").length;
                const biggerCount = items.filter((r) => r.category === "BIGGER").length;
                const isOpen = openSeller === seller;

                return (
                  <div key={seller} className="mb-2 rounded-lg border border-white/10 overflow-hidden">
                    {/* seller header */}
                    <button
                      onClick={() => setOpenSeller(isOpen ? null : seller)}
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

                    {/* shipments table */}
                    {isOpen && (
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-400 text-[11px] uppercase bg-white/5">
                          <tr>
                            <th className="p-3">Shipment ID</th>
                            <th className="p-3">Weight</th>
                            <th className="p-3">Length</th>
                            <th className="p-3">Height</th>
                            <th className="p-3">Width</th>
                            <th className="p-3">Categoría</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((r, i) => (
                            <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                              <td className="p-3 font-mono">{r.shipmentId}</td>
                              <td className="p-3">{r.weight}</td>
                              <td className="p-3">{r.length}</td>
                              <td className="p-3">{r.height}</td>
                              <td className="p-3">{r.width}</td>
                              <td className="p-3">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE[r.category]}`}>
                                  {r.category}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
        {/* ── COMPARACIÓN ── */}
        {activeTab === "comparacion" && (
          <div className="p-3">
            {Object.keys(comparisonBySeller).length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-4">
                {tmsData.length === 0 && pymData.length === 0
                  ? "Sube los archivos CSV y XLSX para comparar"
                  : "No hay shipments clasificados como Bigger o Super Bigger en ninguna fuente"}
              </p>
            ) : (
              Object.entries(comparisonBySeller).map(([seller, items]) => {
                const superCount  = items.filter((r) => r.categoryFinal === "SUPER BIGGER").length;
                const biggerCount = items.filter((r) => r.categoryFinal === "BIGGER").length;
                const isOpen = openSellerComp === seller;

                return (
                  <div key={seller} className="mb-2 rounded-lg border border-white/10 overflow-hidden">
                    <button
                      onClick={() => setOpenSellerComp(isOpen ? null : seller)}
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

                    {isOpen && (
                      <table className="w-full text-left text-sm">
                        <thead className="text-slate-400 text-[11px] uppercase bg-white/5">
                          <tr>
                            <th className="p-3">Shipment ID</th>
                            <th className="p-3">Weight</th>
                            <th className="p-3">Length</th>
                            <th className="p-3">Height</th>
                            <th className="p-3">Width</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Cat. TMS</th>
                            <th className="p-3">Cat. PYM</th>
                            <th className="p-3">Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((r, i) => (
                            <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                              <td className="p-3 font-mono">{r.shipmentId}</td>
                              <td className="p-3">{r.weight}</td>
                              <td className="p-3">{r.length}</td>
                              <td className="p-3">{r.height}</td>
                              <td className="p-3">{r.width}</td>
                              <td className="p-3 text-xs text-slate-300">{r.description || "—"}</td>
                              <td className="p-3">
                                {r.categoryTms
                                  ? <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE[r.categoryTms]}`}>{r.categoryTms}</span>
                                  : <span className="text-slate-600 text-[10px]">—</span>}
                              </td>
                              <td className="p-3">
                                {r.categoryPym
                                  ? <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE[r.categoryPym]}`}>{r.categoryPym}</span>
                                  : <span className="text-slate-600 text-[10px]">—</span>}
                              </td>
                              <td className="p-3">
                                {r.categoryFinal
                                  ? <span className={`text-[10px] px-2 py-0.5 rounded-full ${BADGE[r.categoryFinal]}`}>{r.categoryFinal}</span>
                                  : <span className="text-slate-600 text-[10px]">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
