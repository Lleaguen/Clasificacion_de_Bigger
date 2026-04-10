import React from "react";

export default function PageWrapper({ children }) {
  return (
    <div className="min-h-screen text-white p-4 md:p-6">
      {children}
    </div>
  );
}