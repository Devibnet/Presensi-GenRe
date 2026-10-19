-- ==============================================================================
-- GENRE ATTENDANCE - SUPABASE POSTGRESQL MIGRATION
-- Migration: 20261013000001_add_genre_2026_fields.sql
-- Description: Menambahkan seksi/divisi kepanitiaan Pemilihan Duta GenRe Buleleng 2026/2027
-- Sesuai struktur resmi pada CSV akun_panitia_genre_buleleng_2026.csv
-- ==============================================================================

INSERT INTO fields (id, period_id, field_name, field_code, field_description, field_status) VALUES
('22222222-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Penanggung Jawab', 'PNJ', 'Pelindung dan Penanggung Jawab Kepanitiaan', 'active'),
('22222222-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Pimpinan Panitia', 'KPT', 'Ketua dan Wakil Ketua Panitia Pelaksana', 'active'),
('22222222-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Bendahara Panitia', 'BEN', 'Pengelolaan Anggaran dan Keuangan Panitia', 'active'),
('22222222-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Sie Konsumsi dan Rohani', 'KON', 'Penyediaan Konsumsi dan Kegiatan Kerohanian', 'active'),
('22222222-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Sie Perlengkapan, Tempat dan Keamanan', 'PER', 'Logistik, Keamanan, Venue, dan Perlengkapan Acara', 'active'),
('22222222-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Sie Publikasi dan Dokumentasi', 'PUB', 'Dokumentasi, Fotografi, Videografi, dan Publikasi Media Sosial', 'active'),
('22222222-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Sie Penggalian Dana', 'DAN', 'Sponsorship, Donatur, dan Penggalian Dana Kegiatan', 'active'),
('22222222-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Sie Ilmiah dan Lomba', 'ILM', 'Penyusunan Materi Uji, Seleksi Ilmiah, dan Teknis Perlombaan', 'active'),
('22222222-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Sie Official Duta', 'OFF', 'Pendampingan, Pengawalan, dan Koordinasi Finalis Duta GenRe', 'active')
ON CONFLICT (period_id, field_code) DO NOTHING;
