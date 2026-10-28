import { useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth-store';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [user, router]);

  return (
    <>
      <Head>
        <title>MyMBG</title>
        <meta name="description" content="Sistem Manajemen MBG" />
      </Head>
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="animate-pulse mb-4">
          <div className="text-6xl mb-4">🍱</div>
        </div>
        <p className="text-gray-600 text-lg font-medium">Mengarahkan ke halaman...</p>
      </div>
    </main>
    </>
  );
}

