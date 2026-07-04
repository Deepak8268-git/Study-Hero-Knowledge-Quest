import React from 'react';

const EmptyState: React.FC<{ icon?: string; title: string; message?: string; action?: React.ReactNode }> = ({ icon = 'ri-inbox-line', title, message, action }) => (
  <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center">
    <i className={`${icon} text-4xl text-gray-300 block mb-3`}></i>
    <h3 className="font-semibold text-gray-800">{title}</h3>
    {message && <p className="text-sm text-gray-500 mt-2">{message}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;