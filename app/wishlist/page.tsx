'use client';

import { useState } from 'react';
import Header from '@/components/header';
import { useWishlist } from '@/lib/contexts/wishlist-context';
import ProductCard from '@/components/product-card';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ArrowUp, ArrowDown, Trash2, Folder, Layers, Package, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function WishlistPage() {
  const { wishlist, isLoading, toggleCategoryWishlist, toggleSubcategoryWishlist, toggleProductWishlist, reorderWishlist } = useWishlist();

  const [activeTab, setActiveTab] = useState<'all' | 'categories' | 'subcategories' | 'products'>('all');

  const categories = wishlist.categories || [];
  const subcategories = wishlist.subcategories || [];
  const fullProducts = wishlist.fullProducts || [];

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
          
          {/* Header Title Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-500 shadow-sm">
                  <Heart size={28} fill="#ef4444" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide">
                    MY WISHLIST
                  </h1>
                  <p className="text-sm text-gray-500 font-bold tracking-wide mt-1 uppercase">
                    MANAGE & REORDER YOUR FAVORITE CATEGORIES AND PRODUCTS
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-[#0f172a] uppercase bg-white/60 backdrop-blur-xl border border-white/60 px-5 py-3 rounded-full shadow-sm">
                {totalCount} {totalCount === 1 ? 'WISHLISTED ITEM' : 'WISHLISTED ITEMS'}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-3 mb-8 bg-white/30 backdrop-blur-xl p-2 rounded-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
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
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all uppercase ${
                    isActive
                      ? 'bg-[#0f172a] text-white shadow-md'
                      : 'text-gray-600 hover:bg-white/50 hover:text-[#0f172a]'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
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
            <div className="text-center py-20 bg-white/20 backdrop-blur-2xl rounded-3xl border border-white/60 shadow-lg">
              <div className="w-20 h-20 bg-red-100/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                <Heart size={36} fill="none" />
              </div>
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">YOUR WISHLIST IS EMPTY</h2>
              <p className="text-gray-500 font-semibold mb-6 max-w-md mx-auto">
                Explore categories, subcategories, or products and click the heart icon to save them to your wishlist.
              </p>
              <Link
                href="/catalogue"
                className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-6 py-3.5 rounded-full font-bold text-sm hover:bg-[#1e293b] transition-all shadow-md uppercase"
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
                    <span className="text-xs font-bold text-gray-500 uppercase bg-white/50 px-3 py-1 rounded-full border border-white/60">
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
                        className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] flex items-center justify-between gap-4 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-[#0f172a] text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-[#0f172a] text-lg uppercase truncate">{cat.name}</h3>
                            <span className="text-xs text-gray-500 font-bold uppercase">Main Category</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Link
                            href={`/gallery?category=${encodeURIComponent(cat.name)}`}
                            className="p-2 bg-white/60 hover:bg-white text-[#0f172a] rounded-xl transition-all border border-white/60 shadow-sm"
                            title="Explore Category in Gallery"
                          >
                            <ExternalLink size={16} />
                          </Link>

                          <button
                            onClick={() => handleMove('category', idx, 'up')}
                            disabled={idx === 0}
                            className="p-2 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-xl transition-all border border-white/60 shadow-sm"
                            title="Move Up"
                          >
                            <ArrowUp size={16} />
                          </button>

                          <button
                            onClick={() => handleMove('category', idx, 'down')}
                            disabled={idx === categories.length - 1}
                            className="p-2 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-xl transition-all border border-white/60 shadow-sm"
                            title="Move Down"
                          >
                            <ArrowDown size={16} />
                          </button>

                          <button
                            onClick={() => toggleCategoryWishlist(cat.name)}
                            className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 shadow-sm"
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
                    <span className="text-xs font-bold text-gray-500 uppercase bg-white/50 px-3 py-1 rounded-full border border-white/60">
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
                        className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-2xl p-5 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)] flex items-center justify-between gap-4 group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 bg-[#0f172a] text-white rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0">
                            #{idx + 1}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-extrabold text-[#0f172a] text-lg uppercase truncate">{sub.name}</h3>
                            <span className="text-xs text-gray-500 font-bold uppercase block truncate">IN {sub.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Link
                            href={`/gallery?category=${encodeURIComponent(sub.category)}&subcategory=${encodeURIComponent(sub.name)}`}
                            className="p-2 bg-white/60 hover:bg-white text-[#0f172a] rounded-xl transition-all border border-white/60 shadow-sm"
                            title="Explore Subcategory in Gallery"
                          >
                            <ExternalLink size={16} />
                          </Link>

                          <button
                            onClick={() => handleMove('subcategory', idx, 'up')}
                            disabled={idx === 0}
                            className="p-2 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-xl transition-all border border-white/60 shadow-sm"
                            title="Move Up"
                          >
                            <ArrowUp size={16} />
                          </button>

                          <button
                            onClick={() => handleMove('subcategory', idx, 'down')}
                            disabled={idx === subcategories.length - 1}
                            className="p-2 bg-white/60 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-xl transition-all border border-white/60 shadow-sm"
                            title="Move Down"
                          >
                            <ArrowDown size={16} />
                          </button>

                          <button
                            onClick={() => toggleSubcategoryWishlist(sub.category, sub.name)}
                            className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 shadow-sm"
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
                    <span className="text-xs font-bold text-gray-500 uppercase bg-white/50 px-3 py-1 rounded-full border border-white/60">
                      Use arrows to reorder
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {fullProducts.map((item, idx) => {
                      if (!item.product) {
                        return (
                          <div key={item.wishlistId} className="p-4 bg-white/30 backdrop-blur-md rounded-2xl border border-white/60 flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-600 uppercase">Product ID: {item.wishlistId}</span>
                            <button
                              onClick={() => toggleProductWishlist(item.wishlistId)}
                              className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div key={item.wishlistId} className="flex flex-col relative group">
                          {/* Reordering bar above Product Card */}
                          <div className="mb-2 flex items-center justify-between bg-white/50 backdrop-blur-xl px-4 py-2 rounded-xl border border-white/60 shadow-sm">
                            <span className="text-xs font-black text-[#0f172a] uppercase">Priority #{idx + 1}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleMove('product', idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 bg-white/80 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-lg transition-all border border-white/60"
                                title="Move Up Priority"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => handleMove('product', idx, 'down')}
                                disabled={idx === fullProducts.length - 1}
                                className="p-1 bg-white/80 hover:bg-white text-[#0f172a] disabled:opacity-30 rounded-lg transition-all border border-white/60"
                                title="Move Down Priority"
                              >
                                <ArrowDown size={14} />
                              </button>
                              <button
                                onClick={() => toggleProductWishlist(item.wishlistId)}
                                className="p-1 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all border border-red-500/20"
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
        </div>
      </main>
    </>
  );
}
