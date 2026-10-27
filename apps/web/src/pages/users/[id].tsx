import { useRouter } from 'next/router';
import EntityFormPage from '@/components/crud/EntityFormPage';

export default function UsersEditPage() {
  const router = useRouter();
  const { id } = router.query;
  return <EntityFormPage entity="users" title="Edit User" isEditing={true} id={typeof id === 'string' ? id : undefined} />;
}
