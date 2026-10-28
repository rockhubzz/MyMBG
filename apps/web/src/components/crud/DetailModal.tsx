'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { crudApi } from '@/lib/api/crud';
import { ColumnDefinition, EntityDefinition } from '@/types/crud';

interface DetailModalProps {
  /** Logical entity name, e.g. 'resep', 'bahan-baku' — used to load metadata and build links. */
  entity: string;
  /** Row data to display; when this goes null/falsy the parent is expected to unmount/close. */
  row: Record<string, unknown> | null;
  /** Called when the user closes the modal (overlay click, ✕, Escape). */
  onClose: () => void;
  /** Optional card title override. Defaults to a sensible name field from the row. */
  title?: string;
  /** Map column name -> display label. Defaults to a humanized column name. */
  columnAliases?: Record<string, string>;
  /** Optional per-page value formatter (dates, rupiah, FK labels...). */
  formatValue?: (row: Record<string, unknown>, col: ColumnDefinition) => string;
  /** Hide the Edit button (e.g. read-only pages like keuangan). */
  hideEdit?: boolean;
  /** Hide the link to the entity's full [id] detail page. */
  hideDetailLink?: boolean;
}

/** Columns that add no value in a detail card. */
const HIDDEN_DETAIL_COLUMNS = new Set(['password_hash', 'password']);

/** Cache entity metadata per session so reopening the modal is instant. */
const metaCache = new Map<string, EntityDefinition>();

/** First non-empty of these fields becomes the card title. */
const TITLE_FIELDS = [
  'kode_produksi',
  'kode_distribusi',
  'nama_bahan',
  'nama_menu',
  'nama_pengeluaran',
  'nama_penerima',
  'nama',
  'title',
  'email',
];

const humanize = (name: string): string =>
  name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatRupiah = (value: unknown): string => {
  const num = Number(value);
  if (value === null || value === undefined || isNaN(num)) return String(value ?? '-');
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

const formatDateLike = (value: unknown): string => {
  const s = String(value);
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const withTime = s.includes('T') && s.length > 10;
  return d.toLocaleString(
    'id-ID',
    withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }
  );
};

/** Default value formatting, mirroring the list tables. */
export function defaultFormatValue(row: Record<string, unknown>, col: ColumnDefinition): string {
  const value = row[col.name];
  const lower = col.name.toLowerCase();

  if (lower.includes('jumlah') && !lower.includes('porsi') && !lower.includes('digunakan')) {
    return formatRupiah(value);
  }
  if (lower.includes('harga') || lower.includes('biaya')) {
    return formatRupiah(value);
  }
  if (
    lower.includes('tanggal') ||
    lower.includes('waktu') ||
    lower.includes('created_at') ||
    lower.includes('updated_at')
  ) {
    return formatDateLike(value);
  }
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

export function DetailModal({
  entity,
  row,
  onClose,
  title,
  columnAliases = {},
  formatValue = defaultFormatValue,
  hideEdit = false,
  hideDetailLink = false,
}: DetailModalProps) {
  const [meta, setMeta] = useState<EntityDefinition | null>(metaCache.get(entity) ?? null);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Keep the latest onClose so the Escape handler never goes stale.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!row || metaCache.has(entity)) return;
    let cancelled = false;
    crudApi
      .getEntity(entity)
      .then((m) => {
        metaCache.set(entity, m);
        if (!cancelled) setMeta(m);
      })
      .catch(() => {
        if (!cancelled) setMetaError('Gagal memuat detail');
      });
    return () => {
      cancelled = true;
    };
  }, [entity, row]);

  // Close on Escape
  useEffect(() => {
    if (!row) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [row]);

  // Lock body scroll while open
  useEffect(() => {
    if (!row) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [row]);

  const columns = useMemo(() => {
    if (!meta) return [];
    return meta.columns.filter((c) => !HIDDEN_DETAIL_COLUMNS.has(c.name));
  }, [meta]);

  const idValue = row && meta ? String(row[meta.primaryKey] ?? '') : '';

  if (!row) return null;

  const resolvedTitle =
    title ??
    (TITLE_FIELDS.map((f) => row[f]).find((v) => v && String(v).length > 0) as string | undefined) ??
    humanize(entity);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onCloseRef.current}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 truncate">{resolvedTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Detail {humanize(entity)}</p>
          </div>
          <button
            onClick={onCloseRef.current}
            aria-label="Tutup"
            className="ml-4 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto grow">
          {metaError ? (
            <p className="text-sm text-red-600">{metaError}</p>
          ) : !meta ? (
            <div className="py-8 text-center text-sm text-gray-500">Memuat detail…</div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {columns.map((col) => (
                <div key={col.name} className="min-w-0">
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {columnAliases[col.name] || humanize(col.name)}
                  </dt>
                  <dd className="mt-0.5 text-sm text-gray-900 break-words">{formatValue(row, col)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 flex justify-end gap-2 shrink-0">
          {!hideDetailLink && idValue && (
            <Link
              href={`/${entity}/${idValue}`}
              onClick={onCloseRef.current}
              className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 transition"
            >
              Halaman Lengkap
            </Link>
          )}
          {!hideEdit && idValue && (
            <Link
              href={`/${entity}/${idValue}`}
              onClick={onCloseRef.current}
              className="px-4 py-2 rounded-lg border border-blue-300 bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition"
            >
              ✎ Edit
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
