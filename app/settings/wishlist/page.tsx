'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { useWishlist } from '@/lib/contexts/wishlist-context';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import ProductCard from '@/components/product-card';
import { motion } from 'framer-motion';
import { Heart, ArrowUp, ArrowDown, Trash2, Folder, Layers, Package, ExternalLink, ShieldCheck, Lock } from 'lucide-react';
import Link from 'next/link';

export default function SettingsWishlistPage() {
  const { wishlist, isLoading, toggleCategoryWishlist, toggleSubcategoryWishlist, toggleProductWishlist, reorderWishlist } = useWishlist();
  const { isPinVerified, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);

  const [activeTab, setActiveTab] = useState<'all' | 'categories' | 'subcategories' | 'products'>('all');

  const categories = wishlist.categories || [];
  const subcategories = wishlist.subcategories || [];
  const fullProducts = wishlist.fullProducts || [];

  // Require Security PIN on every visit to /settings/wishlist
  useEffect(() => {
    resetPinVerification();
  }, []);

  // Keep PIN modal open until PIN is verified
  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  // Handle reordering items
  const handleMove = async (type: 'category' | 'subcategory' | 'product', index: number, direction: 'up' | 'down') => {
    let list: any[] = [];
    if (type === 'category') list = [...categories];
    else if (type === 'subcategory') list = [...subcategories];
    else if (type === 'product') list = [...fullProducts];

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap items
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    // Format for reorder endpoint
    let itemsToSave: any[] = [];
    if (type === 'category') {
      itemsToSave = list.map(c => c.name);
    } else if (type === 'subcategory') {
      itemsToSave = list.map(s => ({ category: s.category, name: s.name }));
    } else if (type === 'product') {
      itemsToSave = list.map(p => p.wishlistId || p.product?.productId || p.product?.id);
    }

    await reorderWishlist(type, itemsToSave);
  };

  const totalCount = categories.length + subcategories.length + fullProducts.length;

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url('/bg.png')] bg-cover bg-center bg-no-repeat bg-fixed py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* PIN Verification Gate Modal */}
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
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-[#0f172a] text-white rounded-full flex items-center justify-center mb-4 shadow-xl border border-white/20">
                <Lock size={36} />
              </div>
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">WISHLIST SETTINGS ARE LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO ACCESS YOUR WISHLIST SETTINGS.
              </p>
              <button
                onClick={() => setShowPinModal(true)}
                className="bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all"
              >
                ENTER SECURITY PIN
              </button>
            </div>
          ) : (
            <>
              {/* Header Title Section */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-full text-red-500 shadow-sm flex items-center justify-center">
                    <Heart size={32} fill="#ef4444" />
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                      MY WISHLIST
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 font-bold tracking-wide mt-1 uppercase">
                      VIEW AND REORDER YOUR FAVORITE CATEGORIES, SUBCATEGORIES, AND PRODUCTS
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/settings/security"
                    className="text-xs font-black text-[#0f172a] uppercase bg-white/60 hover:bg-white border border-white/60 px-6 py-3.5 rounded-full shadow-md transition-all flex items-center gap-2"
                  >
                    <ShieldCheck size={16} /> SECURITY SETTINGS
                  </Link>
                  <span className="text-xs font-black text-white bg-[#0f172a] px-6 py-3.5 rounded-full shadow-lg uppercase">
                    {totalCount} {totalCount === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                </div>
              </div>

              {/* iPad-Style Pill Tabbed Navigation Bar */}
              <div className="flex flex-wrap items-center gap-3 mb-8 bg-white/30 backdrop-blur-xl p-2 rounded-full border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                {[
                  { id: 'all', label: 'All Items', count: totalCount, icon: Heart },
                  { id: 'categories', label: 'Categories', count: categories.length, icon: Folder },
                  { id: 'subcategories', label: 'Subcategories', count: subcategories.length, icon: Layers },
                  { id: 'products', label: 'Products', count: fullProducts.length, icon: Package },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-black text-xs sm:text-sm transition-all uppercase ${
                        isActive
                          ? 'bg-[#0f172a] text-white shadow-lg'
                          : 'text-gray-600 hover:bg-white/50 hover:text-[#0f172a]'
                      }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isLoading && totalCount === 0 ? (
                <div className="flex justify-center items-center py-32">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f172a]"></div>
                </div>
              ) : totalCount === 0 ? (
                <div className="text-center py-20 bg-white/20 backdrop-blur-2xl rounded-[2.5rem] border border-white/60 shadow-lg">
                  <div className="w-20 h-20 bg-red-100/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                    <Heart size={36} fill="none" />
                  </div>
                  <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">YOUR WISHLIST IS EMPTY</h2>
                  <p className="text-gray-500 font-semibold mb-6 max-w-md mx-auto uppercase text-xs">
                    Explore categories, subcategories, or products and click the heart icon to save them to your wishlist.
                  </p>
                  <Link
                    href="/catalogue"
                    className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-8 py-4 rounded-full font-black text-xs hover:bg-[#1e293b] transition-all shadow-lg uppercase"
                  >
                    Explore Catalogue
                  </Link>
                </div>
              ) : (
                <div className="space-y-12">

                  {/* Wishlisted Categories Section */}
                  {(activeTab === 'all' || activeTab === 'categories') && categories.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                          <Folder className="text-[#0f172a]" size={22} /> Wishlisted Categories
                        </h2>
                        <span className="text-xs font-bold text-gray-500 uppercase bg-white/50 px-4 py-1.5 rounded-full border border-white/60">
                          Use arrows to reorder
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {categories.map((cat, idx) => (
                          <motion.div
                            key={cat.name}
                            layout
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 bg-[#0f172a] text-white rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 shadow-md">
                                #{idx + 1}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-black text-[#0f172a] text-lg uppercase truncate">{cat.name}</h3>
                                <span className="text-xs text-gray-500 font-bold uppercase block">Main Category</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Link
                                href={`/gallery?category=${encodeURIComponent(cat.name)}`}
                                className="p-3 bg-white/60 hover:bg-white text-[#0f172a] rounded-full transition-all border border-white/60 shadow-sm"
                                title="Explore Category in Gallery"
                              >
                                <ExternalLink size={16} />
                              </Link>

                              <button
                                onClick={() => handleMove('category', idx, 'up')}
                                disabled={idx === 0}
                                className="p-3 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-full transition-all border border-white/60 shadow-sm"
                                title="Move Up Priority"
                              >
                                <ArrowUp size={16} />
                              </button>

                              <button
                                onClick={() => handleMove('category', idx, 'down')}
                                disabled={idx === categories.length - 1}
                                className="p-3 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-full transition-all border border-white/60 shadow-sm"
                                title="Move Down Priority"
                              >
                                <ArrowDown size={16} />
                              </button>

                              <button
                                onClick={() => toggleCategoryWishlist(cat.name)}
                                className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all border border-red-500/20 shadow-sm"
                                title="Remove from Wishlist"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Wishlisted Subcategories Section */}
                  {(activeTab === 'all' || activeTab === 'subcategories') && subcategories.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                          <Layers className="text-[#0f172a]" size={22} /> Wishlisted Subcategories
                        </h2>
                        <span className="text-xs font-bold text-gray-500 uppercase bg-white/50 px-4 py-1.5 rounded-full border border-white/60">
                          Use arrows to reorder
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subcategories.map((sub, idx) => (
                          <motion.div
                            key={`${sub.category}-${sub.name}`}
                            layout
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 shadow-[0_15px_45px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4 group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 bg-[#0f172a] text-white rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 shadow-md">
                                #{idx + 1}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-black text-[#0f172a] text-lg uppercase truncate">{sub.name}</h3>
                                <span className="text-xs text-gray-500 font-bold uppercase block truncate">IN {sub.category}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Link
                                href={`/gallery?category=${encodeURIComponent(sub.category)}&subcategory=${encodeURIComponent(sub.name)}`}
                                className="p-3 bg-white/60 hover:bg-white text-[#0f172a] rounded-full transition-all border border-white/60 shadow-sm"
                                title="Explore Subcategory in Gallery"
                              >
                                <ExternalLink size={16} />
                              </Link>

                              <button
                                onClick={() => handleMove('subcategory', idx, 'up')}
                                disabled={idx === 0}
                                className="p-3 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-full transition-all border border-white/60 shadow-sm"
                                title="Move Up Priority"
                              >
                                <ArrowUp size={16} />
                              </button>

                              <button
                                onClick={() => handleMove('subcategory', idx, 'down')}
                                disabled={idx === subcategories.length - 1}
                                className="p-3 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-full transition-all border border-white/60 shadow-sm"
                                title="Move Down Priority"
                              >
                                <ArrowDown size={16} />
                              </button>

                              <button
                                onClick={() => toggleSubcategoryWishlist(sub.category, sub.name)}
                                className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all border border-red-500/20 shadow-sm"
                                title="Remove from Wishlist"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Wishlisted Products Section */}
                  {(activeTab === 'all' || activeTab === 'products') && fullProducts.length > 0 && (
                    <section>
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-wide flex items-center gap-2">
                          <Package className="text-[#0f172a]" size={22} /> Wishlisted Products
                        </h2>
                        <span className="text-xs font-bold text-gray-500 uppercase bg-white/50 px-4 py-1.5 rounded-full border border-white/60">
                          Use arrows to reorder
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {fullProducts.map((item, idx) => {
                          if (!item.product) {
                            return (
                              <div key={item.wishlistId} className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-5 shadow-[0_15px_45px_rgba(0,0,0,0.06)] flex flex-col justify-between group h-full min-h-[300px]">
                                <div className="relative aspect-[4/5] rounded-[1.5rem] bg-[#eef1f6] flex items-center justify-center p-6 mb-4 border border-black/5">
                                  <Package className="text-gray-400" size={48} />
                                </div>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-extrabold text-[#0f172a] text-sm block uppercase">Product ID: {item.wishlistId}</span>
                                    <span className="text-xs text-gray-500 font-medium uppercase">WISHLIST ITEM</span>
                                  </div>
                                  <button
                                    onClick={() => toggleProductWishlist(item.wishlistId)}
                                    className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all border border-red-500/20"
                                    title="Remove from Wishlist"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={item.wishlistId} className="flex flex-col relative group">
                              {/* Reordering bar above Product Card */}
                              <div className="mb-3 flex items-center justify-between bg-white/50 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/60 shadow-sm">
                                <span className="text-xs font-black text-[#0f172a] uppercase">Priority #{idx + 1}</span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleMove('product', idx, 'up')}
                                    disabled={idx === 0}
                                    className="p-1.5 bg-white/80 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-full transition-all border border-white/60"
                                    title="Move Up Priority"
                                  >
                                    <ArrowUp size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleMove('product', idx, 'down')}
                                    disabled={idx === fullProducts.length - 1}
                                    className="p-1.5 bg-white/80 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-full transition-all border border-white/60"
                                    title="Move Down Priority"
                                  >
                                    <ArrowDown size={14} />
                                  </button>
                                  <button
                                    onClick={() => toggleProductWishlist(item.wishlistId)}
                                    className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-full transition-all border border-red-500/20"
                                    title="Remove from Wishlist"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>

                              <ProductCard product={item.product as any} index={idx} />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                </div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
