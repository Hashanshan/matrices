'use client';

import { useState, useEffect, use } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import { motion } from 'framer-[#0f172a]' ;
import { FileText, ArrowLeft, Printer, Download, Lock, CheckCircle2, Clock, AlertCircle, XCircle, ShoppingBag, Store, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
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
}

import { resolveApiUrl, getAuthToken } from '@/lib/utils';
import { offlineDB } from '@/lib/offline/indexed-db';

const fetcher = async (url: string) => {
  const mode = typeof window !== 'undefined' ? (localStorage.getItem('matrices_data_mode') as string) : 'online';
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  // Extract orderId from URL like /api/orders/ORD123
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
    return found ? { success: true, order: found } : { success: false, order: null };
  };

  if (mode === 'offline' || isOffline) return getOfflineOrder();

  const token = getAuthToken();
  const targetUrl = resolveApiUrl(url);
  try {
    const res = await fetch(targetUrl, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (!res.ok) throw new Error('Failed to fetch order');
    return res.json();
  } catch {
    return getOfflineOrder();
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
  } catch (e) {}

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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!order || isDownloading) return;
    setIsDownloading(true);
    try {
      if (!(window as any).html2pdf) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const element = document.getElementById('printable-invoice-content');
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

      await (window as any).html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error('Error downloading PDF file:', err);
      window.print();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <style jsx global>{`
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
          #printable-invoice-content,
          #printable-invoice-content * {
            visibility: visible !important;
          }
          #printable-invoice-content {
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

      <Header showSearch={false} />
      <main className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          <PinModal
            isOpen={showPinModal}
            onClose={() => {
              if (!isPinVerified) {
                window.location.href = '/settings/orders';
              } else {
                setShowPinModal(false);
              }
            }}
            onSuccess={() => setShowPinModal(false)}
          />

          {!isPinVerified ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mb-4 shadow-xl border border-white/20">
                <Lock size={36} />
              </div>
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">INVOICE VIEW IS LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO VIEW THIS PDF INVOICE.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-32">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
            </div>
          ) : !order ? (
            <div className="text-center py-20 bg-white/20 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-lg">
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">INVOICE NOT FOUND</h2>
              <p className="text-gray-500 font-semibold mb-6 text-xs uppercase">
                THE REQUESTED INVOICE DOES NOT EXIST OR IS NOT ACCESSIBLE.
              </p>
              <Link
                href="/settings/orders"
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-wider shadow-lg"
              >
                BACK TO ORDERS
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 mb-6 print:hidden no-print">
                <Link
                  href="/settings/orders"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/60 hover:bg-white text-[#0f172a] font-black text-xs uppercase rounded-full border border-white/60 shadow-sm transition-all"
                >
                  <ArrowLeft size={16} /> BACK TO ORDERS
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

                  <button
                    onClick={handlePrint}
                    className="px-5 py-3 bg-white hover:bg-gray-100 text-[#0f172a] font-black text-xs uppercase rounded-full border border-gray-300 shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Printer size={16} /> PRINT
                  </button>
                </div>
              </div>

              <div
                id="printable-invoice-content"
                className="bg-white rounded-[2.5rem] p-6 sm:p-12 text-gray-900 shadow-2xl border border-gray-100 space-y-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-gray-900">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] tracking-wider uppercase">MATRICES</h1>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-1">COMMERCIAL & DISTRIBUTION SERVICES</p>
                    <p className="text-xs text-gray-600 font-semibold uppercase mt-0.5">COLOMBO, SRI LANKA</p>
                  </div>

                  <div className="sm:text-right">
                    <span className="inline-block px-5 py-2 bg-[#0f172a] text-white font-black text-sm uppercase rounded-xl mb-2 shadow-xs">
                      INVOICE #{order.orderId}
                    </span>
                    <p className="text-xs text-gray-500 font-bold uppercase">
                      DATE: {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-500 font-bold uppercase mt-0.5">
                      STATUS: <span className="font-black text-[#0f172a] uppercase">{order.status}</span>
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200">
                  <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-1">INVOICED TO</p>
                  <h2 className="text-xl font-black text-[#0f172a] uppercase">{order.shop.name}</h2>
                  <p className="text-xs text-gray-600 font-semibold uppercase mt-0.5">SHOP ID: {order.shop.shopId}</p>
                  <p className="text-xs text-gray-600 font-semibold uppercase">{order.shop.address}</p>
                  <p className="text-xs text-gray-600 font-semibold uppercase">PHONE: {order.shop.phone}</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-[#0f172a] text-white uppercase font-black">
                        <th className="p-3.5 rounded-l-xl">PRODUCT ID</th>
                        <th className="p-3.5">ITEM DESCRIPTION</th>
                        <th className="p-3.5 text-center">QTY</th>
                        <th className="p-3.5 text-right">UNIT PRICE</th>
                        <th className="p-3.5 text-right rounded-r-xl">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {order.items.map((item, idx) => (
                        <tr key={idx} className="font-semibold text-gray-800 uppercase">
                          <td className="p-3.5 font-black text-[#0f172a]">{item.productID}</td>
                          <td className="p-3.5">{item.name}</td>
                          <td className="p-3.5 text-center">{item.quantity}</td>
                          <td className="p-3.5 text-right">{formatPrice(item.price)}</td>
                          <td className="p-3.5 text-right font-black text-[#0f172a]">{formatPrice(item.quantity * item.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end pt-4">
                  <div className="w-full max-w-xs space-y-2.5 text-xs font-bold border-t-2 border-gray-900 pt-4">
                    <div className="flex justify-between text-gray-600 uppercase">
                      <span>SUBTOTAL:</span>
                      <span className="font-black text-[#0f172a]">{formatPrice(order.subtotal)}</span>
                    </div>
                    {order.discount > 0 && (
                      <div className="flex justify-between text-gray-600 uppercase">
                        <span>DISCOUNT ({order.discount}%):</span>
                        <span className="font-black text-rose-600">-{formatPrice(order.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-[#0f172a] uppercase border-t pt-2.5">
                      <span>GRAND TOTAL:</span>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-green-700 uppercase">
                      <span>TOTAL PAID:</span>
                      <span>{formatPrice(order.totalPaid)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black text-rose-700 uppercase border-t border-dashed pt-2.5">
                      <span>BALANCE DUE:</span>
                      <span>{formatPrice(order.remainingAmount)}</span>
                    </div>
                  </div>
                </div>

                {order.payments && order.payments.length > 0 && (
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-2">PAYMENT HISTORY</p>
                    <div className="space-y-2 text-xs font-semibold">
                      {order.payments.map((p, idx) => (
                        <div key={idx} className="flex justify-between p-3 bg-gray-50 rounded-xl uppercase">
                          <span>{new Date(p.date).toLocaleDateString()} - METHOD: {p.paymentMethod}</span>
                          <span className="font-black text-green-700">{formatPrice(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-8 text-center text-[0.65rem] text-gray-400 font-bold uppercase border-t border-gray-200">
                  <p>THANK YOU FOR YOUR BUSINESS! FOR ENQUIRIES, CONTACT SUPPORT AT INFO@MATRICES.LK</p>
                </div>
              </div>
            </>
          )}

        </div>
      </main>
    </>
  );
}
