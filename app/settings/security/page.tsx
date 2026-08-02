'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/header';
import { useAuth } from '@/lib/contexts/auth-context';
import PinModal from '@/components/pin-modal';
import { motion } from 'framer-motion';
import { User, Lock, Key, ShieldCheck, Check, ShieldAlert, Heart } from 'lucide-react';
import Link from 'next/link';

import { resolveApiUrl, getAuthToken } from '@/lib/utils';

export default function SecuritySettingsPage() {
  const { user, isPinVerified, updateProfile, resetPinVerification } = useAuth();
  const [showPinModal, setShowPinModal] = useState(true);
  const [activeTab, setActiveTab] = useState<'password' | 'pin'>('password');

  // Profile & Password form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Security PIN state
  const [newPin, setNewPin] = useState('');

  const [formMsg, setFormMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Require PIN on every visit to /settings/security
  useEffect(() => {
    resetPinVerification();
  }, []);

  // Sync user profile values when context loads
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  // Keep PIN modal open until PIN is verified
  useEffect(() => {
    setShowPinModal(!isPinVerified);
  }, [isPinVerified]);

  // Save Password & Name Profile changes
  const handleSavePasswordProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setFormMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setIsUpdating(true);
    const token = getAuthToken();
    const targetUrl = resolveApiUrl('/api/auth/profile');

    try {
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data = await res.json();
      setIsUpdating(false);

      if (res.ok && data.success) {
        setFormMsg({ type: 'success', text: 'Profile & Password updated successfully!' });
        if (data.user) {
          updateProfile(data.user);
        }
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setFormMsg({ type: 'error', text: data.msg || 'Failed to update profile' });
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setIsUpdating(false);
      setFormMsg({ type: 'error', text: 'Server error updating profile' });
    }
  };

  // Save Security PIN changes
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    if (!newPin || newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setFormMsg({ type: 'error', text: 'Security PIN must be exactly 4 digits' });
      return;
    }

    setIsUpdating(true);
    const token = getAuthToken();
    const targetUrl = resolveApiUrl('/api/auth/profile');

    try {
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pin: newPin,
        }),
      });

      const data = await res.json();
      setIsUpdating(false);

      if (res.ok && data.success) {
        setFormMsg({ type: 'success', text: 'Security PIN updated successfully!' });
        if (data.user) {
          updateProfile(data.user);
        }
        setNewPin('');
      } else {
        setFormMsg({ type: 'error', text: data.msg || 'Failed to update Security PIN' });
      }
    } catch (err) {
      console.error('Error updating PIN:', err);
      setIsUpdating(false);
      setFormMsg({ type: 'error', text: 'Server error updating Security PIN' });
    }
  };

  return (
    <>
      <Header showSearch={false} />
      <main className="min-h-screen bg-[url(/bg.png)] bg-cover bg-center bg-no-repeat bg-fixed py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

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
              <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2">SECURITY SETTINGS ARE LOCKED</h2>
              <p className="text-gray-500 font-bold max-w-sm mb-6 uppercase text-xs">
                PLEASE ENTER YOUR 4-DIGIT SECURITY PIN TO UNLOCK SECURITY SETTINGS.
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
                <div>
                  <h1 className="text-3xl sm:text-4xl font-black text-[#0f172a] uppercase tracking-wide flex items-center gap-3">
                    <ShieldCheck size={36} /> SECURITY SETTINGS
                  </h1>
                  <p className="text-sm text-gray-500 font-bold tracking-wide mt-1 uppercase">
                    MANAGE YOUR ACCOUNT PASSWORD AND 4-DIGIT SECURITY PIN
                  </p>
                </div>

                <Link
                  href="/settings/wishlist"
                  className="inline-flex items-center gap-2 bg-white/60 hover:bg-white text-[#0f172a] px-6 py-3.5 rounded-full font-black text-xs uppercase tracking-wider border border-white/60 shadow-md transition-all self-start sm:self-auto"
                >
                  <Heart size={16} fill="#ef4444" className="text-red-500" /> GO TO MY WISHLIST
                </Link>
              </div>

              {/* Navigation Tabs (iPad OS Pill Buttons) */}
              <div className="flex flex-wrap items-center gap-3 mb-8 bg-white/30 backdrop-blur-xl p-2 rounded-full border border-white/60 shadow-[0_8px_32px_0_rgba(31,38,135,0.05)]">
                {[
                  { id: 'password', label: 'Password & Profile', icon: Lock },
                  { id: 'pin', label: 'Security PIN', icon: Key },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setFormMsg(null);
                        setActiveTab(tab.id as any);
                      }}
                      className={`flex items-center gap-2 px-7 py-3.5 rounded-full font-black text-xs sm:text-sm transition-all uppercase ${
                        isActive
                          ? 'bg-[#0f172a] text-white shadow-lg'
                          : 'text-gray-600 hover:bg-white/50 hover:text-[#0f172a]'
                      }`}
                    >
                      <Icon size={18} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Form Message Notification */}
              {formMsg && (
                <div className={`p-4 rounded-2xl mb-6 font-bold text-sm flex items-center gap-3 uppercase ${
                  formMsg.type === 'success' ? 'bg-green-500/10 text-green-700 border border-green-500/30' : 'bg-red-500/10 text-red-700 border border-red-500/30'
                }`}>
                  {formMsg.type === 'success' ? <Check size={20} /> : <ShieldAlert size={20} />}
                  {formMsg.text}
                </div>
              )}

              {/* Tab 1: Password & Profile Settings */}
              {activeTab === 'password' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
                    <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-6 flex items-center gap-3">
                      <User size={24} /> PROFILE & PASSWORD CONFIGURATION
                    </h2>

                    <form onSubmit={handleSavePasswordProfile} className="space-y-6">
                      {/* Name Input (Editable) */}
                      <div>
                        <label className="block text-xs font-black text-[#0f172a] uppercase tracking-wider mb-2">
                          FULL NAME
                        </label>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          required
                          className="w-full px-6 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] shadow-sm uppercase text-sm"
                          placeholder="ENTER YOUR NAME"
                        />
                      </div>

                      {/* Email Input (STRICTLY READ-ONLY) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-black text-[#0f172a] uppercase tracking-wider">
                            EMAIL ADDRESS
                          </label>
                          <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-3 py-1 rounded-full flex items-center gap-1">
                            <Lock size={10} /> READ-ONLY
                          </span>
                        </div>
                        <input
                          type="email"
                          value={email}
                          disabled
                          readOnly
                          className="w-full px-6 py-4 bg-gray-100/70 border border-gray-200 rounded-full font-semibold text-gray-500 cursor-not-allowed shadow-inner text-sm"
                          title="Email address cannot be updated"
                        />
                        <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase pl-2">
                          Note: Email address is locked to your account and cannot be modified.
                        </p>
                      </div>

                      <div className="border-t border-gray-200/60 pt-6">
                        <h3 className="text-lg font-black text-[#0f172a] uppercase mb-4 flex items-center gap-2">
                          <Lock size={18} /> CHANGE ACCOUNT PASSWORD
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                              CURRENT PASSWORD
                            </label>
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              className="w-full px-6 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-semibold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] text-sm"
                              placeholder="REQUIRED IF CHANGING PASSWORD"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                NEW PASSWORD
                              </label>
                              <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className="w-full px-6 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-semibold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] text-sm"
                                placeholder="NEW PASSWORD"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                                CONFIRM NEW PASSWORD
                              </label>
                              <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className="w-full px-6 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-semibold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] text-sm"
                                placeholder="CONFIRM NEW PASSWORD"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4">
                        <button
                          type="submit"
                          disabled={isUpdating}
                          className="w-full bg-[#0f172a] text-white py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all disabled:opacity-50"
                        >
                          {isUpdating ? 'SAVING CHANGES...' : 'SAVE PASSWORD & PROFILE'}
                        </button>
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}

              {/* Tab 2: Security PIN Settings */}
              {activeTab === 'pin' && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="bg-white/30 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-6 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
                    <h2 className="text-2xl font-black text-[#0f172a] uppercase mb-2 flex items-center gap-3">
                      <Key size={24} /> SECURITY PIN CONFIGURATION
                    </h2>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-6">
                      YOUR 4-DIGIT SECURITY PIN PROTECTS ACCESS TO ACCOUNT SETTINGS.
                    </p>

                    <form onSubmit={handleSavePin} className="space-y-6">
                      <div>
                        <label className="block text-xs font-black text-[#0f172a] uppercase tracking-wider mb-2">
                          NEW 4-DIGIT SECURITY PIN
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          value={newPin}
                          onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                          required
                          className="w-full px-6 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-black text-3xl tracking-[0.5em] text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] shadow-sm text-center"
                          placeholder="••••"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isUpdating || newPin.length !== 4}
                        className="w-full bg-[#0f172a] text-[#ffffff] py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] shadow-xl transition-all disabled:opacity-40"
                      >
                        {isUpdating ? 'UPDATING PIN...' : 'UPDATE SECURITY PIN'}
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
