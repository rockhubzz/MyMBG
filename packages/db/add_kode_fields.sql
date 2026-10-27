-- ============================================================================
-- ADD HUMAN-READABLE CODES FOR PRODUKSI AND DISTRIBUSI
-- ============================================================================

-- Add kode_produksi column to sesi_produksi table
ALTER TABLE public.sesi_produksi 
ADD COLUMN IF NOT EXISTS kode_produksi VARCHAR(20) UNIQUE;

-- Add kode_distribusi column to distribusi table
ALTER TABLE public.distribusi 
ADD COLUMN IF NOT EXISTS kode_distribusi VARCHAR(20) UNIQUE;

-- Create function to generate next kode_produksi
CREATE OR REPLACE FUNCTION public.fn_generate_kode_produksi()
RETURNS VARCHAR AS $$
DECLARE
    v_counter INT;
    v_kode VARCHAR;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(kode_produksi, 4) AS INT)), 0) + 1
    INTO v_counter
    FROM sesi_produksi
    WHERE kode_produksi LIKE 'PR-%';
    
    -- Generate kode (PR-001, PR-002, etc.)
    v_kode := 'PR-' || LPAD(v_counter::TEXT, 3, '0');
    
    RETURN v_kode;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate next kode_distribusi
CREATE OR REPLACE FUNCTION public.fn_generate_kode_distribusi()
RETURNS VARCHAR AS $$
DECLARE
    v_counter INT;
    v_kode VARCHAR;
BEGIN
    -- Get the next sequence number
    SELECT COALESCE(MAX(CAST(SUBSTRING(kode_distribusi, 5) AS INT)), 0) + 1
    INTO v_counter
    FROM distribusi
    WHERE kode_distribusi LIKE 'DTB-%';
    
    -- Generate kode (DTB-001, DTB-002, etc.)
    v_kode := 'DTB-' || LPAD(v_counter::TEXT, 3, '0');
    
    RETURN v_kode;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate kode_produksi on insert
CREATE OR REPLACE FUNCTION public.fn_insert_produksi_kode()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kode_produksi IS NULL THEN
        NEW.kode_produksi := public.fn_generate_kode_produksi();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insert_produksi_kode ON public.sesi_produksi;
CREATE TRIGGER trg_insert_produksi_kode
BEFORE INSERT ON public.sesi_produksi
FOR EACH ROW
EXECUTE FUNCTION public.fn_insert_produksi_kode();

-- Create trigger to auto-generate kode_distribusi on insert
CREATE OR REPLACE FUNCTION public.fn_insert_distribusi_kode()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.kode_distribusi IS NULL THEN
        NEW.kode_distribusi := public.fn_generate_kode_distribusi();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insert_distribusi_kode ON public.distribusi;
CREATE TRIGGER trg_insert_distribusi_kode
BEFORE INSERT ON public.distribusi
FOR EACH ROW
EXECUTE FUNCTION public.fn_insert_distribusi_kode();

-- Generate codes for existing records that don't have them
UPDATE sesi_produksi
SET kode_produksi = 'PR-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE kode_produksi IS NULL;

UPDATE distribusi
SET kode_distribusi = 'DTB-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 3, '0')
WHERE kode_distribusi IS NULL;

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
