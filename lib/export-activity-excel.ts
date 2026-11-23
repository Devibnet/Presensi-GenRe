import ExcelJS from 'exceljs';
import { formatDateTimeWITA, formatTimeWITA } from './utils';

export interface ActivityForExport {
  id: string;
  activity_name: string;
  activity_code: string;
  activity_location: string;
  start_at: string;
  end_at: string;
  check_in_opens_at?: string | null;
  check_in_closes_at?: string | null;
  check_out_closes_at?: string | null;
  activity_status?: string | null;
  activity_description?: string | null;
  attendance_required?: boolean;
}

export interface AssignmentForExport {
  id: string;
  assignment_status: string;
  assignment_role?: string | null;
  assignment_description?: string | null;
  cancellation_reason?: string | null;
  created_at?: string | null;
  member?: {
    id?: string;
    member_code?: string | null;
    full_name?: string | null;
    organization_position?: string | null;
    system_role?: string | null;
    field_id?: string | null;
    field?: {
      id?: string;
      field_code?: string | null;
      field_name?: string | null;
    } | null;
  } | null;
  attendance?: {
    id?: string;
    check_in_at?: string | null;
    check_in_status?: string | null;
    check_in_method?: string | null;
    check_out_at?: string | null;
    check_out_status?: string | null;
    verification_status?: string | null;
    notes?: string | null;
  } | null;
}

/**
 * Mengekspor seluruh data presensi agenda kegiatan ke dalam file Excel (.xlsx)
 * dengan format profesional, desain visual elegan, border, warna status dinamis,
 * freeze pane, dan lembar statistik per divisi.
 */
export async function exportActivityAttendanceToExcel(
  activity: ActivityForExport,
  assignments: AssignmentForExport[],
  allFields?: Array<{ id: string; field_code?: string; field_name: string }>
): Promise<string> {
  // 1. Hitung metrik dan batas vonis alpa
  const toleranceDeadline = activity.check_in_closes_at || activity.start_at;
  const isGracePeriodOver = Boolean(
    activity.activity_status === 'completed' ||
    (toleranceDeadline && new Date().getTime() > new Date(toleranceDeadline).getTime() + 2 * 60 * 60 * 1000)
  );

  const totalAssigned = assignments.length;
  const totalExcused = assignments.filter((a) => a.assignment_status === 'excused').length;
  const totalOnTime = assignments.filter(
    (a) => a.attendance?.check_in_status === 'on_time' && a.assignment_status !== 'excused'
  ).length;
  const totalLate = assignments.filter(
    (a) => a.attendance?.check_in_status === 'late' && a.assignment_status !== 'excused'
  ).length;
  const totalCheckedIn = totalOnTime + totalLate;
  const totalUnchecked = Math.max(0, totalAssigned - totalCheckedIn - totalExcused);
  const totalAlpa = isGracePeriodOver ? totalUnchecked : 0;
  const totalNotCheckedIn = isGracePeriodOver ? 0 : totalUnchecked;
  const totalValidAttendance = totalCheckedIn + totalExcused;
  const attendanceRate = totalAssigned > 0 ? ((totalValidAttendance / totalAssigned) * 100).toFixed(1) : '0.0';

  const alpaLimitStr = toleranceDeadline
    ? formatDateTimeWITA(new Date(new Date(toleranceDeadline).getTime() + 2 * 60 * 60 * 1000).toISOString())
    : '-';

  // 2. Inisialisasi Workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GenRe Buleleng Attendance System';
  workbook.lastModifiedBy = 'Panitia GenRe Buleleng';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Definisi Style Border Standar
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const cardBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // ==============================================================================
  // SHEET 1: REKAP PRESENSI PANITIA
  // ==============================================================================
  const ws1 = workbook.addWorksheet('Rekap Presensi Panitia', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  // Atur lebar kolom
  ws1.columns = [
    { key: 'no', width: 6 },
    { key: 'member_code', width: 16 },
    { key: 'full_name', width: 34 },
    { key: 'division', width: 28 },
    { key: 'position', width: 24 },
    { key: 'jobdesk', width: 28 },
    { key: 'status', width: 22 },
    { key: 'check_in', width: 25 },
    { key: 'check_out', width: 24 },
    { key: 'method', width: 22 },
    { key: 'notes', width: 42 },
  ];

  // Header Banner Organisasi
  ws1.mergeCells('A1:K1');
  const h1 = ws1.getCell('A1');
  h1.value = 'FORUM GENRE KABUPATEN BULELENG - PROVINSI BALI';
  h1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F766E' } };
  h1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 26;

  ws1.mergeCells('A2:K2');
  const h2 = ws1.getCell('A2');
  h2.value = 'LAPORAN REKAPITULASI PRESENSI & DAFTAR HADIR PANITIA';
  h2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  h2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 20;

  ws1.mergeCells('A3:K3');
  const h3 = ws1.getCell('A3');
  h3.value = `Agenda: ${activity.activity_name} (${activity.activity_code})`;
  h3.font = { name: 'Calibri', size: 11, bold: true, italic: true, color: { argb: 'FF475569' } };
  h3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(3).height = 18;

  // Baris Kosong Pemisah
  ws1.getRow(4).height = 8;

  // KARTU INFORMASI & KPI (Rows 5 - 7)
  const setCardCell = (range: string, label: string, val: string, isAccent = false, isAlert = false) => {
    ws1.mergeCells(range);
    const cell = ws1.getCell(range.split(':')[0]);
    cell.value = {
      richText: [
        { font: { bold: true, size: 9.5, color: { argb: 'FF64748B' } }, text: `${label}: ` },
        { 
          font: { 
            bold: true, 
            size: 10, 
            color: { argb: isAlert ? 'FFB91C1C' : isAccent ? 'FF0F766E' : 'FF0F172A' } 
          }, 
          text: val 
        }
      ]
    };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlert ? 'FFFFF1F2' : isAccent ? 'FFF0FDFA' : 'FFF8FAFC' } };
    
    // Terapkan border ke seluruh sel dalam rentang merge
    const [startCell, endCell] = range.split(':');
    const startCol = startCell.charCodeAt(0) - 64;
    const endCol = endCell.charCodeAt(0) - 64;
    const rowNum = parseInt(startCell.slice(1));
    for (let c = startCol; c <= endCol; c++) {
      const colLetter = String.fromCharCode(64 + c);
      ws1.getCell(`${colLetter}${rowNum}`).border = cardBorder;
    }
  };

  ws1.getRow(5).height = 22;
  setCardCell('A5:C5', 'Lokasi Kegiatan', activity.activity_location || '-');
  setCardCell('D5:G5', 'Jam Buka Presensi', formatDateTimeWITA(activity.check_in_opens_at));
  setCardCell('H5:K5', 'Total Ditugaskan', `${totalAssigned} Panitia`, true);

  ws1.getRow(6).height = 22;
  setCardCell('A6:C6', 'Waktu Acara', `${formatDateTimeWITA(activity.start_at)} s.d. ${formatTimeWITA(activity.end_at)}`);
  setCardCell('D6:G6', 'Toleransi On-Time', formatDateTimeWITA(activity.check_in_closes_at));
  setCardCell('H6:K6', 'Kehadiran Sah', `${totalValidAttendance} dari ${totalAssigned} (${attendanceRate}%)`, true);

  ws1.getRow(7).height = 22;
  setCardCell('A7:C7', 'Waktu Cetak', formatDateTimeWITA(new Date().toISOString()));
  setCardCell('D7:G7', 'Batas Izin / Vonis Alpa', `${alpaLimitStr} (+2 Jam)`, false, true);
  setCardCell('H7:K7', 'Rincian Status', `${totalOnTime} Tepat • ${totalLate} Telat • ${totalExcused} Izin • ${totalAlpa} Alpa`);

  // Baris Kosong Pemisah sebelum Tabel
  ws1.getRow(8).height = 10;

  // ROW 9: HEADER TABEL UTAMA
  const headers = [
    'No.',
    'Nomor Anggota',
    'Nama Lengkap Panitia',
    'Divisi / Sie',
    'Jabatan Organisasi',
    'Tipe Mandat & Jobdesk',
    'Status Kehadiran',
    'Waktu Check-in (WITA)',
    'Waktu Check-out (WITA)',
    'Metode Presensi',
    'Keterangan / Alasan Dispensasi'
  ];

  const headerRow = ws1.getRow(9);
  headerRow.height = 30;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0D5C56' } },
      bottom: { style: 'medium', color: { argb: 'FF0D5C56' } },
      left: { style: 'thin', color: { argb: 'FF14B8A6' } },
      right: { style: 'thin', color: { argb: 'FF14B8A6' } },
    };
  });

  // Terapkan Autofilter
  ws1.autoFilter = {
    from: { row: 9, column: 1 },
    to: { row: 9, column: 11 },
  };

  // ISI DATA PANITIA (Row 10 dst.)
  let currentRowNum = 10;

  if (assignments.length === 0) {
    const emptyRow = ws1.getRow(currentRowNum);
    emptyRow.height = 24;
    ws1.mergeCells(`A${currentRowNum}:K${currentRowNum}`);
    const emptyCell = emptyRow.getCell(1);
    emptyCell.value = 'Belum ada panitia yang ditugaskan pada agenda ini.';
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
    emptyCell.font = { italic: true, color: { argb: 'FF64748B' } };
    currentRowNum++;
  } else {
    assignments.forEach((item, idx) => {
      const att = item.attendance;
      const member = item.member;
      const fieldName = member?.field?.field_name || 'Umum';
      const fieldCode = member?.field?.field_code || '';
      const divisionStr = fieldCode ? `${fieldName} (${fieldCode})` : fieldName;

      let statusStr = 'Belum Hadir';
      let checkInTimeStr = '-';
      let checkOutTimeStr = '-';
      let methodStr = '-';
      let notesStr = '-';

      // Style badge status
      let statusBg = 'FFF1F5F9';
      let statusFg = 'FF475569';
      let statusBorderColor = 'FFCBD5E1';

      if (item.assignment_status === 'excused') {
        statusStr = 'Izin / Dispensasi';
        notesStr = item.cancellation_reason || 'Dispensasi Disetujui Koordinator';
        statusBg = 'FFF5F3FF';
        statusFg = 'FF5B21B6';
        statusBorderColor = 'FFDDD6FE';
      } else if (att?.check_in_at) {
        if (att.check_in_status === 'on_time') {
          statusStr = 'Tepat Waktu';
          statusBg = 'FFECFDF5';
          statusFg = 'FF065F46';
          statusBorderColor = 'FFA7F3D0';
        } else if (att.check_in_status === 'late') {
          statusStr = 'Terlambat';
          statusBg = 'FFFFFBEB';
          statusFg = 'FF92400E';
          statusBorderColor = 'FFFDE68A';
        } else {
          statusStr = 'Hadir';
          statusBg = 'FFECFDF5';
          statusFg = 'FF065F46';
          statusBorderColor = 'FFA7F3D0';
        }
        checkInTimeStr = formatDateTimeWITA(att.check_in_at);
        if (att.check_out_at) {
          checkOutTimeStr = formatDateTimeWITA(att.check_out_at);
        }

        if (att.check_in_method === 'qr') methodStr = 'QR Code Scanner';
        else if (att.check_in_method === 'manual') methodStr = 'Input Manual Admin/Koordinator';
        else if (att.check_in_method === 'pin') methodStr = 'Kode PIN/Mandiri';
        else if (att.check_in_method) methodStr = att.check_in_method.toUpperCase();
        else methodStr = 'Sistem Presensi';

        if (att.notes) {
          notesStr = att.notes;
        }
      } else if (isGracePeriodOver) {
        statusStr = 'Alpa (Tidak Hadir)';
        notesStr = 'Tidak hadir & tidak ada izin sah hingga batas waktu toleransi + 2 jam';
        statusBg = 'FFFFF1F2';
        statusFg = 'FF9F1239';
        statusBorderColor = 'FFFECDD3';
      } else {
        statusStr = 'Belum Hadir';
        notesStr = 'Menunggu kehadiran panitia';
        statusBg = 'FFF8FAFC';
        statusFg = 'FF64748B';
        statusBorderColor = 'FFE2E8F0';
      }

      const jobdeskParts = [];
      if (item.assignment_role) jobdeskParts.push(item.assignment_role);
      if (item.assignment_description) jobdeskParts.push(item.assignment_description);
      const jobdeskStr = jobdeskParts.length > 0 ? jobdeskParts.join(' • ') : 'Wajib Hadir';

      const row = ws1.getRow(currentRowNum);
      row.height = 24;

      const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

      const values = [
        idx + 1,
        member?.member_code || '-',
        member?.full_name || 'Panitia',
        divisionStr,
        member?.organization_position || 'Anggota',
        jobdeskStr,
        statusStr,
        checkInTimeStr,
        checkOutTimeStr,
        methodStr,
        notesStr
      ];

      values.forEach((v, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = v;
        cell.border = thinBorder;
        cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

        // Alignment per kolom
        if (colIdx === 0) {
          // No
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        } else if (colIdx === 1) {
          // Nomor Anggota
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF0F766E' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        } else if (colIdx === 2) {
          // Nama Lengkap
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        } else if (colIdx === 6) {
          // Status Kehadiran (Badge Style)
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: statusFg } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusBg } };
          cell.border = {
            top: { style: 'thin', color: { argb: statusBorderColor } },
            bottom: { style: 'thin', color: { argb: statusBorderColor } },
            left: { style: 'thin', color: { argb: statusBorderColor } },
            right: { style: 'thin', color: { argb: statusBorderColor } },
          };
        } else if (colIdx === 7 || colIdx === 8) {
          // Timestamp
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { name: 'Consolas', size: 9.5, color: { argb: 'FF334155' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        } else if (colIdx === 9) {
          // Metode
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        } else {
          // Sisa teks
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };
        }
      });

      currentRowNum++;
    });
  }

  // BARIS TOTAL KESELURUHAN (Bottom Summary)
  const totalRow = ws1.getRow(currentRowNum);
  totalRow.height = 26;
  ws1.mergeCells(`A${currentRowNum}:F${currentRowNum}`);
  const labelTotal = totalRow.getCell(1);
  labelTotal.value = 'TOTAL REKAPITULASI PRESENSI:';
  labelTotal.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  labelTotal.alignment = { horizontal: 'right', vertical: 'middle' };
  labelTotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  for (let c = 1; c <= 6; c++) {
    totalRow.getCell(c).border = {
      top: { style: 'medium', color: { argb: 'FF0F766E' } },
      bottom: { style: 'double', color: { argb: 'FF0F766E' } },
    };
  }

  const statCell = totalRow.getCell(7);
  statCell.value = `${totalCheckedIn} Hadir • ${totalExcused} Izin • ${totalAlpa} Alpa`;
  statCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F766E' } };
  statCell.alignment = { horizontal: 'center', vertical: 'middle' };
  statCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
  statCell.border = {
    top: { style: 'medium', color: { argb: 'FF0F766E' } },
    bottom: { style: 'double', color: { argb: 'FF0F766E' } },
  };

  ws1.mergeCells(`H${currentRowNum}:K${currentRowNum}`);
  const rateCell = totalRow.getCell(8);
  rateCell.value = `Tingkat Kehadiran Sah: ${attendanceRate}% (${totalValidAttendance}/${totalAssigned} Panitia)`;
  rateCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
  rateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  for (let c = 8; c <= 11; c++) {
    totalRow.getCell(c).border = {
      top: { style: 'medium', color: { argb: 'FF0F766E' } },
      bottom: { style: 'double', color: { argb: 'FF0F766E' } },
    };
  }

  // ==============================================================================
  // SHEET 2: RINGKASAN PER DIVISI / SIE
  // ==============================================================================
  const ws2 = workbook.addWorksheet('Ringkasan per Divisi', {
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1 }
  });

  ws2.columns = [
    { key: 'no', width: 6 },
    { key: 'code', width: 14 },
    { key: 'name', width: 32 },
    { key: 'assigned', width: 18 },
    { key: 'ontime', width: 16 },
    { key: 'late', width: 16 },
    { key: 'excused', width: 18 },
    { key: 'alpa', width: 18 },
    { key: 'valid', width: 20 },
    { key: 'rate', width: 22 },
  ];

  ws2.mergeCells('A1:J1');
  const s2H1 = ws2.getCell('A1');
  s2H1.value = 'FORUM GENRE KABUPATEN BULELENG - PROVINSI BALI';
  s2H1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF0F766E' } };
  s2H1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 26;

  ws2.mergeCells('A2:J2');
  const s2H2 = ws2.getCell('A2');
  s2H2.value = 'REKAPITULASI TINGKAT KEHADIRAN PANITIA PER DIVISI / SIE';
  s2H2.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF1E293B' } };
  s2H2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 20;

  ws2.mergeCells('A3:J3');
  const s2H3 = ws2.getCell('A3');
  s2H3.value = `Agenda: ${activity.activity_name} (${activity.activity_code}) • Diekspor pada ${formatDateTimeWITA(new Date().toISOString())}`;
  s2H3.font = { name: 'Calibri', size: 10.5, italic: true, color: { argb: 'FF475569' } };
  s2H3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(3).height = 18;

  ws2.getRow(4).height = 8;

  // Header Tabel Divisi (Row 5)
  const divHeaders = [
    'No.',
    'Kode Divisi',
    'Nama Divisi / Sie',
    'Total Ditugaskan',
    'Tepat Waktu',
    'Terlambat',
    'Izin / Dispensasi',
    'Alpa / Belum Hadir',
    'Total Hadir Sah',
    'Tingkat Kehadiran (%)'
  ];

  const divHeaderRow = ws2.getRow(5);
  divHeaderRow.height = 30;
  divHeaders.forEach((h, idx) => {
    const cell = divHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0D5C56' } },
      bottom: { style: 'medium', color: { argb: 'FF0D5C56' } },
      left: { style: 'thin', color: { argb: 'FF14B8A6' } },
      right: { style: 'thin', color: { argb: 'FF14B8A6' } },
    };
  });

  ws2.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: 10 },
  };

  // Pengelompokan penugasan per divisi
  const fieldGroups = new Map<string, { code: string; name: string; items: AssignmentForExport[] }>();

  if (allFields && allFields.length > 0) {
    allFields.forEach((f) => {
      fieldGroups.set(f.id, {
        code: f.field_code || 'DIV',
        name: f.field_name,
        items: []
      });
    });
  }

  assignments.forEach((item) => {
    const fId = item.member?.field?.id || item.member?.field_id || 'unknown';
    const fCode = item.member?.field?.field_code || 'UMUM';
    const fName = item.member?.field?.field_name || 'Umum';

    if (!fieldGroups.has(fId)) {
      fieldGroups.set(fId, { code: fCode, name: fName, items: [] });
    }
    fieldGroups.get(fId)!.items.push(item);
  });

  let divRowNum = 6;
  let dIdx = 1;
  let sumAssigned = 0;
  let sumOnTime = 0;
  let sumLate = 0;
  let sumExcused = 0;
  let sumAlpa = 0;
  let sumValid = 0;

  fieldGroups.forEach((group) => {
    if (group.items.length === 0) return;

    const gAssigned = group.items.length;
    const gExcused = group.items.filter((a) => a.assignment_status === 'excused').length;
    const gOnTime = group.items.filter(
      (a) => a.attendance?.check_in_status === 'on_time' && a.assignment_status !== 'excused'
    ).length;
    const gLate = group.items.filter(
      (a) => a.attendance?.check_in_status === 'late' && a.assignment_status !== 'excused'
    ).length;
    const gCheckedIn = gOnTime + gLate;
    const gUnchecked = Math.max(0, gAssigned - gCheckedIn - gExcused);
    const gValid = gCheckedIn + gExcused;
    const gRate = gAssigned > 0 ? ((gValid / gAssigned) * 100).toFixed(1) : '0.0';

    sumAssigned += gAssigned;
    sumOnTime += gOnTime;
    sumLate += gLate;
    sumExcused += gExcused;
    sumAlpa += gUnchecked;
    sumValid += gValid;

    const row = ws2.getRow(divRowNum);
    row.height = 24;
    const rowBg = dIdx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    const rowVals = [
      dIdx++,
      group.code,
      group.name,
      gAssigned,
      gOnTime,
      gLate,
      gExcused,
      gUnchecked,
      gValid,
      `${gRate}%`
    ];

    rowVals.forEach((v, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      cell.value = v;
      cell.border = thinBorder;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } };

      if (cIdx === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (cIdx === 1) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { name: 'Consolas', size: 10, bold: true, color: { argb: 'FF0F766E' } };
      } else if (cIdx === 2) {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
      } else if (cIdx >= 3 && cIdx <= 8) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (cIdx === 9) {
        // Rate
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF065F46' } };
      }
    });

    divRowNum++;
  });

  // BARIS TOTAL SHEET 2
  const divTotalRow = ws2.getRow(divRowNum);
  divTotalRow.height = 26;
  ws2.mergeCells(`A${divRowNum}:C${divRowNum}`);
  const totalDivLabel = divTotalRow.getCell(1);
  totalDivLabel.value = 'TOTAL KESELURUHAN DIVISI:';
  totalDivLabel.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  totalDivLabel.alignment = { horizontal: 'right', vertical: 'middle' };

  for (let c = 1; c <= 3; c++) {
    divTotalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    divTotalRow.getCell(c).border = {
      top: { style: 'medium', color: { argb: 'FF0F766E' } },
      bottom: { style: 'double', color: { argb: 'FF0F766E' } },
    };
  }

  const overallRate = sumAssigned > 0 ? ((sumValid / sumAssigned) * 100).toFixed(1) : '0.0';
  const totals = [sumAssigned, sumOnTime, sumLate, sumExcused, sumAlpa, sumValid, `${overallRate}%`];
  totals.forEach((val, i) => {
    const cell = divTotalRow.getCell(i + 4);
    cell.value = val;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F766E' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0F766E' } },
      bottom: { style: 'double', color: { argb: 'FF0F766E' } },
    };
  });

  // ==============================================================================
  // 3. GENERATE FILENAME & DOWNLOAD BROWSER
  // ==============================================================================
  const sanitizedCode = (activity.activity_code || 'AGENDA').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = activity.start_at
    ? new Date(activity.start_at).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];
  const filename = `Rekap_Presensi_${sanitizedCode}_${dateStr}.xlsx`;

  if (typeof window !== 'undefined') {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return filename;
}
