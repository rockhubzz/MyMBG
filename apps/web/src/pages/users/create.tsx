import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function UsersCreatePage() {
  return <EntityFormPage entity="users" title="Tambah User" isEditing={false} />;
}
