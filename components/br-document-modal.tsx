'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image as ImageIcon, X, ExternalLink, Download, ShieldCheck, AlertCircle } from 'lucide-react';

interface BrDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  shopId: string;
  brNumber?: string;
  brDocument?: string;
  brDocumentType?: string;
}

export default function BrDocumentModal({
  isOpen,
  onClose,
  shopName,
  shopId,
  brNumber = '',
  brDocument = '',
  brDocumentType = '',
}: BrDocumentModalProps) {
  // Determine if document is a PDF
  const isPdf =
    brDocumentType === 'pdf' ||
    (typeof brDocument === 'string' &&
      (brDocument.startsWith('data:application/pdf') ||
        brDocument.toLowerCase().includes('.pdf') ||
        brDocument.toLowerCase().includes('/raw/')));

  const hasDocument = Boolean(brDocument && typeof brDocument === 'string' && brDocument.trim().length > 0);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md cursor-pointer"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-4xl bg-white/95 backdrop-blur-2xl rounded-[2rem] sm:rounded-[2.5rem] p-5 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.3)] border border-white/60 flex flex-col max-h-[92vh] overflow-hidden cursor-default"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl text-white shadow-sm shrink-0 ${
                  isPdf ? 'bg-rose-600' : 'bg-[#0f172a]'
                }`}
              >
                {isPdf ? <FileText size={22} /> : <ImageIcon size={22} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[0.65rem] font-black text-white bg-[#0f172a] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    {shopId}
                  </span>
                  {brNumber && (
                    <span className="text-[0.65rem] font-black text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      BR: {brNumber}
                    </span>
                  )}
                  <span
                    className={`text-[0.65rem] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isPdf
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                    }`}
                  >
                    {isPdf ? 'PDF DOCUMENT' : 'IMAGE CERTIFICATE'}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-black text-[#0f172a] uppercase leading-tight truncate">
                  {shopName}
                </h3>
              </div>
            </div>

            {/* Top Right Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              {hasDocument && brDocument.startsWith('http') && (
                <a
                  href={brDocument}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-full text-xs font-black uppercase transition-all border border-blue-200 shadow-2xs"
                >
                  <ExternalLink size={13} />
                  <span>OPEN IN NEW TAB</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-full transition-all cursor-pointer"
                title="Close Viewer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Document Viewer Area */}
          <div className="flex-1 overflow-auto bg-slate-950/5 rounded-2xl p-2 sm:p-4 flex items-center justify-center min-h-[350px] border border-gray-100">
            {!hasDocument ? (
              <div className="text-center py-12 px-4">
                <AlertCircle size={40} className="text-gray-400 mx-auto mb-2" />
                <h4 className="text-sm font-black text-[#0f172a] uppercase">NO BR DOCUMENT ATTACHED</h4>
                <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                  This shop does not have an uploaded BR certificate document yet.
                </p>
              </div>
            ) : isPdf ? (
              <iframe
                src={brDocument}
                title={`${shopName} BR Document Viewer`}
                className="w-full h-[68vh] rounded-xl border border-gray-200 bg-white shadow-inner"
              />
            ) : (
              <img
                src={brDocument}
                alt={`${shopName} BR Certificate Preview`}
                className="max-h-[68vh] max-w-full object-contain rounded-xl shadow-lg border border-white"
              />
            )}
          </div>

          {/* Footer Info */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100 text-xs font-bold text-gray-500 uppercase">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              BUSINESS REGISTRATION CERTIFICATE
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white font-black text-xs uppercase rounded-full shadow-md transition-all cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
