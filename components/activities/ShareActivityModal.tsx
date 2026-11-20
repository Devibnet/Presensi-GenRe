'use client';

import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageSquare,
  Sparkles,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Activity } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';

interface ShareActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: Activity | null;
  isJustCreated?: boolean;
}

export function ShareActivityModal({
  isOpen,
  onClose,
  activity,
  isJustCreated = false,
}: ShareActivityModalProps) {
  const { toast } = useToast();
  const [dresscode, setDresscode] = useState('Bebas rapi');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Format Helper ke teks Broadcast WhatsApp resmi GenRe Buleleng
  const buildDefaultTemplate = (act: Activity, currentDresscode: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://absensi-genre.vercel.app';
    const presensiUrl = `${origin}/dashboard/activities/${act.id}`;

    const startDate = new Date(act.start_at || act.check_in_opens_at || Date.now());
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Makassar',
    }).format(startDate);

    const startTimeStr = new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Makassar',
    }).format(startDate).replace(':', '.');

    let endTimeStr = 'Selesai';
    if (act.end_at) {
      const endDate = new Date(act.end_at);
      const timeStr = new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Makassar',
      }).format(endDate).replace(':', '.');
      endTimeStr = `${timeStr} Wita`;
    }

    // Format Deskripsi Kegiatan
    const desc = act.activity_description?.trim();
    const descriptionSection = desc
      ? `Deskripsi Kegiatan:\n${desc}`
      : `Deskripsi Kegiatan:\n-`;

    const activityNameUpper = (act.activity_name || 'KEGIATAN').toUpperCase();

    return `📢 *INFORMASI ${activityNameUpper} AKSARA GENRE BULELENG TAHUN 2027* 📢

Om Swastyastu,
Diinformasikan kepada seluruh panitia AKSARA GenRe Buleleng Tahun 2027, bahwa akan dilaksanakan ${act.activity_name} pada:

 📅: ${dateFormatted}
 ⏰: ${startTimeStr} Wita - ${endTimeStr}
 👔: ${currentDresscode || 'Bebas rapi'}
 📍: ${act.activity_location || 'Lokasi Kegiatan'}
 🔗: Tautan Presensi: ${presensiUrl}

${descriptionSection}

Demikian informasi yang dapat kami sampaikan. Harap seluruh panitia memperhatikan agenda dan menghadirinya. Terima kasih 🙏

NB:
 📌 Hadir tepat waktu.
 📌 Tinggalkan reaction sebagai tanda telah membaca pesan ini.
📌 Apabila berhalangan hadir harap konfirmasi di grup umum.

#AKSARAGENREBULELENG2027
#GenReBuleleng
#AbhinavaYuvaka`;
  };

  useEffect(() => {
    if (activity) {
      setMessage(buildDefaultTemplate(activity, dresscode));
    }
  }, [activity]);

  const handleDresscodeChange = (newVal: string) => {
    setDresscode(newVal);
    if (activity) {
      setMessage(buildDefaultTemplate(activity, newVal));
    }
  };

  const handleResetTemplate = () => {
    if (activity) {
      setMessage(buildDefaultTemplate(activity, dresscode));
      toast.info('Template Direset', 'Format pesan dikembalikan ke standar awal.');
    }
  };

  const handleCopy = () => {
    if (!message) return;
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('Pesan Disalin!', 'Format broadcast pengumuman siap ditempel (paste) ke grup WhatsApp.');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!message) return;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!activity) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bagikan Informasi Agenda Kegiatan"
      description="Siarkan pengumuman kegiatan resmi beserta tautan presensi ke grup WhatsApp panitia."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs">
        {/* Banner Sukses jika baru saja dibuat */}
        {isJustCreated && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-900 animate-fade-in shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-xs block text-emerald-950">
                Agenda Berhasil Dibuat!
              </span>
              <p className="text-[11px] text-emerald-800">
                Kegiatan sudah aktif di sistem. Anda dapat langsung membagikan format pesan di bawah ke grup WhatsApp panitia.
              </p>
            </div>
          </div>
        )}

        {/* Input Opsi Cepat: Dresscode */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-800 block text-xs">Pakaian / Dresscode:</span>
            <span className="text-[11px] text-slate-500">Pilih atau ketik pakaian yang diwajibkan untuk kegiatan ini</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {['Bebas rapi', 'PDH GenRe', 'Baju Adat Madya', 'Baju Kaos Panitia'].map((dc) => (
              <button
                key={dc}
                type="button"
                onClick={() => handleDresscodeChange(dc)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  dresscode === dc
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {dc}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea Preview & Editing */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Pratinjau Pesan WhatsApp (Dapat Diedit):</span>
            </label>
            <button
              type="button"
              onClick={handleResetTemplate}
              className="text-[11px] text-slate-500 hover:text-teal-700 flex items-center gap-1 font-semibold transition-colors cursor-pointer"
              title="Reset ke format bawaan"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Template</span>
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={12}
            className="w-full p-3.5 rounded-2xl bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 selection:bg-emerald-500 selection:text-slate-950 resize-y"
            placeholder="Ketik atau edit format pesan..."
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer text-xs"
          >
            Tutup
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-all shadow-xs active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 text-xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Salin Teks Pesan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-2 text-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Kirim ke WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
