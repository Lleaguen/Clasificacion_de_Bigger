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

        // Leer hojas VOLUMEN y linea blanca (hoja #3)
        const TARGET_SHEETS = ["VOLUMEN", "Linea Blanca", "LINEA BLANCA", "linea blanca"];
        const allRows = [];
        
        // Primero intentar por nombre de hoja
        for (const sheetName of workbook.SheetNames) {
          if (!TARGET_SHEETS.includes(sheetName)) continue;
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            defval: "",
            raw: true,
          });
          allRows.push(...rows);
        }

        // Si no encontró "linea blanca" por nombre, intentar leer la hoja #3 (índice 2)
        if (workbook.SheetNames.length >= 3) {
          const sheet3Name = workbook.SheetNames[2];
          // Solo agregar si no fue incluida ya
          if (!TARGET_SHEETS.includes(sheet3Name)) {
            const sheet = workbook.Sheets[sheet3Name];
            const rows = XLSX.utils.sheet_to_json(sheet, {
              defval: "",
              raw: true,
            });
            allRows.push(...rows);
          }
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
