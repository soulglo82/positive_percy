import React from 'react';

export default function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mb-4" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}
