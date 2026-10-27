import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function DistribusiCreatePage() {
  return <EntityFormPage entity="distribusi" title="Tambah Distribusi" isEditing={false} />;
}
