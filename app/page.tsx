'use client';

import { useAuth } from '@/lib/contexts/auth-context';
import LoginForm from '@/components/login-form';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  ShieldCheck,
  Layers,
  Gem,
  Building2,
  Warehouse,
  MapPin,
  Phone,
  Mail,
  Globe,
} from 'lucide-react';
import Header from '@/components/header';

/* ───────── category grid data ───────── */
const CATEGORIES = [
  {
    name: 'Handbags',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop',
  },
  {
    name: 'Purses',
    image: 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=400&h=400&fit=crop',
  },
  {
    name: 'Belts',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
  },
  {
    name: 'Wallets',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=400&fit=crop',
  },
  {
    name: 'Backpacks',
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
  },
  {
    name: 'Stationery',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop',
  },
  {
    name: 'Office Supplies',
    image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=400&fit=crop',
  },
  {
    name: 'School Supplies',
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=400&fit=crop',
  },
];

/* ───────── featured products ───────── */
const FEATURED_PRODUCTS = [
  {
    name: 'Aurora Leather Handbag',
    code: 'Aurora-LB',
    colors: 'Navy Blue',
    size: 'Size M',
    material: 'Genuine Leather',
    packaging: 'Metal',
    image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=600&fit=crop',
  },
  {
    name: 'Apollo Travel Wallet',
    code: 'Apollo-TW',
    colors: 'Black',
    size: 'Compact',
    material: 'Calfskin',
    packaging: 'Metal',
    image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&h=600&fit=crop',
  },
  {
    name: 'Zodiac Executive Pen Set',
    code: 'Zodiac-PS',
    colors: 'Silver/Navy',
    size: 'Standard',
    material: 'Metal',
    packaging: 'Metal',
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&h=600&fit=crop',
  },
];

/* ───────── USP items ───────── */
const USP_ITEMS = [
  { icon: ShieldCheck, label: 'Premium\nQuality' },
  { icon: Layers, label: 'Wide Product\nRange' },
  { icon: Gem, label: 'Durable\nMaterials' },
  { icon: Building2, label: 'Corporate\nSolutions' },
  { icon: Warehouse, label: 'Wholesale\nSupply' },
];

/* ───────── animation helpers ───────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ═══════════════════════════════════════ */
/*              PAGE COMPONENT            */
/* ═══════════════════════════════════════ */
export default function Page() {
  const { isLoggedIn } = useAuth();

  /* ── Login gate ── */
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center min-h-screen px-4"
        >
          <div className="w-full max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h1 className="text-5xl font-bold text-foreground mb-4">Welcome to Matrices</h1>
              <p className="text-xl text-muted-foreground">
                Discover our exclusive collection of premium tech products
              </p>
            </motion.div>
            <LoginForm />
          </div>
        </motion.div>
      </main>
    );
  }

  /* ═══════════════════════════════════════ */
  /*             LOGGED-IN HOME             */
  /* ═══════════════════════════════════════ */
  return (
    <>
      <Header showSearch={false} />

      <main className="bg-[#e8ecf2] min-h-screen overflow-x-hidden">
        {/* ────────────────────── HERO BANNER ────────────────────── */}
        <section className="relative w-full overflow-hidden bg-gradient-to-br from-[#1e3a6e] via-[#1b3260] to-[#142647]">
          {/* Decorative angled overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute -right-20 -top-20 w-[60%] h-[140%] bg-white/5 rotate-12 rounded-3xl"
            />
            <div
              className="absolute -left-40 -bottom-40 w-[50%] h-[100%] bg-white/[0.03] -rotate-12 rounded-3xl"
            />
          </div>

          <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-24 flex flex-col md:flex-row items-center gap-10 relative z-10">
            {/* Left content */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="flex-1 text-white space-y-6"
            >
              <div className="relative w-[220px] sm:w-[280px] h-[60px] sm:h-[75px] mb-2">
                <Image
                  src="/matrices_logo.png"
                  alt="Matrices"
                  fill
                  className="object-contain brightness-0 invert drop-shadow-lg"
                  priority
                />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
                Matrices Product Catalogue
              </h1>
              <p className="text-lg sm:text-xl text-white/80 max-w-md">
                Premium Bags, Accessories &amp; Stationery Collection
              </p>
              <Link href="/gallery">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(255,255,255,0.2)' }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4 group inline-flex items-center gap-3 px-8 py-4 bg-white text-[#1e3a6e] font-bold text-base rounded-full shadow-xl hover:bg-white/90 transition-all"
                >
                  Browse Catalogue
                  <ChevronRight className="transition-transform group-hover:translate-x-1" size={20} />
                </motion.button>
              </Link>
            </motion.div>

            {/* Right – hero image grid */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex-1 grid grid-cols-2 gap-3 max-w-md"
            >
              {[
                'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop',
                'https://images.unsplash.com/photo-1627123424574-724758594e93?w=400&h=400&fit=crop',
                'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop',
                'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop',
              ].map((src, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className="aspect-square rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                >
                  <img
                    src={src}
                    alt=""
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ────────────────────── PRODUCT CATEGORIES ────────────────────── */}
        <section id="categories" className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-3xl font-extrabold text-[#1e3a6e] text-center mb-12"
          >
            Product Categories
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5"
          >
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.name}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -6, boxShadow: '0 12px 32px rgba(30,58,138,0.12)' }}
                className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3 shadow-md cursor-pointer transition-all border border-transparent hover:border-[#1e3a8a]/20"
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-[#f0f4fa]">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-400"
                  />
                </div>
                <span className="text-sm font-bold text-[#334155] text-center">{cat.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ────────────────────── NEW ARRIVALS / FEATURED ────────────────────── */}
        <section
          id="new-arrivals"
          className="bg-gradient-to-br from-[#1e3a6e] via-[#1b3260] to-[#142647] py-16 md:py-20"
        >
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-2xl sm:text-3xl font-extrabold text-white text-center mb-12"
            >
              New Arrivals / Featured Collection
            </motion.h2>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {FEATURED_PRODUCTS.map((product, i) => (
                <motion.div
                  key={product.code}
                  variants={fadeUp}
                  custom={i}
                  whileHover={{ y: -8, boxShadow: '0 20px 48px rgba(0,0,0,0.25)' }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden flex flex-col transition-all"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] overflow-hidden bg-white/5">
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {/* Details */}
                  <div className="p-5 space-y-3 flex-1">
                    <h3 className="text-lg font-bold text-white">{product.name}</h3>
                    <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                      {[
                        ['Code:', product.code],
                        ['Colors:', product.colors],
                        ['Size:', product.size],
                        ['Material:', product.material],
                        ['Packaging:', product.packaging],
                      ].map(([label, val]) => (
                        <div key={label} className="contents">
                          <span className="text-white/60 font-medium">{label}</span>
                          <span className="text-white/90">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ────────────────────── WHY CHOOSE MATRICES ────────────────────── */}
        <section className="max-w-7xl mx-auto px-6 lg:px-8 py-16 md:py-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl sm:text-3xl font-extrabold text-[#1e3a6e] text-center mb-12"
          >
            Why Choose Matrices
          </motion.h2>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6"
          >
            {USP_ITEMS.map((usp, i) => (
              <motion.div
                key={usp.label}
                variants={fadeUp}
                custom={i}
                whileHover={{ y: -6, boxShadow: '0 12px 32px rgba(30,58,138,0.12)' }}
                className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-md text-center transition-all border border-transparent hover:border-[#1e3a8a]/20"
              >
                <div className="w-14 h-14 rounded-full bg-[#1e3a8a]/10 flex items-center justify-center">
                  <usp.icon className="w-7 h-7 text-[#1e3a8a]" />
                </div>
                <span className="text-sm font-bold text-[#334155] whitespace-pre-line leading-snug">
                  {usp.label}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ────────────────────── ABOUT MATRICES ────────────────────── */}
        <section id="about" className="bg-gradient-to-br from-[#1e3a6e] via-[#1b3260] to-[#142647] py-16 md:py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row items-center gap-10"
            >
              {/* Image */}
              <div className="flex-1 max-w-md">
                <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                  <img
                    src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&h=500&fit=crop"
                    alt="About Matrices"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 text-white space-y-5">
                <h2 className="text-2xl sm:text-3xl font-extrabold">About Matrices</h2>
                <p className="text-white/80 leading-relaxed">
                  We have dedicated ourselves to providing the finest premium bags, accessories, and
                  stationery products. Our commitment to quality craftsmanship and innovative design
                  sets us apart in the industry.
                </p>
                <p className="text-white/80 leading-relaxed">
                  We continue to evolve to deliver outstanding products that combine elegance with
                  functionality. Our focus on excellent quality and client service has made us a
                  trusted partner for individuals and corporations alike.
                </p>
                <Link href="/gallery">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="mt-4 inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1e3a6e] font-bold rounded-full shadow-lg hover:bg-white/90 transition-all text-sm"
                  >
                    Explore Products
                    <ChevronRight size={18} />
                  </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ────────────────────── CONTACT FOOTER ────────────────────── */}
        <section id="contact" className="bg-[#0f1f3d] py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="flex flex-col md:flex-row items-start justify-between gap-10"
            >
              {/* Address column */}
              <div className="space-y-4 text-white/80 text-sm">
                <h3 className="text-lg font-bold text-white mb-3">Contact Address</h3>
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-white/60 mt-0.5 flex-shrink-0" />
                  <span>314 North Address, Babson, 9630</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-white/60 flex-shrink-0" />
                  <span>+1 (010) 335 6280</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-white/60 flex-shrink-0" />
                  <span>email@matrices.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <Globe size={18} className="text-white/60 flex-shrink-0" />
                  <span>www.matrices.com</span>
                </div>
              </div>

              {/* Logo + tagline */}
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative w-[180px] h-[50px]">
                  <Image
                    src="/matrices_logo.png"
                    alt="Matrices"
                    fill
                    className="object-contain brightness-0 invert opacity-60"
                  />
                </div>
                <p className="text-white/50 text-xs max-w-xs">
                  Premium Bags, Accessories &amp; Stationery — Quality You Can Trust
                </p>
              </div>

              {/* Quick links */}
              <div className="space-y-3 text-sm">
                <h3 className="text-lg font-bold text-white mb-3">Quick Links</h3>
                {[
                  { href: '/gallery', label: 'Catalogue' },
                  { href: '/#categories', label: 'Categories' },
                  { href: '/#new-arrivals', label: 'New Arrivals' },
                  { href: '/#about', label: 'About Us' },
                  { href: '/view', label: 'Product View' },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block text-white/70 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Bottom bar */}
            <div className="mt-10 pt-6 border-t border-white/10 text-center text-white/40 text-xs">
              © {new Date().getFullYear()} Matrices. All rights reserved.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
