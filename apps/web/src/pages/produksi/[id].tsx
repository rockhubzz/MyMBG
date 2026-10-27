import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function ProduksiEditPage() {
  const router = useRouter();
  const { id } = router.query;
  return <EntityFormPage entity="produksi" title="Edit Produksi" isEditing={true} id={typeof id === 'string' ? id : undefined} />;
}
