-- دليل البنود المركزي
CREATE TABLE IF NOT EXISTS catalog_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(50) NOT NULL DEFAULT '',
  default_unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  default_estimated_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  category VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY catalog_items_code_idx (code)
);

ALTER TABLE project_items ADD COLUMN IF NOT EXISTS catalog_item_id INT;
ALTER TABLE contract_items ADD COLUMN IF NOT EXISTS catalog_item_id INT;
