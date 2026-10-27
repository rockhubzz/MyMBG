import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function DistribusiEditPage() {
  const router = useRouter();
  const { id } = router.query;
  return <EntityFormPage entity="distribusi" title="Edit Distribusi" isEditing={true} id={typeof id === 'string' ? id : undefined} />;
}
