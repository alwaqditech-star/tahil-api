-- أعمدة إضافية للجداول الموجودة
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS manager_approved_by VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accountant_approved_by VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accountant_approved_at TIMESTAMP NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(500);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS supplier_id INT;

ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS issued_by_id INT;
ALTER TABLE petty_cash ADD COLUMN IF NOT EXISTS settled_by_id INT;
ALTER TABLE petty_cash MODIFY assigned_to_id INT NOT NULL;

ALTER TABLE extracts ADD COLUMN IF NOT EXISTS submitted_by_id INT;
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS manager_approved_by VARCHAR(255);
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS manager_approved_at TIMESTAMP NULL;
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS accountant_approved_by VARCHAR(255);
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS accountant_approved_at TIMESTAMP NULL;
