'use client';

import { useEffect, useState } from 'react';
import { crudApi } from '@/lib/api/crud';
import { EntityDefinition, ColumnDefinition, PagedResult } from '@/types/crud';
import { Layout } from '@/components/Layout';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth-store';

interface KeuanganDisplayItem {
  id: string;
  [key: string]: any;
}

export default function KeuanganPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<EntityDefinition | null>(null);
  const [items, setItems] = useState<KeuanganDisplayItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const { user } = useAuthStore();
  const pageSize = 20;
  const entity = 'keuangan';

  // Foreign key references cache
  const [fkCache, setFkCache] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    loadData();
  }, [page, search]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load metadata
      if (!metadata) {
        const meta = await crudApi.getEntity(entity);
        setMetadata(meta);
      }

      // Load items
      const result = await crudApi.list(entity, page, pageSize, search);
      setItems(result.items as KeuanganDisplayItem[]);
      setTotal(result.total);

      // Load FK references
      await loadForeignKeyReferences(result.items as KeuanganDisplayItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading data');
    } finally {
      setLoading(false);
    }
  }

  async function loadForeignKeyReferences(items: KeuanganDisplayItem[]) {
    const newCache: Record<string, Record<string, string>> = { ...fkCache };

    // Collect all unique FK IDs to fetch
    const idsToFetch: Record<string, Set<string>> = {};

    for (const item of items) {
      if (item.sesi_produksi_id) {
        if (!idsToFetch['produksi']) idsToFetch['produksi'] = new Set();
        idsToFetch['produksi'].add(item.sesi_produksi_id);
      }
      if (item.distribusi_id) {
        if (!idsToFetch['distribusi']) idsToFetch['distribusi'] = new Set();
        idsToFetch['distribusi'].add(item.distribusi_id);
      }
      if (item.created_by) {
        if (!idsToFetch['users']) idsToFetch['users'] = new Set();
        idsToFetch['users'].add(item.created_by);
      }
    }

    // Fetch data for each entity type
    for (const [entityType, ids] of Object.entries(idsToFetch)) {
      if (!newCache[entityType]) {
        newCache[entityType] = {};
      }

      for (const id of ids) {
        if (!newCache[entityType][id]) {
          try {
            const record = await crudApi.getById(entityType, id);
            const displayValue = getDisplayValue(record, entityType);
            newCache[entityType][id] = displayValue;
          } catch {
            newCache[entityType][id] = '—';
          }
        }
      }
    }

    setFkCache(newCache);
  }

  function getDisplayValue(record: Record<string, any>, entityType: string): string {
    if (entityType === 'produksi') {
      const kode = record.kode_produksi ? `[${record.kode_produksi}] ` : '';
      return `${kode}${record.resep_id ? '(Resep: ' + record.resep_id + ')' : ''} - ${record.tanggal_produksi || ''}`.trim();
    } else if (entityType === 'distribusi') {
      const kode = record.kode_distribusi ? `[${record.kode_distribusi}] ` : '';
      return `${kode}${record.nama_penerima || ''} (${record.lokasi || ''})`;
    } else if (entityType === 'users') {
      return record.nama || record.email || '—';
    } else if (entityType === 'resep') {
      return record.nama_menu || '—';
    }
    return '—';
  }

  function formatValue(value: any, columnName: string): string {
    if (value === null || value === undefined || value === '') return '-';

    // Format currency for amount fields
    if (columnName === 'jumlah_pengeluaran' && typeof value === 'number') {
      return `Rp ${value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Format dates
    if ((columnName.includes('tanggal') || columnName.includes('waktu') || columnName.includes('created_at')) && typeof value === 'string') {
      const date = new Date(value);
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    return String(value);
  }

  function getDisplayColumnValue(item: KeuanganDisplayItem, columnName: string): string {
    const value = item[columnName];

    if (columnName === 'sesi_produksi_id') {
      return value && fkCache['produksi']?.[value] ? fkCache['produksi'][value] : '—';
    } else if (columnName === 'distribusi_id') {
      return value && fkCache['distribusi']?.[value] ? fkCache['distribusi'][value] : '—';
    } else if (columnName === 'created_by') {
      return value && fkCache['users']?.[value] ? fkCache['users'][value] : '—';
    }

    return formatValue(value, columnName);
  }

  const displayColumns = ['created_at', 'tipe_pengeluaran', 'nama_pengeluaran', 'jumlah_pengeluaran', 'sesi_produksi_id', 'distribusi_id', 'created_by'];
  const columnAliases: Record<string, string> = {
    created_at: 'Tanggal',
    tipe_pengeluaran: 'Tipe Pengeluaran',
    nama_pengeluaran: 'Deskripsi Pengeluaran',
    jumlah_pengeluaran: 'Jumlah (Rp)',
    sesi_produksi_id: 'Sesi Produksi',
    distribusi_id: 'Distribusi',
    created_by: 'Dicatat Oleh',
  };

  if (!user) {
    return (
      <Layout>
        <div className="text-center text-red-500">Silahkan login terlebih dahulu</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Log Pengeluaran (Keuangan)</h1>
          <p className="text-gray-600">Catatan otomatis dari biaya produksi dan distribusi</p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-4">
          <input
            type="text"
            placeholder="Cari pengeluaran..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={() => loadData()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500">Memuat data...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            Tidak ada data pengeluaran. Pengeluaran akan dicatat otomatis saat produksi atau distribusi selesai.
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-lg shadow">
              <table className="w-full bg-white">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {displayColumns.map((col) => (
                      <th
                        key={col}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap"
                      >
                        {columnAliases[col] || col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50 transition">
                      {displayColumns.map((col) => (
                        <td key={`${item.id}-${col}`} className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                          {getDisplayColumnValue(item, col)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Menampilkan {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} dari {total} data
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Sebelumnya
                </button>
                <div className="px-4 py-2 text-sm text-gray-600">
                  Halaman {page} dari {Math.ceil(total / pageSize)}
                </div>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Selanjutnya
                </button>
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Catatan:</strong> Halaman ini hanya untuk melihat log pengeluaran. Semua entri dibuat otomatis dari sistem produksi dan distribusi.
                Data tidak dapat diedit atau dihapus secara manual.
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
