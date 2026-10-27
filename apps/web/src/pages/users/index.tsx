import EntityCrudPage from '@/components/crud/EntityCrudPage';

export default function UsersPage() {
  return (
    <EntityCrudPage 
      entity="users" 
      title="Manajemen Pengguna"
      displayColumns={['nama', 'email', 'role']}
      columnAliases={{
        nama: 'Nama Lengkap',
        email: 'Email',
        role: 'Role'
      }}
    />
  );
}
