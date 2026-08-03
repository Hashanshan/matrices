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
    if (!res.ok) throw new Error('Failed to fetch invoice');
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
            margin: 0 !important;
            padding: 20px !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            border-radius: 0 !important;
          }
          .no-print, .print\\:hidden {
            display: none !important;
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
                window.location.href = '/settings/invoices';
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
                href="/settings/invoices"
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-wider shadow-lg"
              >
                BACK TO INVOICES
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
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start border-b border-gray-200 pb-6 mb-6">
                    <div>
                      <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">MATRICES</h1>
                      <p className="text-xs text-gray-500 font-bold tracking-wider mt-1">COMMERCIAL & DISTRIBUTION SERVICES</p>
                      <p className="text-xs text-gray-500 font-bold">COLOMBO, SRI LANKA</p>
                    </div>
                    <div className="mt-4 sm:mt-0 text-left sm:text-right">
                      <div className="inline-block px-4 py-1.5 bg-[#0f172a] text-white font-black text-xs tracking-wider rounded-lg mb-2">
                        INVOICE #{order.orderId}
                      </div>
                      <p className="text-xs text-gray-500 font-bold">
                        DATE: {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-xs font-bold text-[#0f172a] mt-0.5">
                        STATUS: <span className="font-black text-green-700">{order.status}</span>
                      </p>
                    </div>
                  </div>

                  {/* Customer / Shop Info */}
                  <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100">
                    <p className="text-[0.65rem] font-black text-gray-400 uppercase tracking-wider mb-2">INVOICED TO</p>
                    <h2 className="text-lg font-black text-[#0f172a]">{order.shop.name}</h2>
                    <p className="text-xs font-bold text-gray-600 mt-1">SHOP ID: {order.shop.shopId}</p>
                    <p className="text-xs text-gray-500">{order.shop.address}</p>
                    <p className="text-xs text-gray-500">PHONE: {order.shop.phone}</p>
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
                          <tr key={idx} className="hover:bg-gray-50/50">
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
            );
          })()}

        </div>
      </main>
    </>
  );
}
