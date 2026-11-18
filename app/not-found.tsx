import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 mb-4 rounded-2xl bg-[#1c2c4d]/10 flex items-center justify-center">
        <span className="text-2xl font-black text-[#1c2c4d]">404</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">Page Not Found</h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The page you are looking for does not exist or may have been moved.
      </p>
      <Link
        href="/catalogue"
        className="px-5 py-2.5 rounded-xl bg-[#1c2c4d] text-white text-xs font-semibold hover:bg-[#2b4170] transition-colors shadow-sm"
      >
        Back to Catalogue
      </Link>
    </div>
  );
}
