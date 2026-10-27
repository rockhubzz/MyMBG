import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function ProduksiCreatePage() {
  return <EntityFormPage entity="produksi" title="Tambah Produksi" isEditing={false} />;
}
