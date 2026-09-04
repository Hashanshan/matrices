'use client';

import React, { useState } from 'react';
import { NativeAdapter } from '../../mobile/bridge/native-adapter';
import { Camera, MapPin, HardDrive, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PermissionModal({ isOpen, onClose }: PermissionModalProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGrantPermissions = async () => {
    setLoading(true);
    setStatus('Requesting permissions...');
    try {
      const res = await NativeAdapter.requestAllPermissions();
      setStatus('Permissions configured successfully!');
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setStatus(`Error: ${err.message || 'Permission request failed'}`);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-card text-card-foreground border border-border/60 rounded-[2.5rem] p-6 max-w-md w-full shadow-2xl relative overflow-hidden cursor-default"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 rounded-full text-accent">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-base">App Device Permissions</h3>
                <p className="text-xs text-muted-foreground">Required for APK mobile capabilities</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-secondary rounded-full text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Permissions explanation items */}
          <div className="space-y-4 mb-6">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/30">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl mt-0.5">
                <HardDrive size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Storage Access</h4>
                <p className="text-[11px] text-muted-foreground">
                  Stores downloaded catalogue datasets, images, and shop check-in logs on your device for offline access.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/30">
              <div className="p-2 bg-purple-500/10 text-purple-500 rounded-xl mt-0.5">
                <Camera size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Camera Access</h4>
                <p className="text-[11px] text-muted-foreground">
                  Enables shop check-in photo capture and product barcode scanning directly in the app.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/30">
              <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl mt-0.5">
                <MapPin size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Location Access</h4>
                <p className="text-[11px] text-muted-foreground">
                  Verifies salesrep GPS coordinates and auto-fills shop visit location URLs during check-in.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/50 border border-border/30">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl mt-0.5">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h4 className="font-bold text-xs">Background Data & Screen WakeLock</h4>
                <p className="text-[11px] text-muted-foreground">
                  Keeps the device awake during catalogue sync and allows background sync to resume seamlessly when unlocked.
                </p>
              </div>
            </div>
          </div>

          {status && (
            <p className="text-xs font-bold text-center text-accent mb-4 animate-pulse">{status}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-full font-bold text-xs border border-border hover:bg-secondary transition-colors"
            >
              Skip for Now
            </button>
            <button
              onClick={handleGrantPermissions}
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-full font-bold text-xs bg-accent text-white shadow-lg hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              {loading ? 'Requesting...' : 'Grant Permissions'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
