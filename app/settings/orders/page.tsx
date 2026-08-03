'use client';

import { useEffect } from 'react';

export default function SettingsOrdersRedirectPage() {
  useEffect(() => {
    window.location.href = '/settings/invoices';
  }, []);

  return (
    <div className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
    </div>
  );
}
