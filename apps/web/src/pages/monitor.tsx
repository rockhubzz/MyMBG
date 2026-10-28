'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api/client';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/store/auth-store';

interface MonitorRow {
  type: 'produksi' | 'distribusi';
  id: string;
  kode?: string | null;
  nama?: string | null;
  lokasi?: string | null;
  status?: string | null;
  waktu?: string | null;
  porsi: number;
  catatan?: string | null;
  created_at?: string | null;
  terkirim: number;
  biaya: number;
}

type StateFilter = 'running' | 'completed' | 'all';

const FILTERS: { key: StateFilter; label: string }[] = [
  { key: 'running', label: 'Berjalan' },
  { key: 'completed', label: 'Selesai' },
  { key: 'all', label: 'Semua' },
];

const STATUS_BADGE: Record<string, string> = {
  Direncanakan: 'bg-blue-50 text-blue-700 border-blue-200',
  Berlangsung: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Selesai: 'bg-green-50 text-green-700 border-green-200',
  Dibatalkan: 'bg-red-50 text-red-700 border-red-200',
};

const int = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID');

export default function MonitorPage() {
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<StateFilter>('running');
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MonitorRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient<MonitorRow[]>(`/monitoring?state=${filter}`)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat monitoring');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, user]);

  const counts = useMemo(
    () => ({
      produksi: rows.filter((r) => r.type === 'produksi').length,
      distribusi: rows.filter((r) => r.type === 'distribusi').length,
    }),
    [rows]
  );

  if (!user) {
    return (
      <Layout title="Monitor Sesi">
        <div className="text-center text-red-500">Silahkan login terlebih dahulu</div>
      </Layout>
    );
  }

  return (
    <Layout title="Monitor Sesi" description="Pantau sesi produksi dan distribusi yang sedang berjalan">
      {/* Filter */}
      <div className="mb-6 flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
              filter === f.key
                ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-600">
          {counts.produksi} produksi · {counts.distribusi} distribusi
        </span>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">Memuat sesi…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-gray-600 font-medium">Tidak ada sesi pada filter ini</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Tipe</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Kode</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">{filter === 'all' || filter === 'completed' ? 'Nama / Tujuan' : 'Sesi'}</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Status</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Porsi</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((row) => {
                  const progres =
                    row.type === 'produksi'
                      ? row.porsi > 0
                        ? `Terkirim ${int(row.terkirim)} dari ${int(row.porsi)} porsi`
                        : '—'
                      : row.biaya > 0
                        ? `Biaya: Rp ${row.biaya.toLocaleString('id-ID')}`
                        : 'Menunggu penyelesaian';
                  return (
                    <tr
                      key={`${row.type}-${row.id}`}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setDetail(row)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${
                            row.type === 'produksi'
                              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                              : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}
                        >
                          {row.type === 'produksi' ? '🍳 Produksi' : '🚚 Distribusi'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 font-mono whitespace-nowrap">{row.kode ?? '—'}</td>
                      <td className="px-6 py-4 text-gray-700">
                        <div className="truncate max-w-xs">
                          {row.type === 'produksi' ? row.nama ?? '—' : `${row.nama ?? '—'}${row.lokasi ? ` (di ${row.lokasi})` : ''}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${
                            STATUS_BADGE[row.status ?? ''] ?? 'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          {row.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">
                        {row.waktu ? new Date(row.waktu).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{int(row.porsi)}</td>
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{progres}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail card popup — opens when a session row is clicked */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setDetail(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-gray-200 px-6 py-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {detail.type === 'produksi' ? 'Sesi Produksi' : 'Sesi Distribusi'}
              </p>
              <h2 className="text-lg font-semibold text-gray-900">{detail.kode ?? detail.nama ?? '—'}</h2>
            </div>
            <div className="px-6 py-4 overflow-y-auto grow">
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <dt className="text-xs text-gray-500 uppercase">{detail.type === 'produksi' ? 'Menu' : 'Tujuan'}</dt>
                  <dd className="text-sm text-gray-900">{detail.nama ?? '—'}</dd>
                </div>
                {detail.type === 'distribusi' && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Lokasi</dt>
                    <dd className="text-sm text-gray-900">{detail.lokasi ?? '—'}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Status</dt>
                  <dd className="text-sm text-gray-900">{detail.status ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Waktu</dt>
                  <dd className="text-sm text-gray-900">
                    {detail.waktu ? new Date(detail.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500 uppercase">Porsi</dt>
                  <dd className="text-sm text-gray-900">{int(detail.porsi)}</dd>
                </div>
                {detail.type === 'produksi' && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Porsi Terkirim / Sisa</dt>
                    <dd className="text-sm text-gray-900">
                      {int(detail.terkirim)} / {int(detail.porsi - detail.terkirim)}
                    </dd>
                  </div>
                )}
                {detail.type === 'distribusi' && (
                  <div>
                    <dt className="text-xs text-gray-500 uppercase">Biaya Distribusi</dt>
                    <dd className="text-sm text-gray-900">
                      {detail.biaya > 0 ? `Rp ${detail.biaya.toLocaleString('id-ID')}` : 'Belum dicatat'}
                    </dd>
                  </div>
                )}
                {detail.catatan && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-gray-500 uppercase">Catatan</dt>
                    <dd className="text-sm text-gray-900 break-words">{detail.catatan}</dd>
                  </div>
                )}
              </dl>
            </div>
            <div className="border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 transition"
              >
                Tutup
              </button>
              <Link
                href={`/${detail.type}/${detail.id}`}
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
              >
                {detail.type === 'produksi' ? 'Buka Sesi Produksi' : 'Buka Distribusi'}
              </Link>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
