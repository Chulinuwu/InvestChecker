

### 1. Install Dependencies

```bash
npm install
```

### 2. Config Environment Variables

Create  `.env` and add Supabase url and api key:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Set up Supabase

Create table below

#### Table investments
```sql
CREATE TABLE investments (
    id BIGSERIAL PRIMARY KEY,
    amount DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    expected_return DECIMAL(10,2),
    actual_return DECIMAL(10,2),
    current_received DECIMAL(10,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    notes TEXT,
    product_type VARCHAR(100),
    supplier VARCHAR(200),
    customer VARCHAR(200),
    profit_margin DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Table transactions
```sql
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    investment_id INTEGER REFERENCES investments(id),
    type VARCHAR(10) NOT NULL, -- 'in' or 'out'
    amount DECIMAL(10,2) NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Table settings
```sql
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    total_capital DECIMAL(10,2) DEFAULT 0,
    target_roi DECIMAL(5,2) DEFAULT 20,
    notification_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```


### 4. Config Row Level Security (RLS)


```sql
-- Enable RLS
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Create Policy (For dev only)
CREATE POLICY "Allow all operations" ON investments FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON settings FOR ALL USING (true);
```

### 5. Run project and do your own tracker

```bash
npm run dev
```

## Diagram (Thai)

### ตาราง investments
เก็บข้อมูลการลงทุนหลัก
- `id`: รหัสการลงทุน (Primary Key)
- `amount`: จำนวนเงินลงทุน
- `start_date`: วันที่เริ่มลงทุน
- `end_date`: วันที่สิ้นสุดการลงทุน
- `expected_return`: ผลตอบแทนที่คาดหวัง
- `actual_return`: ผลตอบแทนจริง
- `current_received`: จำนวนเงินที่ได้รับแล้ว
- `status`: สถานะการลงทุน (active, completed, cancelled)
- `notes`: หมายเหตุ
- `product_type`: ประเภทสินค้า
- `supplier`: ผู้จัดหา
- `customer`: ลูกค้า
- `profit_margin`: อัตรากำไร (%)

### ตาราง transactions
เก็บประวัติการเงินเข้า-ออก
- `id`: รหัสธุรกรรม (Primary Key)
- `investment_id`: รหัสการลงทุนที่เชื่อมโยง
- `type`: ประเภทธุรกรรม ('in' หรือ 'out')
- `amount`: จำนวนเงิน
- `transaction_date`: วันที่ทำธุรกรรม
- `description`: รายละเอียด

### ตาราง settings
เก็บการตั้งค่าระบบ
- `id`: รหัสการตั้งค่า (Primary Key)
- `total_capital`: เงินทุนรวม
- `target_roi`: เป้าหมายผลตอบแทน (%)
- `notification_enabled`: เปิด/ปิดการแจ้งเตือน

## Stack

- **Frontend**: SvelteKit
- **Backend**: Supabase
- **Database**: PostgreSQL (via Supabase)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## What we have here?

- จัดการข้อมูลการลงทุน
- ติดตามผลตอบแทน
- บันทึกธุรกรรมเงินเข้า-ออก
- ตั้งค่าระบบ
- แดชบอร์ดสรุปข้อมูล

