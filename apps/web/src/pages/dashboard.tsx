import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/auth-store';
import { crudApi } from '@/lib/api/crud';
import { StatCard } from '@/components/StatCard';
import { Layout } from '@/components/Layout';
import { FaBoxesPacking } from 'react-icons/fa6';
import { GiKnifeFork } from 'react-icons/gi';
import { GiCookingPot } from 'react-icons/gi';
import { CiDeliveryTruck } from 'react-icons/ci';
import { TbTruckDelivery } from 'react-icons/tb';
import { FaUserCircle } from 'react-icons/fa';

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  
  const [stats, setStats] = useState({
    users: 0,
    bahanBaku: 0,
    resep: 0,
    produksi: 0,
    distribusi: 0,
    produksiBerlangsung: 0,
  });
  const [latestMenus, setLatestMenus] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  // Load statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const [users, bahanBaku, resep, produksi, distribusi, latestResep] = await Promise.all([
          crudApi.list('users', 1, 1),
          crudApi.list('bahan-baku', 1, 1),
          crudApi.list('resep', 1, 1),
          crudApi.list('produksi', 1, 50),
          crudApi.list('distribusi', 1, 1),
          crudApi.list('resep', 1, 3),
        ]);

        const produksiItems = produksi.items as Record<string, unknown>[];
        const produksiBerlangsung = produksiItems.filter(
          (row) => String(row.status ?? '') === 'Berlangsung'
        ).length;

        setStats({
          users: users.total ?? 0,
          bahanBaku: bahanBaku.total ?? 0,
          resep: resep.total ?? 0,
          produksi: produksi.total ?? 0,
          distribusi: distribusi.total ?? 0,
          produksiBerlangsung,
        });
        setLatestMenus(latestResep.items ?? []);
      } catch (err) {
        console.error('Failed to load stats:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      void loadStats();
    }
  }, [user]);

  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
        <p className="text-sm text-gray-500">Mengarahkan ke halaman login...</p>
      </main>
    );
  }

  return (
    <Layout title="Dashboard" description="Ringkasan data sistem pencatatan dapur MBG">
      {/* Welcome Card */}
      <div className="mb-8 bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-8 text-white shadow-lg">
        <div>
          <p className="text-green-100 text-sm font-medium">Selamat datang kembali,</p>
          <h2 className="text-3xl font-bold mb-2">{user.nama}</h2>
          <p className="text-green-100">Anda login sebagai <span className="font-semibold">{user.email}</span></p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistik Data</h3>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm animate-pulse">
                <div className="h-10 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              icon={<span className="text-3xl text-blue-500"><FaUserCircle /></span>}
              label="Total User"
              value={stats.users + ' orang'}
              bgColor="bg-blue-50"
              iconBg="bg-blue-100"
            />
            <StatCard
              icon={<span className="text-3xl text-orange-500"><FaBoxesPacking /></span>}
              label="Bahan Baku"
              value={stats.bahanBaku + ' item'}
              bgColor="bg-orange-50"
              iconBg="bg-orange-100"
            />
            <StatCard
              icon={<span className="text-3xl text-purple-500"><GiKnifeFork /></span>}
              label="Resep"
              value={stats.resep + ' resep'}
              bgColor="bg-purple-50"
              iconBg="bg-purple-100"
            />
            <StatCard
              icon={<span className="text-3xl text-yellow-500"><GiCookingPot /></span>}
              label="Produksi"
              value={stats.produksi + ' sesi'}
              bgColor="bg-yellow-50"
              iconBg="bg-yellow-100"
            />
            <StatCard
              icon={<span className="text-3xl text-green-500"><TbTruckDelivery /></span>}
              label="Distribusi"
              value={stats.distribusi + ' distribusi'}
              bgColor="bg-green-50"
              iconBg="bg-green-100"
            />
          </div>
        )}
      </div>

      {/* Produksi Berlangsung & Menu Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow p-6 border border-yellow-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase text-yellow-600 tracking-wide">
                  Produksi Berlangsung
                </p>
                <p className="text-sm text-gray-600">
                  Sesi produksi yang masih aktif hari ini dan ke depan.
                </p>
              </div>
              <span className="text-2xl">🍳</span>
            </div>
            <p className="text-4xl font-bold text-gray-900 mb-1">{stats.produksiBerlangsung}</p>
            <p className="text-xs text-gray-500">
              Status <span className="font-semibold">Berlangsung</span> pada tabel produksi.
            </p>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow p-6 border border-purple-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase text-purple-600 tracking-wide">
                  Menu Terbaru
                </p>
                <p className="text-sm text-gray-600">
                  Tiga resep yang terakhir ditambahkan ke sistem.
                </p>
              </div>
              <span className="text-2xl">📋</span>
            </div>

            {latestMenus.length === 0 ? (
              <p className="text-sm text-gray-500">Belum ada resep yang terdaftar.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {latestMenus.map((row: any, idx) => (
                  <li key={String((row.id as string) ?? idx)} className="py-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {String(row.nama_menu ?? row.nama ?? 'Tanpa nama')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {row.jumlah_porsi ? `Acuan ${row.jumlah_porsi} porsi` : 'Jumlah porsi belum diatur'}
                      </p>
                    </div>
                    {row.estimasi_waktu_menit && (
                      <span className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                        ⏱ {String(row.estimasi_waktu_menit)} menit
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
