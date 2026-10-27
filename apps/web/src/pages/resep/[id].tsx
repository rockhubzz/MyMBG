import { useRouter } from 'next/router';
import ResepFormPage from '@/components/crud/ResepFormPage';

export default function ResepEditPage() {
  const router = useRouter();
  const { id } = router.query;
  return <ResepFormPage isEditing={true} id={typeof id === 'string' ? id : undefined} />;
}
