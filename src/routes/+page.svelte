<script lang="ts">
  import { onMount } from 'svelte'
  import { investmentService } from '$lib/supabase'
  
  let investments: any[] = []
  let loading = true
  let error: string | null = null
  let showAddForm = false
  let editingInvestment: any = null
  let showEditForm = false
  
  // Form data
  let formData = {
    amount: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    expected_return: '',
    current_received: '',
    status: 'active',
    notes: '',
    product_type: '',
    supplier: '',
    customer: '',
    profit_margin: ''
  }

  onMount(async () => {
    await loadInvestments()
  })

  async function loadInvestments() {
    try {
      loading = true
      investments = await investmentService.getInvestments()
      loading = false
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
      loading = false
    }
  }

  async function addInvestment() {
    try {
      if (!formData.amount || !formData.start_date) {
        error = 'กรุณากรอกจำนวนเงินและวันที่เริ่มต้น'
        return
      }

      const newInvestment = {
        amount: parseFloat(formData.amount),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        expected_return: formData.expected_return ? parseFloat(formData.expected_return) : null,
        current_received: formData.current_received ? parseFloat(formData.current_received) : 0,
        status: formData.status,
        notes: formData.notes,
        product_type: formData.product_type,
        supplier: formData.supplier,
        customer: formData.customer,
        profit_margin: formData.profit_margin ? parseFloat(formData.profit_margin) : null
      }
      
      const result = await investmentService.addInvestment(newInvestment)
      investments = [result, ...investments]
      
      resetForm()
      showAddForm = false
      error = null
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
    }
  }

  async function updateInvestment() {
    try {
      if (!formData.amount || !formData.start_date) {
        error = 'กรุณากรอกจำนวนเงินและวันที่เริ่มต้น'
        return
      }

      if (!editingInvestment) {
        error = 'ไม่พบข้อมูลการลงทุนที่จะแก้ไข'
        return
      }

      const updates = {
        amount: parseFloat(formData.amount),
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        expected_return: formData.expected_return ? parseFloat(formData.expected_return) : null,
        current_received: formData.current_received ? parseFloat(formData.current_received) : 0,
        status: formData.status,
        notes: formData.notes,
        product_type: formData.product_type,
        supplier: formData.supplier,
        customer: formData.customer,
        profit_margin: formData.profit_margin ? parseFloat(formData.profit_margin) : null
      }
      
      await investmentService.updateInvestment(editingInvestment.id, updates)
      await loadInvestments()
      
      resetForm()
      showEditForm = false
      editingInvestment = null
      error = null
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
    }
  }

  function startEdit(investment: any) {
    editingInvestment = investment
    formData = {
      amount: investment.amount.toString(),
      start_date: investment.start_date,
      end_date: investment.end_date || '',
      expected_return: investment.expected_return ? investment.expected_return.toString() : '',
      current_received: investment.current_received ? investment.current_received.toString() : '0',
      status: investment.status,
      notes: investment.notes || '',
      product_type: investment.product_type || '',
      supplier: investment.supplier || '',
      customer: investment.customer || '',
      profit_margin: investment.profit_margin ? investment.profit_margin.toString() : ''
    }
    showEditForm = true
    showAddForm = false
  }

  function cancelEdit() {
    showEditForm = false
    editingInvestment = null
    resetForm()
  }

  function resetForm() {
    formData = {
      amount: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      expected_return: '',
      current_received: '',
      status: 'active',
      notes: '',
      product_type: '',
      supplier: '',
      customer: '',
      profit_margin: ''
    }
  }

  async function quickUpdateReceived(investment: { current_received: any; id: any; }) {
    const newAmount = prompt(`เงินที่ได้รับแล้วปัจจุบัน: ${investment.current_received || 0} บาท\nใส่จำนวนเงินที่ได้รับเพิ่มเติม:`)
    if (newAmount && !isNaN(parseFloat(newAmount))) {
      try {
        const totalReceived = (investment.current_received || 0) + parseFloat(newAmount)
        await investmentService.updateInvestment(investment.id, { 
          current_received: totalReceived 
        })
        await loadInvestments()
      } catch (err) {
        error = err instanceof Error ? err.message : 'An error occurred'
      }
    }
  }

  async function updateInvestmentStatus(id: any, status: string) {
    try {
      await investmentService.updateInvestment(id, { status })
      await loadInvestments()
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
    }
  }

  async function deleteInvestment(id: any) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบการลงทุนนี้?')) {
      try {
        await investmentService.deleteInvestment(id)
        await loadInvestments()
      } catch (err) {
        error = err instanceof Error ? err.message : 'An error occurred'
      }
    }
  }

  function calculateROI(investment: { current_received: number; amount: number; }) {
    const received = investment.current_received || 0
    if (received === 0) return null
    const roi = ((received - investment.amount) / investment.amount) * 100
    return roi.toFixed(2)
  }

  function calculateExpectedROI(investment: { expected_return: number; amount: number; }) {
    if (!investment.expected_return) return null
    const roi = ((investment.expected_return - investment.amount) / investment.amount) * 100
    return roi.toFixed(2)
  }

  function calculateProgress(investment: { expected_return: number; current_received: number; }) {
    if (!investment.expected_return || !investment.current_received) return 0
    const progress = (investment.current_received / investment.expected_return) * 100
    return Math.min(progress, 100).toFixed(1)
  }

  function calculateDaysLeft(endDate: string | number | Date) {
    if (!endDate) return null
    const today = new Date()
    const end = new Date(endDate)
    const diffTime = end.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  function calculateDaysRunning(startDate: string | number | Date) {
    const today = new Date()
    const start = new Date(startDate)
    const diffTime = today.getTime() - start.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // ข้อมูลสรุป
  $: totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
  $: totalReceived = investments.reduce((sum, inv) => sum + (parseFloat(inv.current_received) || 0), 0)
  $: totalExpectedReturn = investments.reduce((sum, inv) => {
    const expectedReturn = inv.expected_return || 0
    return sum + parseFloat(expectedReturn)
  }, 0)
  $: totalProfit = totalReceived - totalInvested
  $: activeInvestments = investments.filter(inv => inv.status === 'active')
  $: completedInvestments = investments.filter(inv => inv.status === 'completed')
</script>

<div class="container">
  <h1>💰 Investment Tracker</h1>
  
  <!-- Summary Cards -->
  <div class="summary-grid">
    <div class="summary-card">
      <h3>เงินลงทุนรวม</h3>
      <p class="amount">{totalInvested.toLocaleString()} บาท</p>
    </div>
    <div class="summary-card">
      <h3>เงินที่ได้รับแล้ว</h3>
      <p class="amount received">{totalReceived.toLocaleString()} บาท</p>
    </div>
    <div class="summary-card">
      <h3>กำไร/ขาดทุนปัจจุบัน</h3>
      <p class="amount {totalProfit >= 0 ? 'profit' : 'loss'}">
        {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()} บาท
      </p>
    </div>
    <div class="summary-card">
      <h3>ผลตอบแทนคาดหวัง</h3>
      <p class="amount expected">{totalExpectedReturn.toLocaleString()} บาท</p>
    </div>
    <div class="summary-card">
      <h3>การลงทุนที่ดำเนินอยู่</h3>
      <p class="amount active">{activeInvestments.length} รอบ</p>
    </div>
    <div class="summary-card">
      <h3>การลงทุนที่เสร็จแล้ว</h3>
      <p class="amount completed">{completedInvestments.length} รอบ</p>
    </div>
  </div>

  {#if error}
    <p class="error">❌ {error}</p>
  {/if}

  <!-- Action Bar -->
  <div class="action-bar">
    <button class="btn-primary" on:click={() => {
      showAddForm = !showAddForm
      showEditForm = false
      editingInvestment = null
      if (showAddForm) resetForm()
    }}>
      {showAddForm ? 'ยกเลิก' : '+ เพิ่มการลงทุนใหม่'}
    </button>
  </div>

  <!-- Add/Edit Investment Form -->
  {#if showAddForm || showEditForm}
    <div class="form-container">
      <h3>{showEditForm ? 'แก้ไขการลงทุน' : 'เพิ่มการลงทุนใหม่'}</h3>
      
      <div class="form-grid">
        <div class="form-group">
          <label for="amount">จำนวนเงินลงทุน (บาท) *</label>
          <input type="number" id="amount" bind:value={formData.amount} placeholder="8000" />
        </div>
        
        <div class="form-group">
          <label for="start_date">วันที่เริ่มต้น *</label>
          <input type="date" id="start_date" bind:value={formData.start_date} />
        </div>
        
        <div class="form-group">
          <label for="end_date">วันที่คาดว่าจะจบ</label>
          <input type="date" id="end_date" bind:value={formData.end_date} />
        </div>
        
        <div class="form-group">
          <label for="expected_return">ผลตอบแทนที่คาดหวัง (บาท)</label>
          <input type="number" id="expected_return" bind:value={formData.expected_return} placeholder="9600" />
        </div>
        
        <div class="form-group">
          <label for="current_received">เงินที่ได้รับแล้ว (บาท)</label>
          <input type="number" id="current_received" bind:value={formData.current_received} placeholder="0" />
        </div>
        
        <div class="form-group">
          <label for="status">สถานะ</label>
          <select id="status" bind:value={formData.status}>
            <option value="active">กำลังดำเนินการ</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="product_type">ประเภทสินค้า</label>
          <input type="text" id="product_type" bind:value={formData.product_type} placeholder="เสื้อผ้า, อิเล็กทรอนิกส์, ของเล่น..." />
        </div>
        
        <div class="form-group">
          <label for="supplier">ซัพพลายเออร์/แหล่งซื้อ</label>
          <input type="text" id="supplier" bind:value={formData.supplier} placeholder="ชื่อร้าน, ผู้ผลิต..." />
        </div>
        
        <div class="form-group">
          <label for="customer">ลูกค้า/ช่องทางขาย</label>
          <input type="text" id="customer" bind:value={formData.customer} placeholder="Facebook, Shopee, ลูกค้าเก่า..." />
        </div>
        
        <div class="form-group">
          <label for="profit_margin">เปอร์เซ็นต์กำไรที่คาดหวัง (%)</label>
          <input type="number" id="profit_margin" bind:value={formData.profit_margin} placeholder="20" step="0.01" />
        </div>
        
        <div class="form-group full-width">
          <label for="notes">หมายเหตุ/รายละเอียด</label>
          <textarea id="notes" bind:value={formData.notes} placeholder="พรีออร์เดอร์ของใหม่, ข้อมูลเพิ่มเติม..."></textarea>
        </div>
      </div>
      
      <div class="form-actions">
        {#if showEditForm}
          <button class="btn-primary" on:click={updateInvestment}>บันทึกการแก้ไข</button>
          <button class="btn-secondary" on:click={cancelEdit}>ยกเลิก</button>
        {:else}
          <button class="btn-primary" on:click={addInvestment}>บันทึก</button>
          <button class="btn-secondary" on:click={() => {
            showAddForm = false
            resetForm()
          }}>ยกเลิก</button>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Investments List -->
  {#if loading}
    <p class="loading">กำลังโหลด...</p>
  {:else}
    <div class="investments">
      <h2>การลงทุนทั้งหมด ({investments.length})</h2>
      
      {#each investments as investment (investment.id)}
        <div class="investment-card {investment.status}">
          <div class="card-header">
            <h4>
              {investment.product_type || 'การลงทุน'} #{investment.id}
              {#if investment.supplier}
                <small>จาก {investment.supplier}</small>
              {/if}
            </h4>
            <div class="header-actions">
              <span class="status-badge {investment.status}">{
                investment.status === 'active' ? 'กำลังดำเนินการ' :
                investment.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'
              }</span>
            </div>
          </div>
          
          <!-- Progress Bar -->
          {#if investment.status === 'active' && investment.expected_return}
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" style="width: {calculateProgress(investment)}%"></div>
              </div>
              <span class="progress-text">
                ได้รับแล้ว {calculateProgress(investment)}% 
                ({(investment.current_received || 0).toLocaleString()}/{investment.expected_return.toLocaleString()} บาท)
              </span>
            </div>
          {/if}
          
          <div class="card-content">
            <div class="info-grid">
              <div>
                <strong>💰 เงินลงทุน:</strong> {parseFloat(investment.amount).toLocaleString()} บาท
              </div>
              <div>
                <strong>💵 ได้รับแล้ว:</strong> 
                <span class="received-amount">{(investment.current_received || 0).toLocaleString()} บาท</span>
                <button class="btn-mini" on:click={() => quickUpdateReceived(investment)}>+เพิ่ม</button>
              </div>
              <div>
                <strong>🎯 คาดหวัง:</strong> 
                {investment.expected_return ? parseFloat(investment.expected_return).toLocaleString() + ' บาท' : 'ไม่ระบุ'}
              </div>
              <div>
                <strong>📈 ROI ปัจจุบัน:</strong> 
                {#if calculateROI(investment)}
                  <span class="roi {parseFloat(calculateROI(investment) || '0') >= 0 ? 'positive' : 'negative'}">
                    {calculateROI(investment)}%
                  </span>
                {:else}
                  <span class="roi-na">ยังไม่มีข้อมูล</span>
                {/if}
              </div>
              <div>
                <strong>📅 วันที่เริ่ม:</strong> {investment.start_date}
              </div>
              <div>
                <strong>⏱️ ระยะเวลาที่ผ่านมา:</strong> {calculateDaysRunning(investment.start_date)} วัน
              </div>
              {#if investment.end_date}
                <div>
                  <strong>📅 วันที่สิ้นสุด:</strong> {investment.end_date}
                </div>
                {#if investment.status === 'active'}
                  <div>
                    <strong>⏰ เหลืออีก:</strong> 
                    <span class="{calculateDaysLeft(investment.end_date) !== null && calculateDaysLeft(investment.end_date)! < 0 ? 'overdue' : ''}">
                      {calculateDaysLeft(investment.end_date)} วัน
                    </span>
                  </div>
                {/if}
              {/if}
              {#if investment.customer}
                <div>
                  <strong>🛒 ช่องทางขาย:</strong> {investment.customer}
                </div>
              {/if}
              {#if investment.profit_margin}
                <div>
                  <strong>📊 กำไรคาดหวัง:</strong> {investment.profit_margin}%
                </div>
              {/if}
            </div>
            
            {#if investment.notes}
              <div class="notes">
                <strong>📝 หมายเหตุ:</strong> {investment.notes}
              </div>
            {/if}
          </div>
          
          <div class="card-actions">
            <button class="btn-info" on:click={() => startEdit(investment)}>
              ✏️ แก้ไข
            </button>
            
            {#if investment.status === 'active'}
              <button class="btn-success" on:click={() => updateInvestmentStatus(investment.id, 'completed')}>
                ✅ เสร็จสิ้น
              </button>
              <button class="btn-warning" on:click={() => updateInvestmentStatus(investment.id, 'cancelled')}>
                ❌ ยกเลิก
              </button>
            {:else if investment.status === 'completed' || investment.status === 'cancelled'}
              <button class="btn-secondary" on:click={() => updateInvestmentStatus(investment.id, 'active')}>
                🔄 เปิดใหม่
              </button>
            {/if}
            
            <button class="btn-danger" on:click={() => deleteInvestment(investment.id)}>
              🗑️ ลบ
            </button>
          </div>
        </div>
      {/each}
      
      {#if investments.length === 0}
        <div class="empty-state">
          <p>ยังไม่มีการลงทุน</p>
          <button class="btn-primary" on:click={() => {
            showAddForm = true
            resetForm()
          }}>
            เริ่มเพิ่มการลงทุนแรก
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  }
  
  h1 {
    text-align: center;
    color: #333;
    margin-bottom: 30px;
  }
  
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 30px;
  }
  
  .summary-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    border-radius: 12px;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  
  .summary-card h3 {
    margin: 0 0 10px 0;
    font-size: 13px;
    opacity: 0.9;
  }
  
  .amount {
    font-size: 20px;
    font-weight: bold;
    margin: 0;
  }
  
  .amount.received { color: #4CAF50; }
  .amount.expected { color: #FF9800; }
  .amount.profit { color: #8BC34A; }
  .amount.loss { color: #f44336; }
  .amount.active { color: #2196F3; }
  .amount.completed { color: #9C27B0; }
  
  .action-bar {
    margin-bottom: 20px;
  }
  
  .form-container {
    background: #f8f9fa;
    padding: 25px;
    border-radius: 12px;
    margin-bottom: 30px;
    border: 1px solid #e9ecef;
  }
  
  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 25px;
  }
  
  .form-group {
    display: flex;
    flex-direction: column;
  }
  
  .form-group.full-width {
    grid-column: 1 / -1;
  }
  
  .form-group label {
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
    font-size: 14px;
  }
  
  .form-group input,
  .form-group select,
  .form-group textarea {
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    transition: border-color 0.2s;
  }
  
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #007bff;
  }
  
  .form-group textarea {
    min-height: 100px;
    resize: vertical;
  }
  
  .form-actions {
    display: flex;
    gap: 15px;
  }
  
  .investment-card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 12px;
    padding: 25px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s;
  }
  
  .investment-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }
  
  .investment-card.active {
    border-left: 4px solid #4CAF50;
  }
  
  .investment-card.completed {
    border-left: 4px solid #2196F3;
  }
  
  .investment-card.cancelled {
    border-left: 4px solid #f44336;
    opacity: 0.7;
  }
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .card-header h4 {
    margin: 0;
    color: #333;
  }
  
  .card-header small {
    color: #666;
    font-weight: normal;
    font-size: 12px;
  }
  
  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .status-badge.active {
    background: #e8f5e8;
    color: #4CAF50;
  }
  
  .status-badge.completed {
    background: #e3f2fd;
    color: #2196F3;
  }
  
  .status-badge.cancelled {
    background: #ffebee;
    color: #f44336;
  }
  
  .progress-container {
    margin-bottom: 20px;
  }
  
  .progress-bar {
    width: 100%;
    height: 8px;
    background: #e9ecef;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #4CAF50, #8BC34A);
    transition: width 0.3s ease;
  }
  
  .progress-text {
    font-size: 12px;
    color: #666;
  }
  
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }
  
  .info-grid div {
    padding: 8px 0;
  }
  
  .received-amount {
    color: #4CAF50;
    font-weight: 600;
  }
  
  .roi.positive {
    color: #4CAF50;
    font-weight: bold;
  }
  
  .roi.negative {
    color: #f44336;
    font-weight: bold;
  }
  
  .roi-na {
    color: #999;
    font-style: italic;
  }
  
  .overdue {
    color: #f44336;
    font-weight: bold;
  }
  
  .notes {
    background: #f8f9fa;
    padding: 15px;
    border-radius: 6px;
    margin-top: 15px;
    border-left: 3px solid #007bff;
  }
  
  .card-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
  }
  
  /* Buttons */
  button {
    padding: 10px 16px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
    font-size: 14px;
  }
  
  .btn-mini {
    padding: 4px 8px;
    font-size: 11px;
    margin-left: 8px;
    background: #28a745;
    color: white;
  }
  
  .btn-mini:hover {
    background: #1e7e34;
  }
  
  .btn-primary {
    background: #007bff;
    color: white;
  }
  
  .btn-primary:hover {
    background: #0056b3;
  }
  
  .btn-secondary {
    background: #6c757d;
    color: white;
  }
  
  .btn-secondary:hover {
    background: #545b62;
  }
  
  .btn-info {
    background: #17a2b8;
    color: white;
  }
  
  .btn-info:hover {
    background: #117a8b;
  }
  
  .btn-success {
    background: #28a745;
    color: white;
  }
  
  .btn-success:hover {
    background: #1e7e34;
  }
  
  .btn-warning {
    background: #ffc107;
    color: #212529;
  }
  
  .btn-warning:hover {
    background: #e0a800;
  }
  
  .btn-danger {
    background: #dc3545;
    color: white;
  }
  
  .btn-danger:hover {
    background: #c82333;
  }
  
  .error {
    background: #f8d7da;
    color: #721c24;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 20px;
    border: 1px solid #f5c6cb;
  }
  
  .loading {
    text-align: center;
    color: #666;
    font-style: italic;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 15px;
    }
    
    .summary-grid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
    }
    
    .summary-card {
      padding: 15px;
    }
    
    .amount {
      font-size: 18px;
    }
    
    .form-container {
      padding: 20px;
    }
    
    .form-grid {
      grid-template-columns: 1fr;
      gap: 15px;
    }
    
    .info-grid {
      grid-template-columns: 1fr;
    }
    
    .card-actions {
      flex-direction: column;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .investment-card {
      padding: 20px;
    }
    
    .card-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    
    .progress-container {
      margin-bottom: 15px;
    }
  }
</style>