'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface DistribusiCompleteModalProps {
  isOpen: boolean;
  distribusiId: string;
  distribusiName: string;
  kodeDistribusi?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DistribusiCompleteModal({
  isOpen,
  distribusiId,
  distribusiName,
  kodeDistribusi,
  onClose,
  onSuccess,
}: DistribusiCompleteModalProps) {
  const [biayaDistribusi, setBiayaDistribusi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!biayaDistribusi.trim()) {
      setError('Biaya distribusi harus diisi');
      return;
    }

    const biaya = parseFloat(biayaDistribusi);
    if (isNaN(biaya) || biaya < 0) {
      setError('Biaya distribusi harus berupa angka positif');
      return;
    }

    try {
      setLoading(true);
      await apiClient<{ id: string; message: string }>(
        `/distribusi/${distribusiId}/complete`,
        {
          method: 'POST',
          body: JSON.stringify({ BiayaDistribusi: biaya }),
        }
      );

      setBiayaDistribusi('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menandai distribusi selesai');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Selesaikan Distribusi</h2>
          <p className="text-sm text-gray-500 mt-1">
            {kodeDistribusi && <span className="font-medium">[{kodeDistribusi}]</span>} Distribusi: {distribusiName}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="biaya" className="block text-sm font-medium text-gray-700 mb-2">
                Biaya Distribusi (Rp)
              </label>
              <input
                id="biaya"
                type="number"
                step="0.01"
                min="0"
                value={biayaDistribusi}
                onChange={(e) => setBiayaDistribusi(e.target.value)}
                placeholder="Masukkan biaya distribusi"
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:border-blue-500 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">
                Biaya ini akan dicatat secara otomatis di log pengeluaran (Keuangan)
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Selesaikan Distribusi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
