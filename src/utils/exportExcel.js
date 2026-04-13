import * as XLSX from "xlsx";

export const exportToExcel = (data, filename = "audit.xlsx") => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Audit");
  XLSX.writeFile(workbook, filename);
};

/**
 * Exporta la comparación agrupada por seller.
 * Cada seller ocupa una hoja separada.
 * @param {Object} comparisonBySeller  - { [seller]: record[] }
 */
export const exportComparacion = (comparisonBySeller, filename = "comparacion.xlsx") => {
  const workbook = XLSX.utils.book_new();

  Object.entries(comparisonBySeller).forEach(([seller, items]) => {
    const rows = items.map((r) => ({
      "Shipment ID":     r.shipmentId,
      "Seller ID":       seller,
      "Weight":          r.weight,
      "Length":          r.length,
      "Height":          r.height,
      "Width":           r.width,
      "Description":     r.description || "",
      "Categoría Final": r.categoryFinal || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);

    // Nombre de hoja: máx 31 chars (límite de Excel)
    const sheetName = String(seller).slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  XLSX.writeFile(workbook, filename);
};