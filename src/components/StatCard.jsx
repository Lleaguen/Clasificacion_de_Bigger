export default function StatCard({ label, value, color }) {
  return (
    <div className="bg-white/5 p-4 rounded-xl border border-white/10">
      <div className="text-[10px] text-slate-500 uppercase">{label}</div>
      <div className={`text-xl font-black text-${color || "white"}`}>
        {value}
      </div>
    </div>
  );
}
