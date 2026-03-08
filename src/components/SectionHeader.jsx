import React from 'react';

export default function SectionHeader({ icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 mt-5 mb-2 first:mt-0">
      {icon && <span className="text-sm">{icon}</span>}
      {children}
    </h2>
  );
}
