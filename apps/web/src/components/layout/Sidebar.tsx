import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthUser } from '@/store/auth-store';
import { FaUserCircle } from 'react-icons/fa';
import { GiKnifeFork } from 'react-icons/gi';
import { FaBoxesPacking } from 'react-icons/fa6';
import { GiCookingPot } from 'react-icons/gi';
import { TbTruckDelivery } from 'react-icons/tb';
import { IoStatsChart } from 'react-icons/io5';
import { FaMoneyBillWave } from 'react-icons/fa';

interface SidebarProps {
  user: AuthUser;
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter();

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: <span className="text-3xl text-green-500"><IoStatsChart /></span> },
    { label: 'Users', href: '/users', icon: <span className="text-3xl text-green-500"><FaUserCircle /></span> },
    { label: 'Bahan Baku', href: '/bahan-baku', icon: <span className="text-3xl text-green-500"><FaBoxesPacking /></span> },
    { label: 'Resep', href: '/resep', icon: <span className="text-3xl text-green-500"><GiKnifeFork /></span> },
    { label: 'Produksi', href: '/produksi', icon: <span className="text-3xl text-green-500"><GiCookingPot /></span> },
    { label: 'Distribusi', href: '/distribusi', icon: <span className="text-3xl text-green-500"><TbTruckDelivery /></span> },
    { label: 'Keuangan', href: '/keuangan', icon: <span className="text-3xl text-green-500"><FaMoneyBillWave /></span> },
  ];

  const ROLE_ROUTES: Record<string, string[]> = {
    Admin: ['/dashboard', '/users', '/bahan-baku', '/resep', '/produksi', '/distribusi', '/keuangan'],
    KepalaDapur: ['/dashboard', '/bahan-baku', '/resep', '/produksi', '/distribusi', '/keuangan'],
    Staff: ['/dashboard', '/bahan-baku', '/produksi', '/distribusi', '/keuangan'],
  };

  const allowedRoutes = ROLE_ROUTES[user.role] ?? ['/dashboard'];
  const isActive = (href: string) => router.pathname === href;

  return (
    <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col fixed h-screen left-0 top-0">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-3 p-4 font-bold text-lg text-gray-800 border-b border-gray-200 hover:bg-gray-50 transition">
        <span className="text-2xl">🍱</span>
        <span>Dapur MBG</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navItems
          .filter((item) => allowedRoutes.includes(item.href))
          .map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition border-l-4 ${
              isActive(item.href)
                ? 'bg-green-50 border-green-600 text-green-700'
                : 'border-transparent text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} Dapur MBG</p>
      </div>
    </aside>
  );
}
