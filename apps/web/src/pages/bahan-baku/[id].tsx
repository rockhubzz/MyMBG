import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function BahanBakuEditPage() {
  const router = useRouter();
  const { id } = router.query;
  return <EntityFormPage entity="bahan-baku" title="Edit Bahan Baku" isEditing={true} id={typeof id === 'string' ? id : undefined} />;
}
