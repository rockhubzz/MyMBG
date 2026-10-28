'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '@/lib/api/client';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/store/auth-store';

interface ProduksiAvailability {
  id: string;
  kode_produksi?: string | null;
  nama_menu?: string | null;
  tanggal_produksi?: string | null;
  status?: string | null;
  porsi_diproduksi: number;
  porsi_terkirim: number;
  sisa_porsi: number;
}

const int = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toLocaleString('id-ID');

export default function StokSiapKirimPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<ProduksiAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient<ProduksiAvailability[]>('/distribusi/available-productions')
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat stok siap kirim');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <Layout>
        <div className="text-center text-red-500">Silahkan login terlebih dahulu</div>
      </Layout>
    );
  }

  const totalTersedia = rows.reduce((sum, r) => sum + Number(r.sisa_porsi ?? 0), 0);

  return (
    <Layout title="Stok Siap Kirim" description="Menu yang sudah diproduksi dan menunggu distribusi">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {rows.length} sesi produksi tersedia · total {int(totalTersedia)} porsi tersedia
        </p>
        <button
          onClick={() => router.reload()}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
        >
          ↻ Muat Ulang
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-500">Memuat stok…</div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center">
          <div className="text-3xl mb-2">📦</div>
          <p className="text-gray-600 font-medium">Belum ada porsi siap kirim</p>
          <p className="text-gray-500 text-sm mt-1">Selesaikan sesi produksi terlebih dahulu, lalu stok porsi akan muncul di sini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Kode</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Menu</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Jumlah Produksi</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Terkirim</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Tersedia</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-700 font-mono whitespace-nowrap">{p.kode_produksi ?? '—'}</td>
                    <td className="px-6 py-4 text-gray-900 font-medium">
                      <div className="truncate max-w-xs">{p.nama_menu ?? 'Resep tidak diketahui'}</div>
                      <div className="text-xs text-gray-500">
                        {p.tanggal_produksi ? String(p.tanggal_produksi).slice(0, 10) : ''}{p.status ? ` · ${p.status}` : ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{int(Number(p.porsi_diproduksi))} porsi</td>
                    <td className="px-6 py-4 text-gray-700 whitespace-nowrap">{int(Number(p.porsi_terkirim))} porsi</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold border bg-green-50 text-green-700 border-green-200">
                        {int(Number(p.sisa_porsi))} porsi tersedia
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() =>
                          router.push(`/distribusi/new?sesi=${p.id}&sisa=${Number(p.sisa_porsi)}`)
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition"
                      >
                        🚚 Buat Distribusi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Layout>
  );
}
