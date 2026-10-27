import { useState } from 'react';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/auth-store';
import { authApi } from '@/lib/api/auth';

const registerSchema = z
  .object({
    nama: z
      .string()
      .min(2, 'Nama minimal 2 karakter')
      .max(100, 'Nama maksimal 100 karakter'),
    email: z
      .string()
      .min(1, 'Email wajib diisi')
      .email('Format email tidak valid'),
    password: z
      .string()
      .min(8, 'Password minimal 8 karakter')
      .regex(/[A-Z]/, 'Harus mengandung huruf kapital')
      .regex(/[0-9]/, 'Harus mengandung angka'),
    confirmPassword: z.string().min(1, 'Konfirmasi password wajib diisi'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password tidak cocok',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ── Field wrapper ─────────────────────────────────────────────
function Field({
  id, label, error, children,
}: {
  id: string; label: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 8.25a.75.75 0 100 1.5.75.75 0 000-1.5z" clipRule="evenodd"/>
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Password input with show/hide ────────────────────────────
function PasswordInput({
  id, placeholder, registration, hasError,
}: {
  id: string;
  placeholder: string;
  registration: object;
  hasError: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75A4.5 4.5 0 007.5 6.75v3.75m-.75 0h10.5a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25H7.5a2.25 2.25 0 01-2.25-2.25v-6A2.25 2.25 0 017.5 10.5z" />
        </svg>
      </span>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        {...registration}
        className={`
          w-full pl-10 pr-11 py-2.5 rounded-lg border text-sm
          focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
          transition placeholder:text-gray-300
          ${hasError ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-300 bg-white text-gray-900'}
        `}
      />
      <button
        type="button"
        aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        onClick={() => setShow(!show)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition"
      >
        {show ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function RegisterPage() {
  const router   = useRouter();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [apiErr, setApiErr] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  const pw = watch('password', '');

  const onSubmit = async (data: RegisterFormData) => {
    setApiErr(null);
    try {
      const res = await authApi.register(data.nama, data.email, data.password);
      setAuth(res.token, res.user);
      Cookies.set('mbg-token', res.token, { expires: 1, sameSite: 'strict' });
      router.push('/dashboard');
    } catch (err: unknown) {
      setApiErr(err instanceof Error ? err.message : 'Terjadi kesalahan, coba lagi');
    }
  };

  // Password strength indicator
  const strength = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const strengthCount = strength.filter(Boolean).length;
  const strengthLabel = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat'][strengthCount];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strengthCount];

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4 py-10">
      <div className="w-full max-w-md">

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-green-700 to-emerald-600 px-8 py-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl font-bold">
                🍱
              </div>
              <div>
                <p className="text-green-200 text-xs font-medium tracking-widest uppercase">
                  Sistem Pencatatan
                </p>
                <h1 className="text-xl font-bold leading-tight">Dapur MBG</h1>
              </div>
            </div>
            <p className="text-green-100 text-sm mt-3">
              Buat akun baru untuk mulai mencatat produksi dapur.
            </p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-gray-800 font-semibold text-lg mb-6">Buat Akun</h2>

            {/* API Error */}
            {apiErr && (
              <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-5 text-sm">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-10.5a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V7.5zm.75 6a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd"/>
                </svg>
                <span>{apiErr}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">

              {/* Nama */}
              <Field id="nama" label="Nama Lengkap" error={errors.nama?.message}>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </span>
                  <input
                    id="nama"
                    type="text"
                    autoComplete="name"
                    placeholder="Siti Rahayu"
                    {...register('nama')}
                    className={`
                      w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                      transition placeholder:text-gray-300
                      ${errors.nama ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-300 bg-white text-gray-900'}
                    `}
                  />
                </div>
              </Field>

              {/* Email */}
              <Field id="email" label="Email" error={errors.email?.message}>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0l-9.75 6.75L2.25 6.75" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nama@dapur-mbg.id"
                    {...register('email')}
                    className={`
                      w-full pl-10 pr-4 py-2.5 rounded-lg border text-sm
                      focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                      transition placeholder:text-gray-300
                      ${errors.email ? 'border-red-400 bg-red-50 text-red-900' : 'border-gray-300 bg-white text-gray-900'}
                    `}
                  />
                </div>
              </Field>

              {/* Password */}
              <Field id="password" label="Password" error={errors.password?.message}>
                <PasswordInput
                  id="password"
                  placeholder="Min. 8 karakter"
                  registration={register('password')}
                  hasError={!!errors.password}
                />
                {/* Strength bar */}
                {pw.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i < strengthCount ? strengthColor : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 font-medium ${
                      strengthCount <= 1 ? 'text-red-500' :
                      strengthCount === 2 ? 'text-yellow-600' :
                      strengthCount === 3 ? 'text-blue-600' : 'text-green-600'
                    }`}>
                      {strengthLabel}
                    </p>
                  </div>
                )}
              </Field>

              {/* Confirm Password */}
              <Field id="confirmPassword" label="Konfirmasi Password" error={errors.confirmPassword?.message}>
                <PasswordInput
                  id="confirmPassword"
                  placeholder="Ulangi password"
                  registration={register('confirmPassword')}
                  hasError={!!errors.confirmPassword}
                />
              </Field>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="
                  w-full py-2.5 px-4 rounded-lg font-medium text-sm text-white
                  bg-green-700 hover:bg-green-800 active:bg-green-900
                  disabled:opacity-60 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-600
                  transition-colors flex items-center justify-center gap-2
                "
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Mendaftarkan…
                  </>
                ) : (
                  'Daftar Sekarang'
                )}
              </button>

              {/* Link ke login */}
              <p className="text-center text-sm text-gray-500 pt-1">
                Sudah punya akun?{' '}
                <a href="/login" className="text-green-600 font-medium hover:underline">
                  Masuk di sini
                </a>
              </p>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          &copy; {new Date().getFullYear()} Dapur MBG — Program Makan Bergizi Gratis
        </p>
      </div>
    </main>
  );
}