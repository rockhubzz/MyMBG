import { apiClient } from '@/lib/api/client';

export interface ProduksiCreatePayload {
  resepId: string;
  jumlahPorsiDiproduksi: number;
  tanggalProduksi?: string;
  catatan?: string;
  status?: string;
  createdBy: string;
  kurangiStokSekarang: boolean;
}

export async function createProduksiWithBahan(payload: ProduksiCreatePayload) {
  return apiClient<{
    id: string;
    kurangiStok: boolean;
    message?: string;
  }>('/produksi', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
