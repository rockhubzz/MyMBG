-- Trigger: Automatically create keuangan entry when sesi_produksi status changes to 'Selesai'
CREATE OR REPLACE FUNCTION public.fn_create_keuangan_produksi()
RETURNS TRIGGER AS $$
DECLARE
    v_total_cost NUMERIC;
    v_resep_name VARCHAR;
    v_user_id UUID;
BEGIN
    -- Only trigger when status changes to 'Selesai'
    IF NEW.status = 'Selesai'::status_produksi AND (OLD.status IS NULL OR OLD.status != 'Selesai'::status_produksi) THEN
        -- Get recipe name
        SELECT nama_menu INTO v_resep_name FROM resep WHERE id = NEW.resep_id;
        
        -- Calculate total cost: sum of (jumlah_digunakan * harga_satuan) for all materials used
        SELECT COALESCE(SUM(pb.jumlah_digunakan * bb.harga_satuan), 0)
        INTO v_total_cost
        FROM penggunaan_bahan pb
        JOIN bahan_baku bb ON bb.id = pb.bahan_baku_id
        WHERE pb.sesi_produksi_id = NEW.id;
        
        -- Only create keuangan entry if there's a cost
        IF v_total_cost > 0 THEN
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
                'Produksi: ' || COALESCE(v_resep_name, 'Menu'),
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

-- Add trigger
CREATE TRIGGER IF NOT EXISTS trg_sesi_produksi_create_keuangan 
AFTER UPDATE ON public.sesi_produksi 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_create_keuangan_produksi();

-- Trigger: Create keuangan entry when distribusi record is created with biaya_distribusi
CREATE OR REPLACE FUNCTION public.fn_create_keuangan_distribusi()
RETURNS TRIGGER AS $$
DECLARE
    v_resep_name VARCHAR;
BEGIN
    -- Only create keuangan if biaya_distribusi is provided and > 0
    IF NEW.biaya_distribusi IS NOT NULL AND NEW.biaya_distribusi > 0 THEN
        -- Get recipe name from sesi_produksi
        SELECT r.nama_menu INTO v_resep_name 
        FROM sesi_produksi sp
        JOIN resep r ON r.id = sp.resep_id
        WHERE sp.id = NEW.sesi_produksi_id;
        
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
            'Distribusi: ' || COALESCE(v_resep_name, 'Menu') || ' ke ' || NEW.nama_penerima,
            NEW.biaya_distribusi,
            'Distribusi',
            'Biaya distribusi ke ' || NEW.nama_penerima,
            NEW.created_by,
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for distribusi
CREATE TRIGGER IF NOT EXISTS trg_distribusi_create_keuangan 
AFTER INSERT ON public.distribusi 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_create_keuangan_distribusi();

-- Also trigger on distribusi update if biaya_distribusi is changed
CREATE OR REPLACE FUNCTION public.fn_update_keuangan_distribusi()
RETURNS TRIGGER AS $$
BEGIN
    -- If biaya_distribusi was updated and is now > 0, and wasn't > 0 before
    IF (OLD.biaya_distribusi IS NULL OR OLD.biaya_distribusi = 0) 
       AND NEW.biaya_distribusi > 0 THEN
        -- Delete existing keuangan entry for this distribusi if any
        DELETE FROM keuangan WHERE distribusi_id = NEW.id LIMIT 1;
        
        -- Create new keuangan entry with updated biaya
        DECLARE
            v_resep_name VARCHAR;
        BEGIN
            SELECT r.nama_menu INTO v_resep_name 
            FROM sesi_produksi sp
            JOIN resep r ON r.id = sp.resep_id
            WHERE sp.id = NEW.sesi_produksi_id;
            
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
                'Distribusi: ' || COALESCE(v_resep_name, 'Menu') || ' ke ' || NEW.nama_penerima,
                NEW.biaya_distribusi,
                'Distribusi',
                'Biaya distribusi ke ' || NEW.nama_penerima,
                NEW.created_by,
                NOW()
            );
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trg_distribusi_update_keuangan 
AFTER UPDATE ON public.distribusi 
FOR EACH ROW 
EXECUTE FUNCTION public.fn_update_keuangan_distribusi();
