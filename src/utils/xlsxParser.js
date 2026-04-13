import * as XLSX from "xlsx";

export const parseXLSXFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, {
          type: "array",
          dense: true,          // estructura interna más compacta → más rápido
          cellDates: false,     // no parsear fechas, no las necesitamos
          cellNF: false,        // no parsear formatos de número
          cellHTML: false,      // no generar HTML
        });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {
          defval: "",
          raw: true,            // valores crudos sin formatear → más rápido
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
