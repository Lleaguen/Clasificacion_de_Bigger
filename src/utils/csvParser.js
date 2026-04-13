import Papa from "papaparse";

export const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      worker: true,          // corre en Web Worker, no bloquea el hilo principal
      complete: (results) => resolve(results.data),
      error: (err) => reject(err),
    });
  });
};
