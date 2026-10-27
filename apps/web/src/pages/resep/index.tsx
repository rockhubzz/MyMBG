import EntityCrudPage from '@/components/crud/EntityCrudPage';

export default function ResepPage() {
  return (
    <EntityCrudPage 
      entity="resep" 
      title="Manajemen Resep"
      displayColumns={['nama_menu', 'jumlah_porsi', 'estimasi_waktu_menit', 'deskripsi', 'created_by']}
      columnAliases={{
        nama_menu: 'Nama Menu',
        jumlah_porsi: 'Jumlah Porsi',
        estimasi_waktu_menit: 'Estimasi Waktu Produksi (Menit)',
        deskripsi: 'Deskripsi',
        created_by: 'Dibuat Oleh',
      }}
    />
  );
}
