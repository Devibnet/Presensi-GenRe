# Dokumentasi Teknis Database GenRe Attendance — Supabase PostgreSQL

Dokumentasi ini merangkum seluruh skema, kamus data, kebijakan keamanan (RLS), fungsi penilaian terkomputasi, indeks, dan 25 query operasional untuk website kepanitiaan **Pemilihan Duta GenRe Kabupaten Buleleng**.

---

## 1. Identitas Proyek & Arsitektur

- **Nama Aplikasi**: GenRe Attendance
- **Organisasi**: Forum GenRe Kabupaten Buleleng / Panitia Pemilihan Duta GenRe Kabupaten Buleleng
- **Basis Data**: PostgreSQL 15+ (Supabase Managed Engine)
- **Zona Waktu Standar**: `Asia/Makassar` (WITA, UTC+8)
- **Teknologi**: Next.js App Router, TypeScript, Supabase Auth & Storage, Supabase Row Level Security (RLS)
- **Skala Target**: ~70 panitia, 6 bidang kepanitiaan (BPH, Acara, Humas, Logistik, Konsumsi, Kesekretariatan)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js App Router                         │
│             (Client Component / Server Actions)                 │
└────────────────┬───────────────────────────────┬────────────────┘
                 │ Supabase Client (Anon Key)    │ Server (Service Role)
                 ▼                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                Supabase PostgreSQL Database Engine              │
│  ┌───────────────────────┐           ┌────────────────────────┐ │
│  │     Supabase Auth     │           │   Row Level Security   │ │
│  │     (auth.users)      │◀──────────│      (RLS Matrix)      │ │
│  └──────────┬────────────┘           └───────────┬────────────┘ │
│             │ 1-to-1                             │              │
│             ▼                                    ▼              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │   21 Core & Supporting Tables (UUID v4, Asia/Makassar)     │ │
│  │   • organization_periods  • fields       • profiles        │ │
│  │   • activities            • assignments  • tasks           │ │
│  │   • attendance_sessions   • attendances  • manual_requests │ │
│  │   • evaluation_policies   • criteria     • reviews         │ │
│  │   • final_evaluations     • certificates • clarifications  │ │
│  │   • audit_logs (Immutable)                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│             │                                                   │
│             ▼                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │   Database Engine: Triggers, Calculation Functions & Views │ │
│  │   • calculate_system_score (40 pts)                        │ │
│  │   • calculate_and_upsert_final_evaluation (100 pts)        │ │
│  │   • 4 Analytical Views (v_active_members, v_recap, dll)    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Struktur File Database Repository

Proyek ini telah dilengkapi file migrasi siap jalan dan seed data valid:

```
├── supabase/
│   ├── migrations/
│   │   ├── 20261012000001_initial_schema.sql         # 21 Tabel, DDL, Constraints & FK
│   │   ├── 20261012000002_indexes_and_triggers.sql    # Indeks, Triggers & Audit Logging
│   │   ├── 20261012000003_functions_and_views.sql     # Auth Helpers, Scoring Engine, Views
│   │   └── 20261012000004_row_level_security.sql      # RLS Policies lengkap per tabel
│   └── seed.sql                                       # Seed data uji fiktif teruji 100%
├── scripts/
│   ├── verify-schema.mjs                              # Validator DDL & RLS
│   ├── test-database-execution.mjs                    # Test suite 13 constraint & integritas
│   └── test-queries.mjs                               # Test suite 25 query SQL operasional
└── docs/
    └── DATABASE.md                                    # Dokumentasi arsitektur ini
```

---

## 3. Rumus dan Formula Perhitungan Nilai

Sistem penilaian kepanitiaan membagi bobot secara adil antara kedisiplinan operasional (Sistem: 40%) dan kontribusi kualitatif (Koordinator: 60%):

### A. Komponen Skor Sistem (Maksimal 40 Poin)
1. **Kehadiran Kegiatan (Maksimal 20 Poin)**:
   $$\text{Poin Kehadiran} = \frac{\text{Jumlah Kegiatan Hadir Sah}}{\text{Total Penugasan Kegiatan Aktif}} \times 20.00$$
   *Aturan Bisnis*: Jika panitia tidak memiliki penugasan kegiatan, diberikan poin penuh (20.00) agar tidak terjadi diskriminasi bagi anggota yang belum didelegasikan tugas.

2. **Ketepatan Waktu Presensi (Maksimal 10 Poin)**:
   $$\text{Poin Ketepatan Waktu} = \frac{\text{Jumlah Presensi Tepat Waktu (On Time)}}{\text{Jumlah Presensi Hadir Sah}} \times 10.00$$
   *Aturan Bisnis*: Keterlambatan dihitung otomatis jika waktu check-in melampaui `check_in_closes_at`. Dispensasi keterlambatan sah hanya dapat diubah melalui permohonan klarifikasi yang disetujui koordinator.

3. **Penyelesaian Tugas Mandiri (Maksimal 10 Poin)**:
   $$\text{Poin Tugas} = \frac{\text{Jumlah Tugas Selesai & Terverifikasi}}{\text{Total Tugas yang Diberikan}} \times 10.00$$
   *Aturan Bisnis*: Jika anggota tidak dibebani tugas individual di periode tersebut, diberikan poin penuh (10.00).

$$\text{Skor Sistem} = \text{Poin Kehadiran} + \text{Poin Ketepatan Waktu} + \text{Poin Tugas} \quad (\le 40.00)$$

---

### B. Komponen Evaluasi Koordinator (Maksimal 60 Poin)
Koordinator bidang menilai anggotanya menggunakan rubrik skala 1.00 - 5.00 pada 5 kriteria:

| No | Kriteria Evaluasi | Bobot Maksimal | Formula Poin Terbobot |
|---|---|---|---|
| 1 | Komunikasi & Responsivitas | 15.00 Poin | $(\text{Nilai} / 5.00) \times 15.00$ |
| 2 | Tanggung Jawab & Komitmen | 15.00 Poin | $(\text{Nilai} / 5.00) \times 15.00$ |
| 3 | Kerja Sama Tim | 10.00 Poin | $(\text{Nilai} / 5.00) \times 10.00$ |
| 4 | Inisiatif & Kontribusi | 10.00 Poin | $(\text{Nilai} / 5.00) \times 10.00$ |
| 5 | Sikap & Profesionalisme | 10.00 Poin | $(\text{Nilai} / 5.00) \times 10.00$ |
| **Total** | **Evaluasi Koordinator** | **60.00 Poin** | **Jumlah Poin Terbobot (Maks 60.00)** |

---

### C. Nilai Akhir & Kelayakan Sertifikat
$$\text{Nilai Akhir} = \text{Skor Sistem (Maks 40)} + \text{Skor Koordinator (Maks 60)} \quad (\le 100.00)$$

- **Ambang Batas Kelayakan Default**: $\ge 75.00$ poin.
- **Kondisi Penundaan Kelayakan**: Jika terdapat permohonan klarifikasi presensi/tugas yang masih berstatus `submitted` atau `under_review`, status kelayakan sertifikat dikunci pada `pending` dengan status evaluasi `clarification_open`.
- **Pengesahan**: Sertifikat bernomor unik hanya dapat diterbitkan setelah hasil evaluasi disahkan (`approved`) oleh Ketua Panitia/Admin.
