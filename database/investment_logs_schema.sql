-- SQL Schema สำหรับตาราง investment_logs
-- ใช้สร้างตารางใน Supabase SQL Editor

CREATE TABLE investment_logs (
  id BIGSERIAL PRIMARY KEY,
  investment_id BIGINT REFERENCES investments(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,  -- จำนวนเงิน (บวก = เข้า, ลบ = ออก)
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'initial_investment')),
  transaction_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  balance_before DECIMAL(12,2) DEFAULT 0,  -- ยอด current_received ก่อนทำรายการ
  balance_after DECIMAL(12,2) DEFAULT 0,   -- ยอด current_received หลังทำรายการ
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- สร้าง index สำหรับ query ที่เร็วขึ้น
CREATE INDEX idx_investment_logs_investment_id ON investment_logs(investment_id);
CREATE INDEX idx_investment_logs_transaction_date ON investment_logs(transaction_date);
CREATE INDEX idx_investment_logs_type ON investment_logs(type);

-- Enable Row Level Security (RLS) - optional
-- ALTER TABLE investment_logs ENABLE ROW LEVEL SECURITY;

-- Policy สำหรับอนุญาตทุกคน (ถ้าใช้ anon key)
-- CREATE POLICY "Allow all" ON investment_logs FOR ALL USING (true);

COMMENT ON TABLE investment_logs IS 'ตารางเก็บ log การเปลี่ยนแปลงเงินใน investments';
COMMENT ON COLUMN investment_logs.type IS 'ประเภทรายการ: initial_investment (สร้างใหม่), deposit (เงินเข้า), withdrawal (เงินออก)';
