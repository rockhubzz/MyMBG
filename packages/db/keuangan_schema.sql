
-- Add status and biaya_distribusi columns to distribusi table
ALTER TABLE public.distribusi ADD COLUMN IF NOT EXISTS status status_produksi DEFAULT 'Direncanakan' NOT NULL;
ALTER TABLE public.distribusi ADD COLUMN IF NOT EXISTS biaya_distribusi numeric(15,2) DEFAULT 0;

-- Create keuangan (finance/expenses log) table
CREATE TABLE IF NOT EXISTS public.keuangan (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    sesi_produksi_id uuid,
    distribusi_id uuid,
    nama_pengeluaran character varying(300) NOT NULL,
    jumlah_pengeluaran numeric(15,2) NOT NULL,
    tipe_pengeluaran character varying(50) NOT NULL,
    keterangan text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT keuangan_sesi_produksi_id_fkey FOREIGN KEY (sesi_produksi_id) REFERENCES public.sesi_produksi(id) ON DELETE SET NULL,
    CONSTRAINT keuangan_distribusi_id_fkey FOREIGN KEY (distribusi_id) REFERENCES public.distribusi(id) ON DELETE SET NULL,
    CONSTRAINT keuangan_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id)
);

-- Create trigger for automatic timestamp update on keuangan
CREATE OR REPLACE FUNCTION public.fn_update_keuangan_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.created_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to keuangan table
CREATE TRIGGER IF NOT EXISTS trg_keuangan_created_at 
BEFORE INSERT ON public.keuangan 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_update_keuangan_timestamp();

