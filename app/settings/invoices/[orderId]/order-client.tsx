'use client';

import { useState, useEffect, use } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, Printer, Download, Lock, CheckCircle2, Clock, AlertCircle, XCircle, ShoppingBag, Store, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import BackButton from '@/components/back-button';
import { formatPrice } from '@/lib/currency';

interface Item {
  productID: string;
  name: string;
  quantity: number;
  price: number;
  note?: string;
}

interface Payment {
  id: string;
  date: string;
  amount: number;
  paymentMethod: string;
  notes?: string;
}

interface Order {
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
  salesrep?: any;
  salesRep?: any;
  createdBy?: any;
  billedBy?: any;
}

function formatDisplayName(userObj: any): string {
  if (!userObj) return '';
  if (typeof userObj === 'string') return userObj;
  if (userObj.name) return userObj.name;
  if (userObj.username) return userObj.username;
  if (userObj.email) return userObj.email;
  return '';
}

import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { offlineDB } from '@/lib/offline/indexed-db';

const fetcher = async (url: string) => {
  const mode = typeof window !== 'undefined' ? (localStorage.getItem('matrices_data_mode') as string) : 'online';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const extractId = () => {
    const parts = url.split('/');
    return parts[parts.length - 1]?.split('?')[0] || '';
  };

  const getOfflineOrder = async () => {
    const rawOrders = await offlineDB.getAll<any>('orders').catch(() => []);
    const id = extractId();
    const found = rawOrders.find((o: any) =>
      String(o.orderId) === id || String(o.id) === id || String(o._id) === id
    );
    return { hasOrder: !!found, response: found ? { success: true, order: found } : { success: false, order: null } };
  };

  if (mode === 'offline' || isOffline) {
    const { hasOrder, response } = await getOfflineOrder();
    if (hasOrder || isOffline) return response;
  }

  const token = getAuthToken();
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Failed to fetch invoice');
    return res.json();
  } catch {
    const { response } = await getOfflineOrder();
    return response;
  }
};

import { useParams, useSearchParams } from 'next/navigation';

export default function OrderPdfClient({ params }: { params?: Promise<{ orderId: string }> }) {
  const routerParams = useParams();
  const searchParams = useSearchParams();

  let resolvedOrderId = '';
  try {
    if (params) {
      const resolved = use(params);
      resolvedOrderId = resolved?.orderId || '';
    }
  } catch (e) { }

  const rawParam = (routerParams?.orderId as string) || resolvedOrderId;
  const queryParam = searchParams?.get('orderId') || '';

  const orderId = (rawParam && rawParam !== 'default' && rawParam !== '1')
    ? rawParam
    : (queryParam || rawParam || '1');

  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data, error, isLoading } = useSWR(`/api/orders/${orderId}`, fetcher, {
    revalidateOnFocus: true,
  });

  const order: Order | null = data?.order || null;

  useEffect(() => {
    resetPinVerification();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  const handleDownloadPdf = async () => {
    if (!order || isDownloading) return;
    setIsDownloading(true);
    try {
      if (!(window as any).jspdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }
      if (!(window as any).jspdfAutoTable && !(window as any).autoTable) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // === CENTERED HEADER ===
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('MATRICES', pageWidth / 2, 18, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Tel: +94 77 685 8969   |   Email: matricespvtltd@gmail.com', pageWidth / 2, 24, { align: 'center' });

      // Horizontal Divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(14, 29, pageWidth - 14, 29);

      let headerY = 36;

      // === LEFT SIDE: INVOICED TO ===
      let shopY = headerY;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text('INVOICED TO:', 14, shopY);

      shopY += 5;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(order.shop?.name || '-').toUpperCase(), 14, shopY);

      shopY += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`SHOP ID: ${order.shop?.shopId || '-'}`, 14, shopY);

      if (order.shop?.address) {
        shopY += 5;
        doc.text(String(order.shop.address).toUpperCase(), 14, shopY);
      }
      if (order.shop?.phone) {
        shopY += 5;
        doc.text(`PHONE: ${order.shop.phone}`, 14, shopY);
      }

      // === RIGHT SIDE: INVOICE DETAILS ===
      const rightX = pageWidth - 75;
      let infoY = headerY;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(148, 163, 184);
      doc.text('INVOICE DETAILS:', rightX, infoY);

      infoY += 5;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Invoice No  :  ${order.orderId}`, rightX, infoY);

      const invoiceDateStr = order.date ? new Date(order.date).toISOString().split('T')[0] : '';
      infoY += 5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Date           :  ${invoiceDateStr}`, rightX, infoY);

      const billedByName = formatDisplayName(order.salesrep || order.salesRep || order.createdBy) || 'Admin';
      infoY += 5;
      doc.text(`Billed By     :  ${billedByName}`, rightX, infoY);

      const startTableY = Math.max(shopY, infoY) + 8;

      // === ITEM TABLE ===
      const tableData = (order.items || []).map(item => [
        item.productID || '-',
        item.name + (item.note ? ` (${item.note})` : ''),
        item.quantity.toString(),
        `Rs. ${Number(item.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        `Rs. ${(Number(item.quantity || 0) * Number(item.price || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      ]);

      const autoTableOptions = {
        startY: startTableY,
        head: [['PRODUCT ID', 'ITEM DESCRIPTION', 'QTY', 'UNIT PRICE', 'SUBTOTAL']],
        body: tableData,
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 8, font: 'helvetica', cellPadding: 3 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 32 },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'right', cellWidth: 35 },
          4: { halign: 'right', fontStyle: 'bold', cellWidth: 40 }
        }
      };

      if (typeof (doc as any).autoTable === 'function') {
        (doc as any).autoTable(autoTableOptions);
      } else if (typeof (window as any).autoTable === 'function') {
        (window as any).autoTable(doc, autoTableOptions);
      }

      // === TOTALS ===
      let finalY = (doc as any).lastAutoTable.finalY + 8;
      const subtotal = order.subtotal || (order.items || []).reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.quantity || 0)), 0);
      const discountAmount = order.discountAmount || (order.discount > 0 ? (subtotal * order.discount / 100) : 0);
      const discountPercent = order.discount || (subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : 0);
      const total = order.total || (subtotal - discountAmount);
      const totalPaid = order.totalPaid || 0;
      const remainingAmount = Math.max(0, total - totalPaid);

      const labelX = pageWidth - 80;
      const valX = pageWidth - 14;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('SUBTOTAL:', labelX, finalY);
      doc.text(`Rs. ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, valX, finalY, { align: 'right' });

      if (discountAmount > 0 || discountPercent > 0) {
        finalY += 6;
        doc.setTextColor(225, 29, 72);
        doc.text(`DISCOUNT (${discountPercent}%):`, labelX, finalY);
        doc.text(`-Rs. ${discountAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, valX, finalY, { align: 'right' });
      }

      finalY += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('GRAND TOTAL:', labelX, finalY);
      doc.text(`Rs. ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, valX, finalY, { align: 'right' });

      finalY += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 128, 61);
      doc.text('TOTAL PAID:', labelX, finalY);
      doc.text(`Rs. ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, valX, finalY, { align: 'right' });

      finalY += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(190, 18, 60);
      doc.text('BALANCE DUE:', labelX, finalY);
      doc.text(`Rs. ${remainingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, valX, finalY, { align: 'right' });

      // Save PDF directly to device
      doc.save(`Invoice_${order.orderId}.pdf`);
    } catch (err) {
      console.error('Error generating PDF file:', err);
      alert('Could not download PDF to device. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-invoice-content,
          #printable-invoice-content * {
            visibility: visible !important;
          }
          .no-print,
          .print\\:hidden {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      <Header showSearch={false} />
      <main className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-6">

          <PinModal
            isOpen={showPinModal}
            onClose={() => {
              if (!isPinVerified) {
                window.location.href = '/settings/invoices';
              } else {
                setShowPinModal(false);
              }
            }}
            onSuccess={() => setShowPinModal(false)}
          />

          {!isPinVerified ? (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-12 text-center shadow-2xl">
              <Lock className="w-12 h-12 text-[#0f172a] mx-auto mb-4 animate-bounce" />
              <h2 className="text-xl font-black text-[#0f172a] uppercase">PIN VERIFICATION REQUIRED</h2>
              <p className="text-xs text-gray-500 font-semibold mt-2 mb-6">PLEASE VERIFY PIN TO VIEW DETAILED INVOICE DATA</p>
              <button
                onClick={() => setShowPinModal(true)}
                className="px-6 py-3 bg-[#0f172a] text-white font-black text-xs uppercase rounded-full shadow-lg hover:bg-[#1e293b] transition-all cursor-pointer"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : isLoading ? (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-16 text-center shadow-2xl">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a] mx-auto mb-4" />
              <p className="text-xs font-black text-[#0f172a] uppercase">LOADING INVOICE DETAILS...</p>
            </div>
          ) : !order ? (
            <div className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-16 text-center shadow-2xl space-y-4">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
              <h2 className="text-xl font-black text-[#0f172a] uppercase">INVOICE NOT FOUND</h2>
              <p className="text-xs text-gray-500 font-semibold uppercase">{error || 'COULD NOT RETRIEVE INVOICE DETAILS'}</p>
              <Link
                href="/settings/invoices"
                className="inline-block px-6 py-3 bg-[#0f172a] text-white font-black text-xs uppercase rounded-full shadow-lg hover:bg-[#1e293b] transition-all"
              >
                RETURN TO INVOICES
              </Link>
            </div>
          ) : (() => {
            const subtotal = order.subtotal || (order.items || []).reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0);
            const discountAmount = order.discountAmount || (order.discount > 0 ? (subtotal * order.discount / 100) : 0);
            const discountPercent = order.discount || (subtotal > 0 && discountAmount > 0 ? Math.round((discountAmount / subtotal) * 100) : 0);
            const total = order.total || (subtotal - discountAmount);
            const totalPaid = order.totalPaid || 0;
            const remainingAmount = Math.max(0, total - totalPaid);

            return (
              <>
                <div className="flex items-center justify-between gap-4 mb-6 print:hidden no-print">
                  <Link
                    href="/settings/invoices"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/80 hover:bg-white border border-white/80 px-4 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <ArrowLeft size={14} /> BACK TO INVOICES
                  </Link>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleDownloadPdf}
                      disabled={isDownloading}
                      className="px-6 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-lg flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isDownloading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      ) : (
                        <Download size={16} />
                      )}
                      DOWNLOAD PDF
                    </button>
                  </div>
                </div>

                {/* Printable Invoice Container */}
                <div id="printable-invoice-content" className="bg-white rounded-[2rem] p-6 sm:p-10 shadow-2xl border border-gray-200 uppercase">
                  {/* Centered Header */}
                  <div className="text-center pb-5 border-b-2 border-gray-900">
                    <h1 className="text-3xl font-black text-[#0f172a] tracking-widest uppercase">MATRICES</h1>
                    <p className="text-xs font-bold text-slate-600 mt-1 uppercase tracking-wide">
                      Tel: +94 77 685 8969 &nbsp;|&nbsp; Email: matricespvtltd@gmail.com
                    </p>
                  </div>

                  {/* Two Column Layout: INVOICED TO (Left) & INVOICE DETAILS (Right) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 my-6 bg-slate-50/80 rounded-2xl border border-slate-200">
                    {/* Left Side: INVOICED TO */}
                    <div>
                      <p className="text-[0.7rem] font-black text-slate-400 uppercase tracking-wider mb-1">INVOICED TO</p>
                      <h2 className="text-base font-black text-[#0f172a] uppercase">{order.shop.name}</h2>
                      <p className="text-xs text-slate-700 font-bold uppercase mt-1">SHOP ID: {order.shop.shopId}</p>
                      {order.shop.address && <p className="text-xs text-slate-600 font-semibold uppercase mt-0.5">{order.shop.address}</p>}
                      {order.shop.phone && <p className="text-xs text-slate-600 font-semibold uppercase mt-0.5">PHONE: {order.shop.phone}</p>}
                    </div>

                    {/* Right Side: INVOICE DETAILS */}
                    <div className="sm:text-right">
                      <p className="text-[0.7rem] font-black text-slate-400 uppercase tracking-wider mb-1 sm:text-right">INVOICE DETAILS</p>
                      <div className="inline-block text-left text-xs font-semibold text-slate-700 space-y-1">
                        <div className="flex justify-between gap-4">
                          <span className="font-bold text-slate-500">Invoice No :</span>
                          <span className="font-black text-[#0f172a]">{order.orderId}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="font-bold text-slate-500">Date :</span>
                          <span className="font-bold text-slate-800">{order.date ? new Date(order.date).toISOString().split('T')[0] : '-'}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="font-bold text-slate-500">Billed By :</span>
                          <span className="font-black text-[#0f172a]">{formatDisplayName(order.salesrep || order.salesRep || order.createdBy) || 'Admin'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full text-left text-xs font-bold">
                      <thead>
                        <tr className="border-b-2 border-gray-200 text-gray-500 uppercase text-[0.65rem]">
                          <th className="py-3 px-2">PRODUCT ID</th>
                          <th className="py-3 px-2">ITEM DESCRIPTION</th>
                          <th className="py-3 px-2 text-center">QTY</th>
                          <th className="py-3 px-2 text-right">UNIT PRICE</th>
                          <th className="py-3 px-2 text-right">TOTAL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {order.items.map((item, idx) => (
                          <tr key={item.productID ? `item-${item.productID}-${idx}` : `item-row-${idx}`} className="hover:bg-gray-50/50">
                            <td className="py-3 px-2 font-black text-[#0f172a]">{item.productID}</td>
                            <td className="py-3 px-2">
                              {item.name}
                              {item.note && <span className="block text-[0.65rem] text-gray-400 font-normal">{item.note}</span>}
                            </td>
                            <td className="py-3 px-2 text-center">{item.quantity}</td>
                            <td className="py-3 px-2 text-right">{formatPrice(item.price)}</td>
                            <td className="py-3 px-2 text-right font-black text-[#0f172a]">
                              {formatPrice(item.quantity * item.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals Summary */}
                  <div className="flex flex-col sm:flex-row justify-end mb-8 pt-4 border-t border-gray-200">
                    <div className="w-full sm:w-72 space-y-2 text-xs font-bold">
                      <div className="flex justify-between text-gray-600">
                        <span>SUBTOTAL</span>
                        <span>{formatPrice(subtotal)}</span>
                      </div>
                      {(discountAmount > 0 || discountPercent > 0) && (
                        <div className="flex justify-between text-rose-600 font-black">
                          <span>DISCOUNT ({discountPercent}%)</span>
                          <span>-{formatPrice(discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-black text-[#0f172a] pt-2 border-t border-gray-200">
                        <span>GRAND TOTAL</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-green-700 font-bold">
                        <span>TOTAL PAID</span>
                        <span>{formatPrice(totalPaid)}</span>
                      </div>
                      <div className="flex justify-between text-rose-700 font-black pt-2 border-t border-gray-200 text-sm">
                        <span>BALANCE DUE</span>
                        <span>{formatPrice(remainingAmount)}</span>
                      </div>
                    </div>
                  </div>

                  {order.payments && order.payments.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-2">PAYMENT HISTORY</p>
                      <div className="space-y-2 text-xs font-semibold">
                        {order.payments.map((p, idx) => (
                          <div key={p.id ? `pmt-${p.id}-${idx}` : `pmt-row-${idx}`} className="flex justify-between p-3 bg-gray-50 rounded-xl uppercase">
                            <span>{new Date(p.date).toLocaleDateString()} - METHOD: {p.paymentMethod}</span>
                            <span className="font-black text-green-700">{formatPrice(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-8 text-center text-[0.65rem] text-gray-400 font-bold uppercase border-t border-gray-200">
                    <p>THANK YOU FOR YOUR BUSINESS! FOR ENQUIRIES, CONTACT SUPPORT AT matricespvtltd@gmail.com</p>
                  </div>
                </div>
              </>
            );
          })()}

        </div>
      </main>
    </>
  );
}
