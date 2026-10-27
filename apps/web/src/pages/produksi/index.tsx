import EntityCrudPage from '@/components/crud/EntityCrudPage';

export default function ProduksiPage() {
  return (
    <EntityCrudPage
      entity="produksi"
      title="Manajemen Produksi"
      displayColumns={['kode_produksi', 'resep_id', 'tanggal_produksi', 'jumlah_porsi_diproduksi', 'status', 'created_by']}
      columnAliases={{
        kode_produksi: 'Kode Produksi',
        resep_id: 'Menu / Resep',
        tanggal_produksi: 'Tanggal Produksi',
        jumlah_porsi_diproduksi: 'Jumlah Porsi Diproduksi',
        status: 'Status',
        created_by: 'Dibuat Oleh',
      }}
    />
  );
}
