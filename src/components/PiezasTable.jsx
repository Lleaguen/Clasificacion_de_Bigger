export default function PiezasTable({ list, orden }) {
  const sorted = [...list].sort((a, b) =>
    orden === "peso"
      ? b.weight - a.weight
      : (a.hora || "").localeCompare(b.hora || "")
  );

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-x-auto mt-4">
      <table className="w-full text-left text-sm">
        <thead className="text-slate-400 text-[10px] uppercase">
          <tr>
            <th className="p-2">ID</th>
            <th>Peso</th>
            <th>H</th>
            <th>L</th>
            <th>A</th>
            <th>Hora</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={i} className="border-t border-white/10">
              <td className="p-2 font-mono">{r.shipmentId}</td>
              <td>{r.weight}</td>
              <td>{r.height}</td>
              <td>{r.length}</td>
              <td>{r.width}</td>
              <td>{r.hora || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
