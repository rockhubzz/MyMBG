'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { crudApi } from '@/lib/api/crud';
import { EntityDefinition, ColumnDefinition } from '@/types/crud';
import { Layout } from '@/components/Layout';
import { DistribusiCompleteModal } from '@/components/DistribusiCompleteModal';

type FkLabelMaps = {
  resep: Record<string, string>;
  users: Record<string, string>;
  produksiSession: Record<string, string>;
};

const FK_COLUMN_MAP: Record<string, Partial<Record<string, keyof FkLabelMaps>>> = {
  distribusi: {
    sesi_produksi_id: 'produksiSession',
    created_by: 'users',
  },
};

const emptyFkMaps = (): FkLabelMaps => ({
  resep: {},
  users: {},
  produksiSession: {},
});

export default function DistribusiPage() {
  const [meta, setMeta] = useState<EntityDefinition | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fkMaps, setFkMaps] = useState<FkLabelMaps>(emptyFkMaps);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDistribusi, setSelectedDistribusi] = useState<{ id: string; name: string; kode?: string } | null>(null);

  const entity = 'distribusi';
  const title = 'Manajemen Distribusi';
  const displayColumns = ['kode_distribusi', 'sesi_produksi_id', 'nama_penerima', 'lokasi', 'jumlah_porsi', 'waktu_distribusi', 'created_by'];
  const columnAliases: Record<string, string> = {
    kode_distribusi: 'Kode Distribusi',
    sesi_produksi_id: 'Sesi Produksi',
    nama_penerima: 'Penerima',
    lokasi: 'Lokasi',
    jumlah_porsi: 'Jumlah Porsi',
    waktu_distribusi: 'Waktu Distribusi',
    created_by: 'Dicatat Oleh',
  };

  const formatDateLike = (value: unknown): string => {
    if (value === null || value === undefined) return '-';
    const s = String(value);
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const withTime = s.includes('T') && s.length > 10;
      return d.toLocaleString(
        'id-ID',
        withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }
      );
    }
    return s;
  };

  const formatCellValue = (row: Record<string, unknown>, col: ColumnDefinition): string => {
    const value = row[col.name];
    const lower = col.name.toLowerCase();

    if (lower.includes('tanggal') || col.name === 'waktu_distribusi' || col.name === 'created_at') {
      return formatDateLike(value);
    }

    const fkMapKey = FK_COLUMN_MAP[entity]?.[col.name];
    if (fkMapKey && value !== null && value !== undefined && String(value).length > 0) {
      const id = String(value);
      const label = fkMaps[fkMapKey][id];
      if (label) return label;
      return '—';
    }

    if (value === null || value === undefined) return '-';
    return String(value);
  };

  const columnsToDisplay = useMemo(() => {
    if (!meta) return [];
    const filtered = meta.columns.filter(c => displayColumns.includes(c.name));
    return filtered.sort((a, b) => displayColumns.indexOf(a.name) - displayColumns.indexOf(b.name));
  }, [meta, displayColumns]);

  const load = async () => {
    setTableLoading(true);
    setError(null);
    try {
      const metaRes = await crudApi.getEntity(entity);
      const listRes = await crudApi.list(entity, 1, 50, search);

      setMeta(metaRes);
      setRows(listRes.items);

      const maps = emptyFkMaps();

      try {
        const userList = await crudApi.list('users', 1, 500, '');
        userList.items.forEach((u: Record<string, unknown>) => {
          maps.users[String(u.id)] = String(u.nama ?? u.email ?? u.id);
        });

        const resepList = await crudApi.list('resep', 1, 500, '');
        resepList.items.forEach((r: Record<string, unknown>) => {
          maps.resep[String(r.id)] = String(r.nama_menu ?? r.id);
        });

        const produksiList = await crudApi.list('produksi', 1, 500, '');
        produksiList.items.forEach((p: Record<string, unknown>) => {
          const rid = String(p.resep_id ?? '');
          const menu = maps.resep[rid] || 'Resep';
          const tgl = p.tanggal_produksi != null ? String(p.tanggal_produksi) : '';
          maps.produksiSession[String(p.id)] = tgl ? `${menu} — ${tgl}` : menu;
        });
      } catch (fkErr) {
        console.error('Failed to load related data for FK labels:', fkErr);
      }

      setFkMaps(maps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data');
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void load();
  };

  const remove = async (row: Record<string, unknown>) => {
    if (!meta) return;
    const id = String(row[meta.primaryKey] ?? '');
    if (!window.confirm('Apakah Anda yakin ingin menghapus data ini?')) return;
    try {
      await crudApi.remove(entity, id);
      setSuccess('Data berhasil dihapus');
      await load();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus data');
    }
  };

  const handleCompleteClick = (row: Record<string, unknown>) => {
    if (!meta) return;
    const id = String(row[meta.primaryKey] ?? '');
    const nama_penerima = String(row['nama_penerima'] ?? 'Distribusi');
    const kode_distribusi = String(row['kode_distribusi'] ?? '');
    setSelectedDistribusi({ id, name: nama_penerima, kode: kode_distribusi });
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedDistribusi(null);
  };

  const handleModalSuccess = async () => {
    setSuccess('Distribusi berhasil ditandai selesai');
    await load();
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <Layout title={title} description={`Kelola data ${entity.replace('-', ' ')}`}>
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-start gap-3">
          <span className="text-lg">✓</span>
          <p>{success}</p>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Daftar Data</h2>
            <p className="text-sm text-gray-600">Total: <span className="font-semibold">{rows.length}</span> data</p>
          </div>
          <Link
            href={`/${entity}/create`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition"
          >
            <span>+</span>
            Tambah Data Baru
          </Link>
        </div>

        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari data..."
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 bg-white text-black text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            className="px-6 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-medium hover:bg-gray-300 transition"
          >
            Cari
          </button>
        </form>

        <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-200">
          <div className="overflow-x-auto max-w-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {columnsToDisplay.map((c) => (
                    <th key={c.name} className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">
                      {columnAliases[c.name] || c.name}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-max">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableLoading ? (
                  <tr>
                    <td colSpan={(columnsToDisplay.length ?? 0) + 1} className="px-6 py-8 text-center">
                      <div className="flex justify-center items-center gap-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        <span className="ml-2 text-gray-600">Memloading data...</span>
                      </div>
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={(columnsToDisplay.length ?? 0) + 1} className="px-6 py-12 text-center">
                      <div className="text-3xl mb-2">📭</div>
                      <p className="text-gray-600 font-medium">Belum ada data</p>
                      <p className="text-gray-500 text-sm">Klik tombol "Tambah Data Baru" untuk menambahkan data</p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => (
                    <tr key={`${idx}-${String(row[meta?.primaryKey ?? 'id'] ?? '')}`} className="hover:bg-gray-50">
                      {columnsToDisplay.map((c) => (
                        <td key={c.name} className="px-6 py-4 text-gray-700 whitespace-nowrap min-w-max">
                          <div className="truncate max-w-xs">{formatCellValue(row, c)}</div>
                        </td>
                      ))}
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link
                            href={`/${entity}/${String(row[meta?.primaryKey ?? 'id'] ?? '')}`}
                            className="px-3 py-1.5 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
                          >
                            ✎ Edit
                          </Link>
                          <button
                            onClick={() => handleCompleteClick(row)}
                            className="px-3 py-1.5 rounded-lg border border-green-300 bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition"
                          >
                            ✓ Selesaikan
                          </button>
                          <button
                            onClick={() => void remove(row)}
                            className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition"
                          >
                            🗑 Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedDistribusi && (
        <DistribusiCompleteModal
          isOpen={modalOpen}
          distribusiId={selectedDistribusi.id}
          distribusiName={selectedDistribusi.name}
          kodeDistribusi={selectedDistribusi.kode}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </Layout>
  );
}
