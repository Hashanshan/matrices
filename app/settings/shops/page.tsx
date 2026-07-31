'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import Pagination from '@/components/pagination';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, Phone, MapPin, Edit, ShieldCheck, Heart, Search, Lock, X, Check, FileText,
  Plus, Camera, Upload, Navigation, ExternalLink, Image as ImageIcon, Trash2, Compass
} from 'lucide-react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import Swal from 'sweetalert2';
import { formatPrice } from '@/lib/currency';

interface Shop {
  shopId: string;
  name: string;
  phone: string;
  address: string;
  mapUrl?: string;
  imageUrl?: string;
  deliveredOrders: number;
  pendingOrders: number;
  totalSales: number;
  chequeCount: number;
  chequeValue: number;
  currentCredit: number;
}

const fetcher = async (url: string) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ msg: 'Failed to load shops' }));
    throw new Error(error.msg || 'Failed to fetch');
  }
  return res.json();
};

export default function ShopsSettingsPage() {
  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Modal State (Add & Edit)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);

  // Form Fields State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formMapUrl, setFormMapUrl] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Location Check-in state
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Camera capture modal state
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

  // Build SWR query key
  const queryParams = new URLSearchParams();
  if (searchQuery) queryParams.set('searchQuery', searchQuery);
  queryParams.set('page', String(page));
  queryParams.set('limit', '9');
  queryParams.set('sortField', 'updatedAt');
  queryParams.set('sortOrder', '-1');

  const swrKey = `/api/shops?${queryParams.toString()}`;
  const { data, isLoading } = useSWR(swrKey, fetcher, {
    revalidateOnFocus: true,
  });

  const shops: Shop[] = data?.shops || [];
  const totalRecords: number = data?.totalRecords || shops.length;
  const totalPages: number = data?.totalPages || 1;

  // Require Security PIN verification on visit
  useEffect(() => {
    resetPinVerification();
  }, []);

  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleOpenAddModal = () => {
    setEditingShop(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormMapUrl('');
    setFormImageUrl('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (shop: Shop) => {
    setIsAddModalOpen(false);
    setEditingShop(shop);
    setFormName(shop.name || '');
    setFormPhone(shop.phone || '');
    setFormAddress(shop.address || '');
    setFormMapUrl(shop.mapUrl || '');
    setFormImageUrl(shop.imageUrl || '');
  };

  const handleCloseModal = () => {
    setIsAddModalOpen(false);
    setEditingShop(null);
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormMapUrl('');
    setFormImageUrl('');
  };

  // Location Check-in via Geolocation API
  const handleCheckInLocation = () => {
    if (!navigator.geolocation) {
      Swal.fire({
        icon: 'warning',
        title: 'Geolocation Unsupported',
        text: 'Geolocation is not supported by your browser. Please enter Google Maps URL manually.',
      });
      return;
    }

    setIsCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setFormMapUrl(mapsUrl);
        setIsCheckingIn(false);
        Swal.fire({
          icon: 'success',
          title: 'Location Checked In!',
          text: `GPS Location Captured: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          timer: 2000,
          showConfirmButton: false,
        });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setIsCheckingIn(false);
        Swal.fire({
          icon: 'error',
          title: 'Location Check-in Failed',
          text: err.message || 'Could not fetch current GPS location. Please allow location permissions or enter map URL manually.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Image File Upload Handler
  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'File Too Large', text: 'Please select an image smaller than 10MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setFormImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // WebCam Live Camera Viewfinder Controls
  const openCamera = async () => {
    try {
      setShowCameraModal(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setShowCameraModal(false);
      if (mobileCameraInputRef.current) {
        mobileCameraInputRef.current.click();
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Camera Access Error',
          text: err.message || 'Could not open camera stream. Please upload an image file from your device.',
        });
      }
    }
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFormImageUrl(dataUrl);
    }
    closeCamera();
  };

  // Submit Add or Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      const isEdit = !!editingShop;
      const url = isEdit ? `/api/shops/${editingShop.shopId}` : '/api/shops/create';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: formName,
          phone: formPhone,
          address: formAddress,
          mapUrl: formMapUrl,
          imageUrl: formImageUrl,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.msg || result.message || 'Failed to save shop details');
      }

      Swal.fire({
        icon: 'success',
        title: isEdit ? 'Shop Updated' : 'Shop Created',
        text: isEdit ? 'Shop details updated successfully' : 'New shop created successfully',
        timer: 2000,
        showConfirmButton: false,
      });

      handleCloseModal();
      mutate(swrKey);
    } catch (err: any) {
      console.error('Error saving shop:', err);
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.message || 'Error saving shop details',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isModalOpen = isAddModalOpen || !!editingShop;

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat bg-fixed py-4 sm:py-8 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">

          {/* Security PIN Gate Modal */}
          <PinModal
            isOpen={showPinModal}
            onClose={() => {
              if (!isPinVerified) {
                window.location.href = '/catalogue';
              } else {
                setShowPinModal(false);
              }
            }}
            onSuccess={() => setShowPinModal(false)}
          />

          {!isPinVerified ? (
            <div className="flex flex-col items-center justify-center py-24 sm:py-32 text-center px-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mb-4 shadow-xl border border-white/20">
                <Lock size={32} />
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0f172a] uppercase mb-2">SHOPS PAGE IS LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS YOUR ASSIGNED SHOPS.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all cursor-pointer"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : (
            <>
              {/* Header Title & Top Navigation Section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 sm:p-3.5 bg-[#0f172a]/10 border border-[#0f172a]/20 rounded-full text-[#0f172a] shadow-sm flex items-center justify-center shrink-0">
                    <Store size={28} />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      MY SHOPS
                    </h1>
                    <p className="text-[0.7rem] sm:text-xs text-gray-500 font-bold tracking-wide mt-0.5 uppercase">
                      VIEW, CREATE AND MANAGE DETAILS FOR YOUR ASSIGNED SHOPS
                    </p>
                  </div>
                </div>

                {/* Right Header Controls: Add Shop Button + Mobile Nav Links */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={handleOpenAddModal}
                    className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider px-5 py-3 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Plus size={16} /> ADD NEW SHOP
                  </button>

                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none max-w-full shrink-0">
                    <Link
                      href="/settings/orders"
                      className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <FileText size={14} /> ORDERS
                    </Link>
                    <Link
                      href="/settings/wishlist"
                      className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Heart size={14} fill="#ef4444" className="text-red-500" /> WISHLIST
                    </Link>
                    <Link
                      href="/settings/security"
                      className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-3.5 py-2.5 rounded-full shadow-xs transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck size={14} /> SECURITY
                    </Link>
                    <span className="text-xs font-black text-white bg-[#0f172a] px-4 py-2.5 rounded-full shadow-xs uppercase whitespace-nowrap shrink-0">
                      {totalRecords} {totalRecords === 1 ? 'SHOP' : 'SHOPS'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="relative max-w-md w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => handleSearchChange(e.target.value)}
                    placeholder="SEARCH SHOPS BY NAME, ID, PHONE, ADDRESS..."
                    className="w-full pl-11 pr-4 py-3 bg-white/50 backdrop-blur-xl border border-white/60 rounded-full text-xs font-bold text-[#0f172a] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0f172a]/30 shadow-sm uppercase"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-16 bg-white/20 backdrop-blur-2xl rounded-[2rem] border border-white/60 shadow-lg px-4">
                  <div className="w-16 h-16 bg-gray-100/50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-600">
                    <Store size={32} />
                  </div>
                  <h2 className="text-xl font-black text-[#0f172a] uppercase mb-2">
                    NO ASSIGNED SHOPS FOUND
                  </h2>
                  <p className="text-gray-500 font-semibold mb-6 max-w-md mx-auto uppercase text-xs">
                    {searchQuery
                      ? 'TRY A DIFFERENT SEARCH TERM TO FIND ASSIGNED SHOPS.'
                      : 'YOU CURRENTLY DO NOT HAVE ANY ACTIVE SHOPS. CLICK "ADD NEW SHOP" ABOVE TO CREATE ONE.'}
                  </p>
                  <button
                    onClick={handleOpenAddModal}
                    className="bg-[#0f172a] text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-wider shadow-lg inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus size={16} /> ADD YOUR FIRST SHOP
                  </button>
                </div>
              ) : (
                <>
                  {/* Shop Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
                    {shops.map((shop) => (
                      <motion.div
                        key={shop.shopId}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/40 backdrop-blur-2xl border border-white/60 rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-6 shadow-[0_15px_45px_rgba(0,0,0,0.06)] flex flex-col justify-between group hover:border-white/90 transition-all overflow-hidden"
                      >
                        <div>
                          {/* Shop Image Cover Banner */}
                          {shop.imageUrl ? (
                            <div className="relative w-full h-40 sm:h-44 rounded-2xl sm:rounded-3xl overflow-hidden mb-4 border border-white/80 shadow-sm group-hover:scale-[1.01] transition-transform">
                              <img
                                src={shop.imageUrl}
                                alt={shop.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-3">
                                <span className="text-[0.65rem] font-black text-white tracking-widest uppercase bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                                  {shop.shopId}
                                </span>
                              </div>
                            </div>
                          ) : null}

                          {/* Header Badge & Title */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="min-w-0">
                              {!shop.imageUrl && (
                                <span className="text-[0.65rem] font-black text-[#0f172a] tracking-widest uppercase bg-white/60 border border-white/80 px-3 py-1 rounded-full inline-block mb-2 shadow-xs">
                                  {shop.shopId}
                                </span>
                              )}
                              <h3 className="font-extrabold text-[#0f172a] text-lg sm:text-xl uppercase leading-tight truncate">
                                {shop.name}
                              </h3>
                            </div>
                            <button
                              onClick={() => handleOpenEditModal(shop)}
                              className="p-2.5 sm:p-3 bg-white/70 hover:bg-white text-[#0f172a] rounded-full transition-all border border-white/60 shadow-sm flex-shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                              title="Edit Shop Details"
                            >
                              <Edit size={16} />
                            </button>
                          </div>

                          {/* Contact, Location & Map Checkin Info */}
                          <div className="space-y-2 mb-5">
                            <a
                              href={`tel:${shop.phone}`}
                              className="flex items-center gap-2 text-xs font-bold text-[#0f172a] hover:text-blue-600 transition-colors uppercase"
                            >
                              <Phone size={14} className="text-gray-500 shrink-0" />
                              <span>{shop.phone || 'NO PHONE'}</span>
                            </a>
                            <div className="flex items-start gap-2 text-xs font-bold text-gray-600 uppercase">
                              <MapPin size={14} className="text-gray-500 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{shop.address || 'NO ADDRESS'}</span>
                            </div>

                            {/* Location Map Check-in Badge */}
                            {shop.mapUrl ? (
                              <div className="pt-1">
                                <a
                                  href={shop.mapUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0f172a]/10 hover:bg-[#0f172a] text-[#0f172a] hover:text-white rounded-full text-[0.65rem] font-black uppercase transition-all border border-[#0f172a]/20 shadow-2xs group/map"
                                >
                                  <Navigation size={12} className="text-blue-600 group-hover/map:text-white shrink-0 animate-pulse" />
                                  <span>VIEW MAP LOCATION</span>
                                  <ExternalLink size={10} className="shrink-0" />
                                </a>
                              </div>
                            ) : null}
                          </div>

                          {/* Metrics Projected Fields Grid */}
                          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-200/50 mb-5">
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">TOTAL SALES</span>
                              <span className="text-xs sm:text-sm font-black text-[#0f172a]">{formatPrice(shop.totalSales)}</span>
                            </div>
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">CREDIT</span>
                              <span className="text-xs sm:text-sm font-black text-[#0f172a]">{formatPrice(shop.currentCredit)}</span>
                            </div>
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">DELIVERED</span>
                              <span className="text-xs sm:text-sm font-black text-green-700">{shop.deliveredOrders}</span>
                            </div>
                            <div className="bg-white/50 rounded-2xl p-2.5 sm:p-3 border border-white/60">
                              <span className="text-[0.65rem] text-gray-500 font-bold uppercase block">PENDING</span>
                              <span className="text-xs sm:text-sm font-black text-amber-700">{shop.pendingOrders}</span>
                            </div>
                          </div>
                        </div>

                        {/* View Invoices / Single View Action Button */}
                        <Link
                          href={`/settings/shops/${shop.shopId}`}
                          className="w-full py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase tracking-wider rounded-full shadow-md transition-all text-center block"
                        >
                          VIEW SHOP INVOICES
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  {/* API Pagination */}
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={(p) => setPage(p)}
                    className="mt-6 mb-4"
                  />
                </>
              )}
            </>
          )}

        </div>
      </main>

      {/* Hidden Mobile Native Camera Input Fallback */}
      <input
        type="file"
        ref={mobileCameraInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Responsive Add / Edit Shop Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-7 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto my-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-[#0f172a] text-white rounded-2xl shadow-sm">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#0f172a] uppercase leading-tight">
                    {editingShop ? 'EDIT SHOP INFO' : 'ADD NEW SHOP'}
                  </h3>
                  <p className="text-[0.65rem] text-gray-500 font-bold uppercase">
                    {editingShop ? `UPDATE DETAILS FOR ${editingShop.shopId}` : 'ENTER SHOP DETAILS & LOCATION'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">

              {/* Shop ID (Disabled if Editing) */}
              {editingShop && (
                <div>
                  <label className="block text-[0.7rem] font-black text-gray-500 uppercase mb-1">SHOP ID</label>
                  <input
                    type="text"
                    disabled
                    value={editingShop.shopId}
                    className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-2xl text-xs font-bold text-gray-500 cursor-not-allowed uppercase"
                  />
                </div>
              )}

              {/* Shop Name */}
              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">
                  SHOP NAME <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="E.G. METRO SUPERMART"
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 focus:border-[#0f172a] rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 uppercase transition-all"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">
                  PHONE NUMBER <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="E.G. 0771234567"
                  className="w-full px-4 py-3 bg-gray-50/50 border border-gray-300 focus:border-[#0f172a] rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 uppercase transition-all"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-1">
                  ADDRESS <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="E.G. MAIN STREET, COLOMBO 03"
                  className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-300 focus:border-[#0f172a] rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 uppercase transition-all"
                />
              </div>

              {/* Location Check-in & Map URL */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-black text-[#0f172a] uppercase flex items-center gap-1.5">
                    <Navigation size={14} className="text-blue-600" /> LOCATION CHECK-IN / MAP URL
                  </label>

                  {/* Geolocation Button */}
                  <button
                    type="button"
                    onClick={handleCheckInLocation}
                    disabled={isCheckingIn}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-full text-[0.65rem] font-black uppercase transition-all border border-blue-200 cursor-pointer disabled:opacity-50"
                  >
                    {isCheckingIn ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700" />
                    ) : (
                      <Compass size={13} />
                    )}
                    <span>{isCheckingIn ? 'LOCATING...' : 'CHECK IN CURRENT LOCATION'}</span>
                  </button>
                </div>

                <input
                  type="url"
                  value={formMapUrl}
                  onChange={e => setFormMapUrl(e.target.value)}
                  placeholder="HTTPS://WWW.GOOGLE.COM/MAPS?Q=LAT,LNG"
                  className="w-full px-4 py-2.5 bg-gray-50/50 border border-gray-300 focus:border-[#0f172a] rounded-2xl text-xs font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 transition-all placeholder:text-gray-400"
                />

                {formMapUrl && (
                  <div className="mt-1.5 flex items-center justify-between text-[0.65rem] px-1 font-bold text-gray-500 uppercase">
                    <span className="text-green-600 flex items-center gap-1">
                      <Check size={12} /> MAP URL SET
                    </span>
                    <a
                      href={formMapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1"
                    >
                      TEST LINK <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>

              {/* Shop Image Upload & Direct Camera Capture */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-black text-[#0f172a] uppercase mb-2 flex items-center gap-1.5">
                  <ImageIcon size={14} className="text-purple-600" /> SHOP PHOTO
                </label>

                {formImageUrl ? (
                  <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-gray-200 group">
                    <img src={formImageUrl} alt="Shop preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormImageUrl('')}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow-lg hover:bg-red-700 transition-all cursor-pointer"
                      title="Remove Photo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* File Picker Button */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="py-3 px-3 border-2 border-dashed border-gray-300 hover:border-[#0f172a] bg-gray-50 hover:bg-gray-100 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group"
                    >
                      <Upload size={18} className="text-gray-500 group-hover:text-[#0f172a] transition-colors" />
                      <span className="text-[0.65rem] font-black text-[#0f172a] uppercase">UPLOAD IMAGE FILE</span>
                    </button>

                    {/* Camera Capture Button */}
                    <button
                      type="button"
                      onClick={openCamera}
                      className="py-3 px-3 border-2 border-dashed border-gray-300 hover:border-[#0f172a] bg-gray-50 hover:bg-gray-100 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group"
                    >
                      <Camera size={18} className="text-gray-500 group-hover:text-[#0f172a] transition-colors" />
                      <span className="text-[0.65rem] font-black text-[#0f172a] uppercase">CAPTURE FROM CAMERA</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-[#0f172a] font-black text-xs uppercase rounded-full transition-all cursor-pointer"
                >
                  CANCEL
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Check size={16} />
                  )}
                  {editingShop ? 'SAVE CHANGES' : 'CREATE SHOP'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* WebCam Live Camera Viewfinder Modal */}
      {showCameraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-gray-800 text-center">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <span className="text-xs font-black text-[#0f172a] uppercase flex items-center gap-2">
                <Camera size={16} /> LIVE CAMERA VIEWFINDER
              </span>
              <button
                type="button"
                onClick={closeCamera}
                className="p-1 text-gray-400 hover:text-black rounded-full cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative w-full h-64 bg-black rounded-2xl overflow-hidden mb-4 shadow-inner flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={closeCamera}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#0f172a] font-black text-xs uppercase rounded-full transition-all cursor-pointer"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="px-6 py-2.5 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Camera size={16} /> SNAP PHOTO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
