import React from "react";
export default function SortButton({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition
        ${active ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:text-white"}`}
    >
      {children}
    </button>
  );
}