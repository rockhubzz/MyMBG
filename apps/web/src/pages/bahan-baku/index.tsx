import EntityCrudPage from '@/components/crud/EntityCrudPage';

export default function BahanBakuPage() {
  return (
    <EntityCrudPage 
      entity="bahan-baku" 
      title="Manajemen Bahan Baku"
      displayColumns={['nama_bahan', 'stok_saat_ini', 'stok_minimum', 'satuan', 'harga_satuan']}
      columnAliases={{
        nama_bahan: 'Nama Bahan',
        stok_saat_ini: 'Stok Saat Ini',
        stok_minimum: 'Stok Minimum',
        satuan: 'Satuan',
        harga_satuan: 'Harga Satuan',
      }}
    />
  );
}
