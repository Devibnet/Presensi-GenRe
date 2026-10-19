import { NextResponse } from 'next/server';
import { calculateMemberEvaluation, calculateAllMembersEvaluation } from '@/lib/evaluations';

export async function POST(request: Request) {
  try {
    let { periodId, memberId } = (await request.json().catch(() => ({}))) as { periodId?: string; memberId?: string };

    if (memberId) {
      const result = await calculateMemberEvaluation(memberId, periodId);
      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Gagal menghitung skor anggota' }, { status: 500 });
      }
      return NextResponse.json({
        message: 'Perhitungan skor selesai untuk 1 anggota.',
        totalProcessed: 1,
        results: [result],
      });
    }

    const bulkResult = await calculateAllMembersEvaluation(periodId);
    return NextResponse.json({
      message: `Perhitungan nilai selesai untuk ${bulkResult.totalProcessed} anggota.`,
      totalProcessed: bulkResult.totalProcessed,
      successCount: bulkResult.successCount,
      failedCount: bulkResult.failedCount,
      results: bulkResult.results,
    });
  } catch (err: any) {
    console.error('Error in POST /api/evaluations/calculate:', err);
    return NextResponse.json({ error: err.message || 'Kesalahan server' }, { status: 500 });
  }
}
