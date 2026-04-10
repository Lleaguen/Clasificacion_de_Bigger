import React from "react";
import { useEffect, useState } from "react";
import PageWrapper from "../components/PageWrapper";
import StatCard from "../components/StatCard";
import { parseCSVFile } from "../utils/csvParser";
import { buildAudit } from "../utils/auditEngine";
import { exportToExcel } from "../utils/exportExcel";

const API_URL =
  "https://script.google.com/macros/s/AKfycbzw9to4LMuJYeTZSsg_rqgttRcKOaiButv2XvSwDhAR7JEza2yEnJ-42QYR9cH9aw6R/exec";

console.log(API_URL);

export default function SuperBigger() {
  const [apiData, setApiData] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [audit, setAudit] = useState({});
  const [selectedSeller, setSelectedSeller] = useState(null);

  /* ---------------- API ---------------- */
  useEffect(() => {
    fetch(API_URL)
      .then((r) => r.json())
      .then((data) => {
        const parsed = data.map((r) => ({
          shipmentId: String(r.shipment_id),
          weight: Number(r.weight),
          height: Number(r.height),
          length: Number(r.length),
          width: Number(r.width),
        }));

        setApiData(parsed);
      })
      .catch((err) => console.log("API ERROR:", err));
  }, []);

  /* ---------------- CSV ---------------- */
  const handleCSV = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const parsed = await parseCSVFile(file);

    const normalized = parsed.map((r) => ({
      shipmentId: String(r["Shipment ID"]),
      weight: Number(r["Weight"]),
      height: Number(r["Height"]),
      length: Number(r["Length"]),
      width: Number(r["Width"]),
      sellerId: String(r["Seller ID"]),
    }));

    setCsvData(normalized);
  };

  /* ---------------- BUILD AUDIT ---------------- */
  useEffect(() => {
    if (!apiData.length || !csvData.length) return;

    try {
      const result = buildAudit(apiData, csvData);
      setAudit(result || {});
    } catch (err) {
      console.log("AUDIT ERROR:", err);
    }
  }, [apiData, csvData]);

  const safeAudit = audit || {};
  const sellers = Object.keys(safeAudit);

  const totalIssues = Object.values(safeAudit)
    .flat()
    .filter((r) => r?.diff).length;

  return (
    <PageWrapper>
      {/* INPUT */}
      <input
        type="file"
        accept=".csv"
        onChange={handleCSV}
        className="mb-4 text-xs text-slate-400"
      />

      {/* STATS */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="Sellers" value={sellers.length} />
        <StatCard label="Issues" value={totalIssues} />
        <StatCard label="Shipments" value={csvData.length} />
      </div>

      {/* EXPORT */}
      <button
        onClick={() => exportToExcel(Object.values(safeAudit).flat())}
        className="mb-4 px-4 py-2 bg-green-600 text-white rounded"
      >
        Export Excel
      </button>

      {/* SELLERS LIST */}
      <div className="grid gap-2">
        {sellers.map((seller) => {
          const sellerData = safeAudit[seller] || [];
          const issues = sellerData.filter((r) => r?.diff).length;

          return (
            <button
              key={seller}
              onClick={() => setSelectedSeller(seller)}
              className="p-3 bg-white/5 rounded text-left"
            >
              <div className="font-bold">{seller}</div>
              <div className="text-xs text-slate-400">
                Issues: {issues} / {sellerData.length}
              </div>
            </button>
          );
        })}
      </div>

      {/* MODAL */}
      {selectedSeller && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#111] p-4 rounded w-[600px] max-h-[80vh] overflow-auto">
            <h2 className="text-white mb-2">
              Seller {selectedSeller}
            </h2>

            <button
              className="mb-2 text-red-400"
              onClick={() => setSelectedSeller(null)}
            >
              Close
            </button>

            {(safeAudit[selectedSeller] || []).map((r, i) => (
              <div
                key={i}
                className={`p-2 mb-2 rounded ${
                  r?.diff ? "bg-red-500/20" : "bg-green-500/10"
                }`}
              >
                <div className="text-xs text-white">
                  {r?.shipmentId}
                </div>

                <div className="text-[10px] text-slate-400">
                  CSV: {r?.csv?.weight}/{r?.csv?.height}/{r?.csv?.length}/{r?.csv?.width}
                </div>

                {r?.hasApi && (
                  <div className="text-[10px] text-slate-400">
                    API: {r?.api?.weight}/{r?.api?.height}/{r?.api?.length}/{r?.api?.width}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}