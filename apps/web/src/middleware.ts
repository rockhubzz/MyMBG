import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Route yang butuh login
const PROTECTED = ['/dashboard', '/users', '/bahan-baku', '/resep', '/produksi', '/distribusi'];
// Route yang hanya boleh diakses saat belum login
const AUTH_ONLY = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Baca token dan role dari cookie (di-set saat login)
  const token = req.cookies.get('mbg-token')?.value;
  const role = req.cookies.get('mbg-role')?.value as 'Admin' | 'KepalaDapur' | 'Staff' | undefined;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage  = AUTH_ONLY.includes(pathname);

  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname); // simpan tujuan asal
    return NextResponse.redirect(url);
  }

  if (isAuthPage && token) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  // Role-based authorization untuk halaman yang dilindungi
  if (isProtected && token) {
    const effectiveRole: 'Admin' | 'KepalaDapur' | 'Staff' =
      role === 'Admin' || role === 'KepalaDapur' || role === 'Staff' ? role : 'Staff';

    const ROLE_ROUTES: Record<typeof effectiveRole, string[]> = {
      Admin: ['/dashboard', '/users', '/bahan-baku', '/resep', '/produksi', '/distribusi'],
      KepalaDapur: ['/dashboard', '/bahan-baku', '/resep', '/produksi', '/distribusi'],
      Staff: ['/dashboard', '/bahan-baku', '/produksi', '/distribusi'],
    };

    const allowed = ROLE_ROUTES[effectiveRole].some((prefix) => pathname.startsWith(prefix));
    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  // Jalankan middleware hanya pada path yang relevan
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/bahan-baku/:path*',
    '/resep/:path*',
    '/produksi/:path*',
    '/distribusi/:path*',
    '/login',
    '/register',
  ],
};