export const buildAudit = (apiData, csvData) => {
  const apiMap = new Map();

  // O(1) lookup
  apiData.forEach((item) => {
    apiMap.set(String(item.shipmentId), item);
  });

  const sellers = {};

  csvData.forEach((csv) => {
    const api = apiMap.get(String(csv.shipmentId));

    const diff =
      !api ||
      api.weight !== csv.weight ||
      api.height !== csv.height ||
      api.length !== csv.length ||
      api.width !== csv.width;

    const record = {
      shipmentId: csv.shipmentId,
      sellerId: csv.sellerId,
      csv,
      api: api || null,
      hasApi: !!api,
      diff
    };

    const seller = csv.sellerId || "UNKNOWN";

    if (!sellers[seller]) {
      sellers[seller] = [];
    }

    sellers[seller].push(record);
  });

  return sellers;
};