-- ============================================================================
-- FIXED KEUANGAN TRIGGERS - Run this to update your triggers
-- ============================================================================

-- Drop and recreate the produksi trigger function
DROP TRIGGER IF EXISTS trg_sesi_produksi_create_keuangan ON public.sesi_produksi;
DROP FUNCTION IF EXISTS public.fn_create_keuangan_produksi();

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

-- Recreate trigger for produksi
CREATE TRIGGER trg_sesi_produksi_create_keuangan 
AFTER UPDATE ON public.sesi_produksi 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_create_keuangan_produksi();

-- ============================================================================
-- Test Query - Check if keuangan entries exist
-- ============================================================================
-- Run these to debug:
-- SELECT * FROM keuangan ORDER BY created_at DESC LIMIT 10;
-- SELECT id, resep_id, status FROM sesi_produksi WHERE status::text = 'Selesai' ORDER BY created_at DESC LIMIT 5;
-- SELECT COUNT(*) as keuangan_count FROM keuangan;

-- If triggers still don't work, check penggunaan_bahan data:
-- SELECT * FROM penggunaan_bahan LIMIT 5;
-- SELECT COUNT(*) FROM penggunaan_bahan;
