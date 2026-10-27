import { ReactNode } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Sidebar } from './layout/Sidebar';
import { Header } from './layout/Header';
import { Footer } from './layout/Footer';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function Layout({ children, title, description }: LayoutProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <p className="text-sm text-gray-500">Mengarahkan ke halaman login...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Sidebar - Fixed positioning */}
      <Sidebar user={user} />

      {/* Main Content - Accounts for fixed sidebar with margin */}
      <div className="ml-64 h-screen flex flex-col">
        {/* Header */}
        <Header title={title} description={description} user={user} />

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-8">
          {children}
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
