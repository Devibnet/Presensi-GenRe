'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, X, AlertCircle, CheckCircle2, Sparkles, SwitchCamera, Upload } from 'lucide-react';

interface CameraQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose?: () => void;
}

export function CameraQrScanner({ onScanSuccess, onClose }: CameraQrScannerProps) {
  const [scannerActive, setScannerActive] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<any>(null);
  const readerElementId = 'genre-qr-reader';

  useEffect(() => {
    let isMounted = true;

    async function initScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');

        // Dapatkan daftar kamera yang tersedia di perangkat
        const devices = await Html5Qrcode.getCameras();
        if (isMounted && devices && devices.length > 0) {
          setCameras(devices);
          // Prioritaskan kamera belakang (back/environment camera) untuk ponsel
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('belakang') ||
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else if (isMounted) {
          setErrorMessage('Tidak ada kamera video yang terdeteksi di perangkat Anda.');
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error saat inisialisasi kamera:', err);
          setErrorMessage(err.message || 'Izin akses kamera ditolak atau perangkat tidak mendukung.');
        }
      }
    }

    initScanner();

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, []);

  // Mulai memindai video stream
  useEffect(() => {
    if (selectedCameraId && !scannerActive && !isProcessing) {
      startScanner(selectedCameraId);
    }
  }, [selectedCameraId]);

  const startScanner = async (cameraId: string) => {
    try {
      setErrorMessage(null);
      const { Html5Qrcode } = await import('html5-qrcode');

      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        cameraId,
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Callback saat QR berhasil terdeteksi
          handleSuccessScan(decodedText);
        },
        (error) => {
          // Frame scanner sedang membaca... (bisa diabaikan per frame)
        }
      );

      setScannerActive(true);
    } catch (err: any) {
      console.error('Gagal menjalankan scanner:', err);
      setErrorMessage(err.message || 'Gagal memulai video kamera. Pastikan izin kamera telah diizinkan di browser.');
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (e) {
      console.warn('Scanner stop cleanup notice:', e);
    } finally {
      scannerRef.current = null;
      setScannerActive(false);
    }
  };

  const handleSuccessScan = async (text: string) => {
    if (isProcessing) return;
    setIsProcessing(true);

    // Mainkan feedback suara klik halus jika browser mendukung
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880; // A5
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => {
        osc.stop();
        audioCtx.close();
      }, 100);
    } catch (e) {
      // Audio optional
    }

    // Stop scanner video
    await stopScanner();

    // Kirim data ke parent
    onScanSuccess(text);
  };

  // Switch kamera (Depan / Belakang)
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex(c => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  };

  // Fallback: Scan dari berkas gambar
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const { Html5Qrcode } = await import('html5-qrcode');
      const html5QrCode = new Html5Qrcode(readerElementId);
      const result = await html5QrCode.scanFile(file, true);
      handleSuccessScan(result);
    } catch (err: any) {
      alert('Tidak menemukan QR Code yang valid pada berkas gambar ini.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative bg-white border border-slate-200 rounded-2xl p-4 shadow-xl overflow-hidden max-w-md mx-auto text-slate-900">
      {/* Top Controls */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pindai QR Presensi</h3>
            <span className="text-[11px] text-slate-500">Arahkan kamera ke QR Code kegiatan</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {cameras.length > 1 && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              title="Ganti Kamera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={async () => {
                await stopScanner();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
              title="Tutup Kamera"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Viewport Scanner Element */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-900 aspect-square flex items-center justify-center">
        {/* HTML5 QR Code Container Element */}
        <div id={readerElementId} className="w-full h-full" />

        {/* Viewfinder Target Frame Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-48 h-48 border-2 border-teal-400/80 rounded-2xl relative shadow-[0_0_20px_rgba(20,184,166,0.3)]">
            {/* Corner Markers */}
            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-teal-400 rounded-tl-sm" />
            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-teal-400 rounded-tr-sm" />
            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-teal-400 rounded-bl-sm" />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-teal-400 rounded-br-sm" />

            {/* Scanning Laser Line */}
            <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* State: Processing */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-2" />
            <span className="text-xs font-semibold text-white">Memvalidasi Presensi...</span>
          </div>
        )}
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Kendala Kamera:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Bottom Option: Upload QR Image */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 text-[11px]">Kamera bermasalah?</span>
        <label className="cursor-pointer text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1.5 transition-colors">
          <Upload className="w-3.5 h-3.5" />
          <span>Unggah Berkas QR Code</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
