import * as XLSX from "xlsx";

export const parseXLSXFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, {
          type: "array",
          dense: true,
          cellDates: false,
          cellNF: false,
          cellHTML: false,
        });

        // Leer solo las hojas VOLUMEN y Linea Blanca
        const TARGET_SHEETS = ["VOLUMEN", "Linea Blanca", "LINEA BLANCA", "linea blanca"];
        const allRows = [];
        for (const sheetName of workbook.SheetNames) {
          if (!TARGET_SHEETS.includes(sheetName)) continue;
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: "",
            raw: true,
          });
          allRows.push(...rows);
        }

        resolve(allRows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
