import { useState } from "react";
import PageWrapper from "../components/PageWrapper";
import { parseCSVFile } from "../utils/csvParser";
import { parseXLSXFile } from "../utils/xlsxParser";

export default function SuperBigger() {
  const [tmsData, setTmsData] = useState([]);
  const [pymData, setPymData] = useState([]);
  const [activeTab, setActiveTab] = useState("tms");

  /* ---------------- CSV → TMS ---------------- */
  const handleCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = await parseCSVFile(file);
    const normalized = parsed.map((r) => ({
      shipmentId: String(r["Shipment ID"] ?? ""),
      weight:     r["Weight"]  ?? "",
      height:     r["Height"]  ?? "",
      length:     r["Length"]  ?? "",
      width:      r["Width"]   ?? "",
      sellerId:   String(r["Seller ID"] ?? ""),
    }));
    setTmsData(normalized);
  };

  /* ---------------- XLSX → PYM ---------------- */
  const handleXLSX = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const parsed = await parseXLSXFile(file);
    const normalized = parsed.map((r) => ({
      shipmentId:  String(r["Shipment ID"] ?? r["SHIPMENT ID"] ?? r["shipment_id"] ?? ""),
      weight:      r["Weight"]      ?? r["WEIGHT"]      ?? "",
      height:      r["Height"]      ?? r["HEIGHT"]      ?? "",
      length:      r["Length"]      ?? r["LENGTH"]      ?? "",
      width:       r["Width"]       ?? r["WIDTH"]        ?? "",
      description: r["Description"] ?? r["DESCRIPTION"] ?? r["Descripcion"] ?? r["DESCRIPCION"] ?? "",
    }));
    setPymData(normalized);
  };

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
          <input
            type="file"
            accept=".csv"
            onChange={handleCSV}
            className="text-xs text-slate-300"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400 uppercase tracking-widest">XLSX — PYM</span>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleXLSX}
            className="text-xs text-slate-300"
          />
        </label>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-0">
        <button className={TAB_CLASS("tms")} onClick={() => setActiveTab("tms")}>
          TMS
        </button>
        <button className={TAB_CLASS("pym")} onClick={() => setActiveTab("pym")}>
          PYM
        </button>
      </div>

      {/* TAB PANEL */}
      <div className="bg-white/5 rounded-b rounded-tr-xl border border-white/10 overflow-x-auto">
        {activeTab === "tms" ? (
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
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 text-xs">
                    Sube un archivo CSV para ver los datos
                  </td>
                </tr>
              ) : (
                tmsData.map((r, i) => (
                  <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                    <td className="p-3 font-mono">{r.shipmentId}</td>
                    <td className="p-3">{r.sellerId}</td>
                    <td className="p-3">{r.weight}</td>
                    <td className="p-3">{r.length}</td>
                    <td className="p-3">{r.height}</td>
                    <td className="p-3">{r.width}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
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
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-500 text-xs">
                    Sube un archivo XLSX para ver los datos
                  </td>
                </tr>
              ) : (
                pymData.map((r, i) => (
                  <tr key={i} className="border-t border-white/10 hover:bg-white/5">
                    <td className="p-3 font-mono">{r.shipmentId}</td>
                    <td className="p-3">{r.weight}</td>
                    <td className="p-3">{r.length}</td>
                    <td className="p-3">{r.height}</td>
                    <td className="p-3">{r.width}</td>
                    <td className="p-3">{r.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </PageWrapper>
  );
}
