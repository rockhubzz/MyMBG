import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function BahanBakuCreatePage() {
  return <EntityFormPage entity="bahan-baku" title="Tambah Bahan Baku" isEditing={false} />;
}
