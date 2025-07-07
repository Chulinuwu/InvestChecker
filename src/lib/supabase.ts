// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// Helper functions
export const investmentService = {
  // ดึงข้อมูลการลงทุนทั้งหมด
  async getInvestments() {
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    return data
  },

  // เพิ่มการลงทุนใหม่
  async addInvestment(investment: any) {
    const { data, error } = await supabase
      .from('investments')
      .insert([investment])
      .select()
    
    if (error) throw error
    return data[0]
  },

  // อัพเดทการลงทุน
  async updateInvestment(id: any, updates: any) {
    const { data, error } = await supabase
      .from('investments')
      .update(updates)
      .eq('id', id)
      .select()
    
    if (error) throw error
    return data[0]
  },

  // ลบการลงทุน
  async deleteInvestment(id: any) {
    const { error } = await supabase
      .from('investments')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }
}

export const transactionService = {
  // ดึงข้อมูล transactions
  async getTransactions(investmentId = null) {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
    
    if (investmentId) {
      query = query.eq('investment_id', investmentId)
    }
    
    const { data, error } = await query
    if (error) throw error
    return data
  },

  // เพิ่ม transaction
  async addTransaction(transaction: any) {
    const { data, error } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
    
    if (error) throw error
    return data[0]
  }
}

export const settingsService = {
  // ดึงการตั้งค่า
  async getSettings() {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .limit(1)
    
    if (error) throw error
    return data[0]
  },

  // อัพเดทการตั้งค่า
  async updateSettings(updates: any) {
    const { data, error } = await supabase
      .from('settings')
      .update(updates)
      .eq('id', 1)
      .select()
    
    if (error) throw error
    return data[0]
  }
}