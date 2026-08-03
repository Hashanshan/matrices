'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Printer, Download, X } from 'lucide-react';
import { formatPrice } from '@/lib/currency';

const formatDisplayName = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'object') {
    if (val.name) return val.name.trim();
    if (val.email) val = val.email;
    else return '';
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('@')) {
      const username = trimmed.split('@')[0];
      return username
        .replace(/[._-]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
    return trimmed;
  }
  return String(val);
};

export interface Item {
  productID: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
}

export interface Payment {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}

export interface Order {
  orderId: string;
  date: string;
  shop: {
    shopId: string;
    name: string;
    address: string;
    phone: string;
  };
  items: Item[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  total: number;
  status: string;
  totalPaid: number;
  remainingAmount: number;
  payments: Payment[];
  billedBy?: { name?: string; email?: string } | string;
  salesrep?: any;
  salesRep?: any;
  createdBy?: any;
}

interface InvoicePdfModalProps {
  order: Order | null;
  onClose: () => void;
}

export default function InvoicePdfModal({ order, onClose }: InvoicePdfModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Listen for Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (order) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, onClose]);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      // Dynamically load html2pdf script if not present
      if (!(window as any).html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const element = document.getElementById('printable-invoice');
      if (!element) {
        setIsDownloading(false);
        return;
      }

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `Invoice_${order.orderId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const worker = (window as any).html2pdf().set(opt).from(element);
      const pdfBlob = await worker.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `Invoice_${order.orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    } catch (err) {
      console.error('Error downloading PDF file:', err);
      alert('Could not download PDF to device. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const subtotal = order.subtotal || (order.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
  const discountAmount = order.discountAmount || (order.discount > 0 ? (subtotal * order.discount / 100) : 0);
  const discountPercent = order.discount || (subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : 0);
  const total = order.total || (subtotal - discountAmount);
  const totalPaid = order.totalPaid || 0;
  const remainingAmount = Math.max(0, total - totalPaid);

  return (
    <AnimatePresence>
      {/* Global CSS for @media print to eliminate dark background bleed */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          .pdf-modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .pdf-modal-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 15px !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            background: #ffffff !important;
          }
          #printable-invoice,
          #printable-invoice * {
            visibility: visible !important;
          }
          .no-print,
          .print\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      <div
        className="pdf-modal-overlay fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-md p-4 sm:p-6 flex items-start justify-center cursor-pointer min-h-screen py-6 sm:py-10"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="pdf-modal-card relative w-full max-w-3xl bg-white rounded-[2.5rem] p-6 sm:p-10 text-gray-900 shadow-2xl cursor-default my-auto"
          onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing
        >
          {/* Modal Top Bar - Sticky Top */}
          <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b border-gray-200 print:hidden no-print pt-2 -mt-2 rounded-t-3xl">
            <div className="flex items-center gap-2">
              <FileText className="text-[#0f172a]" size={24} />
              <h3 className="font-black text-lg sm:text-xl text-[#0f172a] uppercase">
                INVOICE #{order.orderId}
              </h3>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <button
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="px-5 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                title="Download PDF file directly to device"
              >
                {isDownloading ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                ) : (
                  <Download size={14} />
                )}
                DOWNLOAD PDF
              </button>

              <button
                onClick={onClose}
                className="p-2 text-gray-500 hover:text-black hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                title="Close (Esc)"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Printable Document Body */}
          <div id="printable-invoice" className="space-y-6 bg-white p-2">
            {/* Header Logo & Order ID */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-gray-900">
              <div>
                <h1 className="text-3xl font-black text-[#0f172a] tracking-wider uppercase">MATRICES</h1>
                <p className="text-xs text-gray-500 font-bold uppercase mt-1">COMMERCIAL & DISTRIBUTION SERVICES</p>
                <p className="text-xs text-gray-600 font-semibold uppercase mt-0.5">COLOMBO, SRI LANKA</p>
              </div>

              <div className="sm:text-right">
                <span className="inline-block px-4 py-1.5 bg-[#0f172a] text-white font-black text-sm uppercase rounded-lg mb-2 shadow-xs">
                  INVOICE #{order.orderId}
                </span>
                <p className="text-xs text-gray-500 font-bold uppercase">
                  DATE: {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">
                  STATUS: <span className="font-black text-[#0f172a] uppercase">{order.status}</span>
                </p>
                {(order.salesrep || order.salesRep || order.createdBy) && (
                  <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">
                    BILLED BY: <span className="font-black text-[#0f172a] uppercase">{formatDisplayName(order.salesrep || order.salesRep || order.createdBy)}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Customer / Shop Information */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-1">INVOICED TO</p>
              <h2 className="text-lg font-black text-[#0f172a] uppercase">{order.shop.name}</h2>
              <p className="text-xs text-gray-600 font-semibold uppercase mt-0.5">SHOP ID: {order.shop.shopId}</p>
              <p className="text-xs text-gray-600 font-semibold uppercase">{order.shop.address}</p>
              <p className="text-xs text-gray-600 font-semibold uppercase">PHONE: {order.shop.phone}</p>
            </div>

            {/* Itemized Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#0f172a] text-white uppercase font-black">
                    <th className="p-3 rounded-l-lg">PRODUCT ID</th>
                    <th className="p-3">ITEM DESCRIPTION</th>
                    <th className="p-3 text-center">QTY</th>
                    <th className="p-3 text-right">UNIT PRICE</th>
                    <th className="p-3 text-right rounded-r-lg">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {order.items.map((item, idx) => (
                    <tr key={idx} className="font-semibold text-gray-800 uppercase">
                      <td className="p-3 font-black text-[#0f172a]">{item.productID}</td>
                      <td className="p-3">{item.name}</td>
                      <td className="p-3 text-center">{item.quantity}</td>
                      <td className="p-3 text-right">{formatPrice(item.price)}</td>
                      <td className="p-3 text-right font-black text-[#0f172a]">{formatPrice(item.quantity * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Table */}
            <div className="flex justify-end pt-4">
              <div className="w-full max-w-xs space-y-2 text-xs font-bold border-t-2 border-gray-900 pt-4">
                <div className="flex justify-between text-gray-600 uppercase">
                  <span>SUBTOTAL:</span>
                  <span className="font-black text-[#0f172a]">{formatPrice(subtotal)}</span>
                </div>
                {(discountAmount > 0 || discountPercent > 0) && (
                  <div className="flex justify-between text-gray-600 uppercase">
                    <span>DISCOUNT ({discountPercent}%):</span>
                    <span className="font-black text-rose-600">-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-[#0f172a] uppercase border-t pt-2">
                  <span>GRAND TOTAL:</span>
                  <span>{formatPrice(total)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-green-700 uppercase">
                  <span>TOTAL PAID:</span>
                  <span>{formatPrice(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-rose-700 uppercase border-t border-dashed pt-2">
                  <span>BALANCE DUE:</span>
                  <span>{formatPrice(remainingAmount)}</span>
                </div>
              </div>
            </div>

            {/* Payment Record Section */}
            {order.payments && order.payments.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-2">PAYMENT HISTORY</p>
                <div className="space-y-1.5 text-xs font-semibold">
                  {order.payments.map((p, idx) => (
                    <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded-lg uppercase">
                      <span>{new Date(p.date).toLocaleDateString()} - METHOD: {p.paymentMethod}</span>
                      <span className="font-black text-green-700">{formatPrice(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer Terms */}
            <div className="pt-8 text-center text-[0.65rem] text-gray-400 font-bold uppercase border-t border-gray-200">
              <p>THANK YOU FOR YOUR BUSINESS! FOR ENQUIRIES, CONTACT SUPPORT AT INFO@MATRICES.LK</p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
