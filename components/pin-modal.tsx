'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, X, Delete, ArrowRight, KeyRound, Check } from 'lucide-react';
import { useAuth } from '@/lib/contexts/auth-context';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PinModal({
  isOpen,
  onClose,
  onSuccess,
}: PinModalProps) {
  const { verifyPin } = useAuth();
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<'pin' | 'password'>('pin');

  // Password reset fields
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keyboard input listener for physical keyboard entry
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow default handling if typing inside password or text input fields
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (mode === 'pin' && !isSubmitting) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          handleDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (e.key === 'Delete') {
          e.preventDefault();
          handleClear();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (pin.length === 4) {
            submitPin(pin);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, pin, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMsg('');

      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg('');
  };

  const submitPin = async (submittedPin: string) => {
    setIsSubmitting(true);
    setErrorMsg('');

    const res = await verifyPin({ pin: submittedPin });
    setIsSubmitting(false);

    if (res.success) {
      setPin('');
      onSuccess();
    } else {
      if (res.requirePassword || res.hasPinSet === false) {
        setErrorMsg('No Security PIN created yet. Verify with password to set a PIN.');
        setMode('password');
      } else {
        setErrorMsg(res.msg || 'Incorrect Security PIN');
        setPin('');
      }
    }
  };

  const submitPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg('Account password is required');
      return;
    }
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      setErrorMsg('New Security PIN must be 4 digits');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const res = await verifyPin({ password, newPin });
    setIsSubmitting(false);

    if (res.success) {
      setPassword('');
      setNewPin('');
      setMode('pin');
      onSuccess();
    } else {
      setErrorMsg(res.msg || 'Incorrect account password');
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md max-h-[90vh] bg-white/95 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white/90 shadow-[0_25px_70px_rgba(0,0,0,0.25)] overflow-y-auto custom-scrollbar cursor-default"
        >
          {/* Close Button - iPad Style Pill */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2.5 text-gray-500 hover:text-[#0f172a] hover:bg-slate-100 rounded-full transition-all shadow-sm border border-slate-200/60 cursor-pointer"
          >
            <X size={18} />
          </button>

          {/* Icon & Title Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#0f172a] text-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl shadow-slate-900/20 border border-white/20">
              {mode === 'pin' ? <ShieldCheck size={32} /> : <KeyRound size={32} />}
            </div>
            <h2 className="text-2xl font-black text-[#0f172a] uppercase tracking-wide">
              {mode === 'pin' ? 'SECURITY PIN REQUIRED' : 'VERIFY WITH PASSWORD'}
            </h2>
            <p className="text-xs text-gray-500 font-extrabold tracking-wider uppercase mt-1">
              {mode === 'pin'
                ? 'ENTER YOUR 4-DIGIT PIN TO ACCESS SETTINGS'
                : 'ENTER YOUR ACCOUNT PASSWORD TO CREATE / RESET PIN'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-xs font-black text-red-500 mb-4 uppercase">
              {errorMsg}
            </motion.p>
          )}

          {/* Mode 1: PIN Keypad */}
          {mode === 'pin' ? (
            <>
              {/* PIN Digit Indicators (iPad Circular Design) */}
              <div className="flex justify-center items-center gap-4 mb-6">
                {[0, 1, 2, 3].map(index => {
                  const isFilled = index < pin.length;
                  return (
                    <motion.div
                      key={index}
                      animate={{ scale: isFilled ? 1.15 : 1 }}
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all shadow-xs ${errorMsg
                        ? 'border-red-500 bg-red-50 text-red-500'
                        : isFilled
                          ? 'border-[#0f172a] bg-[#0f172a] text-white shadow-md'
                          : 'border-slate-300 bg-white/80 text-transparent'
                        }`}
                    >
                      {isFilled ? <Lock size={16} /> : null}
                    </motion.div>
                  );
                })}
              </div>

              {/* iPad-Style Circular Numeric Keypad */}
              <div className="grid grid-cols-3 gap-4 max-w-[260px] mx-auto mb-6">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    onClick={() => handleDigit(num)}
                    disabled={isSubmitting}
                    className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 text-[#0f172a] font-black text-2xl border border-slate-200/90 shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center mx-auto cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  onClick={handleClear}
                  disabled={isSubmitting || pin.length === 0}
                  className="w-16 h-16 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0f172a] font-extrabold text-xs uppercase border border-slate-200/80 disabled:opacity-30 transition-all flex items-center justify-center mx-auto shadow-xs cursor-pointer"
                >
                  CLEAR
                </button>
                <button
                  onClick={() => handleDigit('0')}
                  disabled={isSubmitting}
                  className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 text-[#0f172a] font-black text-2xl border border-slate-200/90 shadow-md active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center mx-auto cursor-pointer"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  disabled={isSubmitting || pin.length === 0}
                  className="w-16 h-16 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0f172a] flex items-center justify-center border border-slate-200/80 disabled:opacity-30 transition-all mx-auto shadow-xs cursor-pointer"
                >
                  <Delete size={20} />
                </button>
              </div>

              {/* Submit Button (iPad Pill Button) */}
              <button
                onClick={() => submitPin(pin)}
                disabled={pin.length < 4 || isSubmitting}
                className="w-full bg-[#0f172a] text-white py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] disabled:opacity-40 transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 mb-3 cursor-pointer"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    VERIFY PIN & PROCEED <ArrowRight size={18} />
                  </>
                )}
              </button>

              {/* Forgot PIN / Reset Link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('password');
                  }}
                  className="text-xs font-black text-gray-600 hover:text-[#0f172a] uppercase tracking-wider transition-colors"
                >
                  FORGOT PIN? VERIFY WITH PASSWORD
                </button>
              </div>
            </>
          ) : (
            /* Mode 2: Verify with Password & Set New PIN */
            <form onSubmit={submitPasswordReset} className="space-y-5">
              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase tracking-wider mb-2">
                  ACCOUNT PASSWORD
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="ENTER ACCOUNT PASSWORD"
                  className="w-full px-5 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-bold text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] shadow-sm uppercase text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#0f172a] uppercase tracking-wider mb-2">
                  SET NEW 4-DIGIT SECURITY PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="••••"
                  className="w-full px-5 py-4 bg-white/60 backdrop-blur-xl border border-white/60 rounded-full font-black text-2xl tracking-[0.5em] text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0f172a] shadow-sm text-center"
                />
              </div>

              <button
                type="submit"
                disabled={!password || newPin.length !== 4 || isSubmitting}
                className="w-full bg-[#0f172a] text-white py-4 rounded-full font-black text-sm uppercase tracking-wider hover:bg-[#1e293b] disabled:opacity-40 transition-all shadow-xl flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    RESET PIN & UNLOCK <Check size={18} />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('pin');
                  }}
                  className="text-xs font-black text-gray-600 hover:text-[#0f172a] uppercase tracking-wider transition-colors"
                >
                  BACK TO PIN KEYPAD
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
