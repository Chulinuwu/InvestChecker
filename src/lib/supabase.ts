// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Helper functions
export const investmentService = {
	// ดึงข้อมูลการลงทุนทั้งหมด
	async getInvestments() {
		const { data, error } = await supabase
			.from('investments')
			.select('*')
			.order('start_date', { ascending: false });

		if (error) throw error;
		return data;
	},

	// เพิ่มการลงทุนใหม่
	async addInvestment(investment: any) {
		const { data, error } = await supabase.from('investments').insert([investment]).select();

		if (error) throw error;
		return data[0];
	},

	// อัพเดทการลงทุน
	async updateInvestment(id: any, updates: any) {
		const { data, error } = await supabase
			.from('investments')
			.update(updates)
			.eq('id', id)
			.select();

		if (error) throw error;
		return data[0];
	},

	// ลบการลงทุน
	async deleteInvestment(id: any) {
		const { error } = await supabase.from('investments').delete().eq('id', id);

		if (error) throw error;
	}
};

export const transactionService = {
	// ดึงข้อมูล transactions
	async getTransactions(investmentId = null) {
		let query = supabase
			.from('transactions')
			.select('*')
			.order('transaction_date', { ascending: false });

		if (investmentId) {
			query = query.eq('investment_id', investmentId);
		}

		const { data, error } = await query;
		if (error) throw error;
		return data;
	},

	// เพิ่ม transaction
	async addTransaction(transaction: any) {
		const { data, error } = await supabase.from('transactions').insert([transaction]).select();

		if (error) throw error;
		return data[0];
	}
};

export const settingsService = {
	// ดึงการตั้งค่า
	async getSettings() {
		const { data, error } = await supabase.from('settings').select('*').limit(1);

		if (error) throw error;
		return data[0];
	},

	// อัพเดทการตั้งค่า
	async updateSettings(updates: any) {
		const { data, error } = await supabase.from('settings').update(updates).eq('id', 1).select();

		if (error) throw error;
		return data[0];
	}
};

// Investment Log Service - สำหรับ audit trail
export const investmentLogService = {
	// ดึงข้อมูล logs ทั้งหมด
	async getLogs(investmentId: number | null = null) {
		let query = supabase
			.from('investment_logs')
			.select(
				`
        *,
        investments (
          id,
          product_type
        )
      `
			)
			.order('transaction_date', { ascending: false });

		if (investmentId) {
			query = query.eq('investment_id', investmentId);
		}

		const { data, error } = await query;
		if (error) throw error;
		return data;
	},

	// บันทึก log เมื่อสร้าง investment ใหม่ (เงินออก)
	async logInitialInvestment(investmentId: number, amount: number, notes: string = '') {
		const log = {
			investment_id: investmentId,
			amount: -Math.abs(amount), // เงินออก = ค่าลบ
			type: 'initial_investment',
			transaction_date: new Date().toISOString(),
			notes: notes || 'สร้างการลงทุนใหม่',
			balance_before: 0,
			balance_after: 0
		};

		const { data, error } = await supabase.from('investment_logs').insert([log]).select();

		if (error) throw error;
		return data[0];
	},

	// บันทึก log เมื่อมีเงินเข้า (deposit)
	async logDeposit(
		investmentId: number,
		amount: number,
		balanceBefore: number,
		notes: string = ''
	) {
		const log = {
			investment_id: investmentId,
			amount: Math.abs(amount), // เงินเข้า = ค่าบวก
			type: 'deposit',
			transaction_date: new Date().toISOString(),
			notes: notes || 'รับเงินคืน',
			balance_before: balanceBefore,
			balance_after: balanceBefore + Math.abs(amount)
		};

		const { data, error } = await supabase.from('investment_logs').insert([log]).select();

		if (error) throw error;
		return data[0];
	},

	// บันทึก log เมื่อมีเงินออก (withdrawal) - กรณีปรับลดยอด
	async logWithdrawal(
		investmentId: number,
		amount: number,
		balanceBefore: number,
		notes: string = ''
	) {
		const log = {
			investment_id: investmentId,
			amount: -Math.abs(amount), // เงินออก = ค่าลบ
			type: 'withdrawal',
			transaction_date: new Date().toISOString(),
			notes: notes || 'ปรับลดยอด',
			balance_before: balanceBefore,
			balance_after: balanceBefore - Math.abs(amount)
		};

		const { data, error } = await supabase.from('investment_logs').insert([log]).select();

		if (error) throw error;
		return data[0];
	},

	// ดึงสรุป logs
	async getLogsSummary() {
		const { data, error } = await supabase.from('investment_logs').select('*');

		if (error) throw error;

		const summary = {
			totalDeposits: 0,
			totalWithdrawals: 0,
			totalInitialInvestments: 0,
			transactionCount: data?.length || 0
		};

		data?.forEach((log) => {
			if (log.type === 'deposit') {
				summary.totalDeposits += Math.abs(log.amount);
			} else if (log.type === 'withdrawal') {
				summary.totalWithdrawals += Math.abs(log.amount);
			} else if (log.type === 'initial_investment') {
				summary.totalInitialInvestments += Math.abs(log.amount);
			}
		});

		return summary;
	}
};

export const lineUserService = {
	// ดึงข้อมูลสมาชิกทั้งหมด
	async getLineUsers() {
		const { data, error } = await supabase
			.from('line_users')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) throw error;
		return data;
	},

	// อัปเดตสถานะการยืนยัน
	async updateVerificationStatus(userLineId: string, status: string) {
		const { data, error } = await supabase
			.from('line_users')
			.update({ verification_status: status })
			.eq('user_line_id', userLineId)
			.select();

		if (error) throw error;
		return data[0];
	},

	// ลบสมาชิก
	async deleteLineUser(userLineId: string) {
		const { error } = await supabase.from('line_users').delete().eq('user_line_id', userLineId);

		if (error) throw error;
	}
};
