-- ترقية قاعدة البيانات v2: مهام، إشعارات، عقود، ربط المصروفات

CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  contractor_id INT NOT NULL,
  contract_type VARCHAR(50) NOT NULL DEFAULT 'quantity',
  title VARCHAR(255) NOT NULL,
  total_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  project_id INT,
  project_item_id INT,
  contractor_id INT,
  assignee_id INT NOT NULL,
  created_by_id INT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  start_date DATE,
  due_date DATE,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  source_ref VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  link VARCHAR(500),
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  email_sent TINYINT(1) NOT NULL DEFAULT 0,
  email_status VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE project_items ADD COLUMN IF NOT EXISTS item_code VARCHAR(50);
ALTER TABLE project_items ADD COLUMN IF NOT EXISTS executed_quantity DECIMAL(15,3) NOT NULL DEFAULT 0;

ALTER TABLE contract_items ADD COLUMN IF NOT EXISTS contract_id INT;
ALTER TABLE contract_items ADD COLUMN IF NOT EXISTS project_item_id INT;
ALTER TABLE contract_items ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) NOT NULL DEFAULT 'quantity';
ALTER TABLE contract_items ADD COLUMN IF NOT EXISTS company_unit_cost DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS contractor_id INT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS project_item_id INT;

ALTER TABLE extracts ADD COLUMN IF NOT EXISTS work_period_from DATE;
ALTER TABLE extracts ADD COLUMN IF NOT EXISTS work_period_to DATE;
