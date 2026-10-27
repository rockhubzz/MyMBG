import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { crudApi } from '@/lib/api/crud';
import { ColumnDefinition, EntityDefinition } from '@/types/crud';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/store/auth-store';

interface Props {
  isEditing?: boolean;
  id?: string;
}

type FormState = Record<string, string>;

interface BahanBakuEntry {
  id?: string;
  bahan_baku_id: string;
  jumlah: string;
  catatan: string;
  nama_bahan?: string; // For display
}

function humanizeLabel(fieldName: string): string {
  return fieldName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getFieldHint(fieldName: string): string {
  const hints: Record<string, string> = {
    nama_menu: 'Masukkan nama menu/resep',
    jumlah_porsi: 'Masukkan jumlah porsi yang dihasilkan',
    estimasi_waktu_menit: 'Masukkan perkiraan waktu produksi dalam menit',
    deskripsi: 'Masukkan deskripsi atau catatan tambahan',
  };
  return hints[fieldName] || `Masukkan ${fieldName.toLowerCase()}`;
}

function isEditableResepField(col: ColumnDefinition): boolean {
  const lower = col.name.toLowerCase();
  // Exclude system fields
  if (lower === 'is_active' || lower === 'created_by') {
    return false;
  }
  return !col.isPrimaryKey && lower !== 'created_at' && lower !== 'updated_at';
}

export default function ResepFormPage({ isEditing = false, id }: Props) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [meta, setMeta] = useState<EntityDefinition | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [bahanBakuList, setBahanBakuList] = useState<Record<string, unknown>[]>([]);
  const [bahanBakuEntries, setBahanBakuEntries] = useState<BahanBakuEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const editableColumns = useMemo(
    () => (meta?.columns ?? []).filter(isEditableResepField),
    [meta]
  );

  // Load metadata, resep data, and bahan baku list
  useEffect(() => {
    const load = async () => {
      try {
        const [metaRes, bahanRes] = await Promise.all([
          crudApi.getEntity('resep'),
          crudApi.list('bahan-baku', 1, 500, ''),
        ]);
        setMeta(metaRes);
        setBahanBakuList(bahanRes.items);

        if (isEditing && id) {
          const [resepRes, resepBahanRes] = await Promise.all([
            crudApi.getById('resep', id),
            crudApi.list('resep-bahan', 1, 500, ''),
          ]);

          const formData: FormState = {};
          metaRes.columns.filter(isEditableResepField).forEach((col) => {
            formData[col.name] = resepRes[col.name] == null ? '' : String(resepRes[col.name]);
          });
          setForm(formData);

          // Filter resep_bahan entries for this resep
          const entries = (resepBahanRes.items as Record<string, unknown>[])
            .filter(item => String(item.resep_id) === id)
            .map(item => ({
              id: String(item.id),
              bahan_baku_id: String(item.bahan_baku_id),
              jumlah: String(item.jumlah),
              catatan: item.catatan ? String(item.catatan) : '',
              nama_bahan: String(item.nama_bahan || ''),
            }));
          setBahanBakuEntries(entries);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };

    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, id]);

  const handleAddBahanBaku = () => {
    setBahanBakuEntries([...bahanBakuEntries, { bahan_baku_id: '', jumlah: '', catatan: '' }]);
  };

  const handleRemoveBahanBaku = (index: number) => {
    setBahanBakuEntries(bahanBakuEntries.filter((_, i) => i !== index));
  };

  const handleBahanBakuChange = (index: number, field: keyof BahanBakuEntry, value: string) => {
    const updated = [...bahanBakuEntries];
    updated[index] = { ...updated[index], [field]: value };

    // Get bahan baku name when selected
    if (field === 'bahan_baku_id') {
      const bahan = bahanBakuList.find(b => String(b.id) === value);
      updated[index].nama_bahan = bahan ? String(bahan.nama_bahan || bahan.nama || '') : '';
    }

    setBahanBakuEntries(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {};
      editableColumns.forEach((col) => {
        const v = (form[col.name] ?? '').trim();
        if (v.length > 0) {
          // Convert numeric fields to numbers
          if (col.dataType.includes('numeric') || col.dataType.includes('integer')) {
            payload[col.name] = parseFloat(v) || 0;
          } else {
            payload[col.name] = v;
          }
        }
      });

      // Add system fields only if they exist in the table (not in editable columns means they're system fields)
      const hasIsActive = meta?.columns.some(c => c.name.toLowerCase() === 'is_active');
      const hasCreatedBy = meta?.columns.some(c => c.name.toLowerCase() === 'created_by');

      // Add is_active default only if it exists and we're creating
      if (!isEditing && hasIsActive) {
        payload.is_active = true;
      }

      // Add created_by on creation only if it exists
      if (!isEditing && hasCreatedBy && user?.id) {
        payload.created_by = user.id;
      }

      let resepId = id;

      if (isEditing && id) {
        await crudApi.update('resep', id, payload);
      } else {
        const res = await crudApi.create('resep', payload);
        resepId = String(res.id);
      }

      // Save resep_bahan entries
      if (resepId) {
        // Delete old entries if editing
        if (isEditing && id) {
          const allResepBahan = await crudApi.list('resep-bahan', 1, 500, '');
          for (const entry of (allResepBahan.items as Record<string, unknown>[])) {
            if (String(entry.resep_id) === id) {
              await crudApi.remove('resep-bahan', String(entry.id));
            }
          }
        }

        // Create new entries
        for (const entry of bahanBakuEntries) {
          if (entry.bahan_baku_id && entry.jumlah) {
            await crudApi.create('resep-bahan', {
              resep_id: resepId,
              bahan_baku_id: entry.bahan_baku_id,
              jumlah: parseFloat(entry.jumlah) || 0,
              catatan: entry.catatan || null,
            });
          }
        }
      }

      setSuccess(isEditing ? 'Resep berhasil diperbarui' : 'Resep berhasil ditambahkan');
      setTimeout(() => {
        router.push('/resep');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Layout title={isEditing ? 'Edit Resep' : 'Tambah Resep'}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-flex flex-col items-center gap-3">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-gray-600 mt-4">Memuat formulir...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isEditing ? 'Edit Resep' : 'Tambah Resep'} description={isEditing ? 'Perbarui resep' : 'Buat resep baru'}>
      <Link
        href="/resep"
        className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Kembali ke Daftar
      </Link>

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

      <div className="bg-white rounded-xl shadow p-6 md:p-8 max-w-4xl">
        <form onSubmit={handleSubmit}>
          {/* Resep Details */}
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Informasi Resep</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {editableColumns.map((col) => (
              <div key={col.name}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {humanizeLabel(col.name)}
                  {!col.isNullable && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={form[col.name] ?? ''}
                  onChange={(e) => setForm((s) => ({ ...s, [col.name]: e.target.value }))}
                  placeholder={`Masukkan ${col.name.toLowerCase()}`}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white text-black text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">{getFieldHint(col.name)}</p>
              </div>
            ))}
          </div>

          {/* Bahan Baku */}
          <div className="mt-8 pt-8 border-t">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Bahan Baku yang Digunakan</h2>
              <button
                type="button"
                onClick={handleAddBahanBaku}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition"
              >
                + Tambah Bahan Baku
              </button>
            </div>

            {bahanBakuEntries.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">Belum ada bahan baku yang ditambahkan. Klik tombol di atas untuk menambahkan.</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Bahan Baku</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Jumlah</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Catatan</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bahanBakuEntries.map((entry, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3">
                          <select
                            value={entry.bahan_baku_id}
                            onChange={(e) => handleBahanBakuChange(idx, 'bahan_baku_id', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-black text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Pilih Bahan Baku</option>
                            {bahanBakuList.map((bahan) => (
                              <option key={String(bahan.id)} value={String(bahan.id)}>
                                {String(bahan.nama_bahan || bahan.nama || bahan.id)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.jumlah}
                            onChange={(e) => handleBahanBakuChange(idx, 'jumlah', e.target.value)}
                            placeholder="Jumlah"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-black text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={entry.catatan}
                            onChange={(e) => handleBahanBakuChange(idx, 'catatan', e.target.value)}
                            placeholder="Catatan (opsional)"
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-black text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveBahanBaku(idx)}
                            className="px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition"
                          >
                            🗑 Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 mt-8">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Menyimpan...
                </>
              ) : (
                <>{isEditing ? '💾 Simpan Perubahan' : '✓ Simpan Resep'}</>
              )}
            </button>
            <Link
              href="/resep"
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
            >
              Batal
            </Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
