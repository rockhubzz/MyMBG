-- ============================================================================
-- COMPLETE KEUANGAN SETUP SCRIPT
-- Execute this script in your PostgreSQL database to set up automatic
-- expense tracking for produksi and distribusi
-- ============================================================================

-- Step 1: Add columns to distribusi table if they don't exist
ALTER TABLE public.distribusi 
ADD COLUMN IF NOT EXISTS status status_produksi DEFAULT 'Direncanakan' NOT NULL;

ALTER TABLE public.distribusi 
ADD COLUMN IF NOT EXISTS biaya_distribusi numeric(15,2) DEFAULT 0;

-- Step 2: Create keuangan table if it doesn't exist
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

-- Step 3: Drop existing triggers and functions if they exist
DROP TRIGGER IF EXISTS trg_sesi_produksi_create_keuangan ON public.sesi_produksi;
DROP TRIGGER IF EXISTS trg_distribusi_create_keuangan ON public.distribusi;
DROP TRIGGER IF EXISTS trg_distribusi_update_keuangan ON public.distribusi;
DROP FUNCTION IF EXISTS public.fn_create_keuangan_produksi();
DROP FUNCTION IF EXISTS public.fn_create_keuangan_distribusi();
DROP FUNCTION IF EXISTS public.fn_update_keuangan_distribusi();

-- Step 4: Create trigger function for produksi completion
CREATE OR REPLACE FUNCTION public.fn_create_keuangan_produksi()
RETURNS TRIGGER AS $$
DECLARE
    v_total_cost NUMERIC;
    v_resep_name VARCHAR;
    v_existing_count INT;
BEGIN
    -- Only trigger when status is 'Selesai'
    IF NEW.status::text = 'Selesai' THEN
        -- Check if we already created a keuangan entry for this sesi_produksi
        SELECT COUNT(*) INTO v_existing_count 
        FROM keuangan 
        WHERE sesi_produksi_id = NEW.id 
        AND tipe_pengeluaran = 'Produksi'
        LIMIT 1;
        
        -- Only create if it doesn't exist yet
        IF v_existing_count = 0 THEN
            -- Get recipe name
            SELECT nama_menu INTO v_resep_name FROM resep WHERE id = NEW.resep_id LIMIT 1;
            IF v_resep_name IS NULL THEN
                v_resep_name := 'Menu';
            END IF;
            
            -- Calculate total cost from penggunaan_bahan
            SELECT COALESCE(SUM(pb.jumlah_digunakan * bb.harga_satuan), 0)
            INTO v_total_cost
            FROM penggunaan_bahan pb
            JOIN bahan_baku bb ON bb.id = pb.bahan_baku_id
            WHERE pb.sesi_produksi_id = NEW.id;
            
            -- Create keuangan entry (even if cost is 0, to record the transaction)
            INSERT INTO keuangan (
                sesi_produksi_id,
                distribusi_id,
                nama_pengeluaran,
                jumlah_pengeluaran,
                tipe_pengeluaran,
                keterangan,
                created_by,
                created_at
            ) VALUES (
                NEW.id,
                NULL,
                'Produksi: ' || v_resep_name,
                v_total_cost,
                'Produksi',
                'Biaya bahan baku untuk produksi',
                NEW.created_by,
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger for produksi
CREATE TRIGGER trg_sesi_produksi_create_keuangan 
AFTER UPDATE ON public.sesi_produksi 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_create_keuangan_produksi();

-- Step 6: Create trigger function for distribusi
CREATE OR REPLACE FUNCTION public.fn_create_keuangan_distribusi()
RETURNS TRIGGER AS $$
DECLARE
    v_resep_name VARCHAR;
BEGIN
    -- Create keuangan entry if biaya_distribusi is set and > 0
    IF NEW.biaya_distribusi IS NOT NULL AND NEW.biaya_distribusi > 0 THEN
        -- Get recipe name from sesi_produksi
        SELECT r.nama_menu INTO v_resep_name 
        FROM sesi_produksi sp
        JOIN resep r ON r.id = sp.resep_id
        WHERE sp.id = NEW.sesi_produksi_id
        LIMIT 1;
        
        IF v_resep_name IS NULL THEN
            v_resep_name := 'Menu';
        END IF;
        
        -- Check if keuangan entry already exists for this distribusi
        IF NOT EXISTS (SELECT 1 FROM keuangan WHERE distribusi_id = NEW.id LIMIT 1) THEN
            INSERT INTO keuangan (
                sesi_produksi_id,
                distribusi_id,
                nama_pengeluaran,
                jumlah_pengeluaran,
                tipe_pengeluaran,
                keterangan,
                created_by,
                created_at
            ) VALUES (
                NEW.sesi_produksi_id,
                NEW.id,
                'Distribusi: ' || v_resep_name || ' ke ' || NEW.nama_penerima,
                NEW.biaya_distribusi,
                'Distribusi',
                'Biaya distribusi ke ' || NEW.nama_penerima,
                NEW.created_by,
                NOW()
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger for distribusi INSERT
CREATE TRIGGER trg_distribusi_create_keuangan 
AFTER INSERT ON public.distribusi 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_create_keuangan_distribusi();

-- Step 8: Create trigger for distribusi UPDATE (to handle biaya_distribusi changes)
CREATE TRIGGER trg_distribusi_update_keuangan 
AFTER UPDATE ON public.distribusi 
FOR EACH ROW 
WHEN (OLD.biaya_distribusi IS DISTINCT FROM NEW.biaya_distribusi)
EXECUTE FUNCTION public.fn_create_keuangan_distribusi();

-- Verification queries (uncomment to check)
-- SELECT COUNT(*) as keuangan_count FROM keuangan;
-- SELECT COUNT(*) as sesi_produksi_count FROM sesi_produksi WHERE status = 'Selesai';
-- SELECT * FROM keuangan ORDER BY created_at DESC LIMIT 10;
