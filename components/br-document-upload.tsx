'use client';

import React, { useState, useRef, ChangeEvent, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Image as ImageIcon, Eye, Trash2, ExternalLink, Camera, X, CheckCircle2 } from 'lucide-react';
import Swal from 'sweetalert2';

interface BrDocumentUploadProps {
  value?: string;
  documentType?: 'image' | 'pdf' | string;
  onChange: (base64OrUrl: string, type: 'image' | 'pdf' | '') => void;
  label?: string;
  disabled?: boolean;
}

export default function BrDocumentUpload({
  value = '',
  documentType = '',
  onChange,
  label = 'BR DOCUMENT (CERTIFICATE)',
  disabled = false,
}: BrDocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Helper to determine whether the document is a PDF
  const isPdf =
    documentType === 'pdf' ||
    (typeof value === 'string' &&
      (value.startsWith('data:application/pdf') ||
        value.toLowerCase().includes('.pdf') ||
        value.toLowerCase().includes('/raw/')));

  const hasDocument = Boolean(value && typeof value === 'string' && value.trim().length > 0);

  const handleFile = (file: File) => {
    if (!file) return;

    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'File Too Large',
        text: `BR Document must be smaller than ${maxSizeMb}MB. Please choose a smaller file.`,
      });
      return;
    }

    const isFilePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isFileImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);

    if (!isFilePdf && !isFileImage) {
      Swal.fire({
        icon: 'error',
        title: 'Unsupported Format',
        text: 'Please upload a PDF document (.pdf) or an Image file (PNG, JPG, WEBP).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = (event.target?.result as string) || '';
      const type = isFilePdf ? 'pdf' : 'image';
      onChange(base64, type);
    };
    reader.onerror = () => {
      Swal.fire({
        icon: 'error',
        title: 'Read Error',
        text: 'Failed to read the selected file. Please try again.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', '');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Live WebCam capture controls
  const openCamera = async () => {
    if (disabled) return;
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
      console.warn('Camera access failed, falling back to camera input:', err);
      setShowCameraModal(false);
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        Swal.fire({
          icon: 'info',
          title: 'Camera Unavailable',
          text: 'Camera streaming unavailable. Please choose an image file from your device.',
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
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      onChange(dataUrl, 'image');
    }
    closeCamera();
  };

  return (
    <div className="space-y-2">
      {/* Hidden file pickers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf,.pdf"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
        disabled={disabled}
      />

      <div className="flex items-center justify-between">
        <label className="text-xs font-black text-[#0f172a] uppercase flex items-center gap-1.5">
          <FileText size={14} className="text-indigo-600" />
          <span>{label}</span>
          <span className="text-[0.65rem] font-bold text-gray-400 normal-case">(PDF or Image • Max 10MB)</span>
        </label>
      </div>

      {!hasDocument ? (
        /* Empty Upload State */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-4 sm:p-5 text-center transition-all ${
            isDragging
              ? 'border-[#0f172a] bg-[#0f172a]/5'
              : 'border-gray-300 hover:border-[#0f172a] bg-gray-50/50 hover:bg-gray-50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-xs">
              <Upload size={20} />
            </div>

            <div>
              <p className="text-xs font-black text-[#0f172a] uppercase">
                DRAG & DROP OR CHOOSE BR CERTIFICATE
              </p>
              <p className="text-[0.65rem] font-bold text-gray-500 uppercase mt-0.5">
                SUPPORTS PDF DOCUMENTS AND IMAGES (PNG, JPG, WEBP)
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => !disabled && fileInputRef.current?.click()}
                disabled={disabled}
                className="px-3.5 py-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-[0.65rem] font-black uppercase rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload size={13} /> UPLOAD FILE
              </button>

              <button
                type="button"
                onClick={openCamera}
                disabled={disabled}
                className="px-3.5 py-2 bg-white hover:bg-gray-100 text-[#0f172a] text-[0.65rem] font-black uppercase rounded-full border border-gray-200 shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Camera size={13} /> TAKE PHOTO
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Document Attached / Card State */
        <div className="flex items-center justify-between gap-3 p-3 bg-white/70 border border-gray-200 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            {isPdf ? (
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex flex-col items-center justify-center shrink-0">
                <FileText size={20} />
                <span className="text-[0.55rem] font-black uppercase tracking-tighter">PDF</span>
              </div>
            ) : (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                <img
                  src={value}
                  alt="BR Certificate thumbnail"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#0f172a] uppercase truncate">
                  BR CERTIFICATE {isPdf ? '(PDF)' : '(IMAGE)'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[0.6rem] font-black uppercase tracking-wider ${
                    isPdf
                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                      : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                  }`}
                >
                  {isPdf ? 'PDF' : 'IMAGE'}
                </span>
              </div>
              <p className="text-[0.65rem] font-bold text-gray-500 uppercase mt-0.5 truncate flex items-center gap-1">
                <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                {value.startsWith('data:') ? 'DOCUMENT READY TO SAVE' : 'STORED SECURELY ON CLOUD'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="px-3 py-1.5 bg-white hover:bg-gray-100 text-[#0f172a] border border-gray-200 rounded-full text-[0.65rem] font-black uppercase flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
              title="Preview Document"
            >
              <Eye size={13} />
              <span className="hidden sm:inline">VIEW</span>
            </button>

            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#0f172a] rounded-full text-[0.65rem] font-black uppercase transition-all cursor-pointer"
                  title="Replace Document"
                >
                  CHANGE
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="p-1.5 text-rose-600 hover:text-white hover:bg-rose-600 rounded-full transition-all cursor-pointer"
                  title="Remove Document"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Built-in Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md cursor-pointer"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl bg-white rounded-3xl p-5 shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden cursor-default"
            >
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl text-white ${isPdf ? 'bg-rose-600' : 'bg-indigo-600'}`}>
                    {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-[#0f172a] uppercase">
                      BR CERTIFICATE {isPdf ? '(PDF DOCUMENT)' : '(IMAGE)'}
                    </h4>
                    <p className="text-[0.65rem] text-gray-500 font-bold uppercase">
                      BUSINESS REGISTRATION CERTIFICATE PREVIEW
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {value.startsWith('http') && (
                    <a
                      href={value}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[0.65rem] font-black uppercase text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 transition-all"
                    >
                      <ExternalLink size={12} /> OPEN IN NEW TAB
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-1.5 text-gray-400 hover:text-black rounded-full transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-gray-900/5 rounded-2xl p-2 flex items-center justify-center min-h-[300px]">
                {isPdf ? (
                  <iframe
                    src={value}
                    title="BR Certificate PDF Document Viewer"
                    className="w-full h-[65vh] rounded-xl border border-gray-200 bg-white shadow-inner"
                  />
                ) : (
                  <img
                    src={value}
                    alt="BR Certificate Full Preview"
                    className="max-h-[65vh] max-w-full object-contain rounded-xl shadow-md"
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Live Camera Viewfinder Modal */}
      {showCameraModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md cursor-pointer"
          onClick={closeCamera}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl border border-gray-800 text-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100">
              <span className="text-xs font-black text-[#0f172a] uppercase flex items-center gap-2">
                <Camera size={16} /> CAPTURE BR CERTIFICATE
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
                <Camera size={16} /> SNAP CERTIFICATE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
