<script lang="ts">
  import { onMount } from 'svelte'
  import { investmentService } from '$lib/supabase'
  
  let investments: any[] = []
  let loading = true
  let error: string | null = null
  let showAddForm = false
  let editingInvestment: any = null
  let showEditModal = false
  let editModalInvestment: any = null
  let showCharts = false
  let showReceivedModal = false
  let modalInvestment: any = null
  let receivedAmount = ''
  
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
      console.log('Loaded investments:', investments) // Debug log
      loading = false
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
      console.error('Error loading investments:', err) // Debug log
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
      showEditModal = false
      editingInvestment = null
      editModalInvestment = null
      error = null
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
    }
  }

  function startEdit(investment: any) {
    editModalInvestment = investment
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
    showEditModal = true
    showAddForm = false
  }

  function closeEditModal() {
    showEditModal = false
    editModalInvestment = null
    editingInvestment = null
    resetForm()
  }

  function cancelEdit() {
    closeEditModal()
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
    modalInvestment = investment
    receivedAmount = ''
    showReceivedModal = true
  }

  async function updateReceivedAmount() {
    if (!receivedAmount || isNaN(parseFloat(receivedAmount))) {
      error = 'กรุณาใส่จำนวนเงินที่ถูกต้อง'
      return
    }

    try {
      const totalReceived = (modalInvestment.current_received || 0) + parseFloat(receivedAmount)
      await investmentService.updateInvestment(modalInvestment.id, { 
        current_received: totalReceived 
      })
      await loadInvestments()
      closeReceivedModal()
      error = null
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred'
    }
  }

  function closeReceivedModal() {
    showReceivedModal = false
    modalInvestment = null
    receivedAmount = ''
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

  async function addSampleData() {
    try {
      const sampleInvestments = [
        {
          amount: 10000,
          start_date: '2024-11-01',
          end_date: '2024-12-01',
          expected_return: 12000,
          current_received: 8000,
          status: 'active',
          notes: 'การลงทุนตัวอย่าง 1',
          product_type: 'เสื้อผ้า',
          supplier: 'ซัพพลายเออร์ A',
          customer: 'Facebook',
          profit_margin: 20
        },
        {
          amount: 15000,
          start_date: '2024-10-15',
          end_date: '2024-11-15',
          expected_return: 18000,
          current_received: 18500,
          status: 'completed',
          notes: 'การลงทุนตัวอย่าง 2',
          product_type: 'อิเล็กทรอนิกส์',
          supplier: 'ซัพพลายเออร์ B',
          customer: 'Shopee',
          profit_margin: 25
        },
        {
          amount: 8000,
          start_date: '2024-12-01',
          end_date: '2025-01-01',
          expected_return: 9500,
          current_received: 5000,
          status: 'active',
          notes: 'การลงทุนตัวอย่าง 3',
          product_type: 'ของเล่น',
          supplier: 'ซัพพลายเออร์ C',
          customer: 'Lazada',
          profit_margin: 18
        }
      ]

      for (const sample of sampleInvestments) {
        await investmentService.addInvestment(sample)
      }
      
      await loadInvestments()
      error = null
      console.log('Sample data added successfully')
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred while adding sample data'
      console.error('Error adding sample data:', err)
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
  $: overallROI = totalInvested > 0 ? ((totalReceived - totalInvested) / totalInvested) * 100 : 0
  
  // ข้อมูลสำหรับกราฟ
  $: chartData = {
    monthly: getMonthlyData(),
    roiComparison: getROIComparisonData(),
    statusDistribution: getStatusDistributionData(),
    productTypeData: getProductTypeData()
  }

  function getMonthlyData() {
    console.log('Getting monthly data from investments:', investments) // Debug log
    const monthlyStats: Record<string, { invested: number; received: number; count: number }> = {}
    investments.forEach(inv => {
      const month = inv.start_date.substring(0, 7) // YYYY-MM
      if (!monthlyStats[month]) {
        monthlyStats[month] = { invested: 0, received: 0, count: 0 }
      }
      monthlyStats[month].invested += parseFloat(inv.amount)
      monthlyStats[month].received += parseFloat(inv.current_received || 0)
      monthlyStats[month].count += 1
    })
    const result = Object.entries(monthlyStats).sort().slice(-6) // 6 เดือนล่าสุด
    console.log('Monthly data result:', result) // Debug log
    return result
  }

  function getROIComparisonData() {
    const result = investments
      .filter(inv => inv.current_received > 0)
      .map(inv => ({
        id: inv.id,
        name: inv.product_type || `การลงทุน #${inv.id}`,
        roi: ((parseFloat(inv.current_received) - parseFloat(inv.amount)) / parseFloat(inv.amount)) * 100,
        amount: parseFloat(inv.amount)
      }))
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 5) // Top 5
    console.log('ROI comparison data:', result) // Debug log
    return result
  }

  function getStatusDistributionData() {
    const statusCount: Record<string, number> = { active: 0, completed: 0, cancelled: 0 }
    investments.forEach(inv => {
      if (statusCount[inv.status] !== undefined) {
        statusCount[inv.status] = (statusCount[inv.status] || 0) + 1
      }
    })
    console.log('Status distribution:', statusCount) // Debug log
    return statusCount
  }

  function getProductTypeData() {
    const typeStats: Record<string, { count: number; totalAmount: number; totalReceived: number }> = {}
    investments.forEach(inv => {
      const type = inv.product_type || 'อื่นๆ'
      if (!typeStats[type]) {
        typeStats[type] = { count: 0, totalAmount: 0, totalReceived: 0 }
      }
      typeStats[type].count += 1
      typeStats[type].totalAmount += parseFloat(inv.amount)
      typeStats[type].totalReceived += parseFloat(inv.current_received || 0)
    })
    const result = Object.entries(typeStats)
      .map(([type, data]) => ({
        type,
        count: data.count,
        amount: data.totalAmount,
        received: data.totalReceived,
        roi: data.totalAmount > 0 ? ((data.totalReceived - data.totalAmount) / data.totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)
    console.log('Product type data:', result) // Debug log
    return result
  }
</script>

<div class="min-h-screen bg-gray-50 font-sans text-gray-800">
  <header class="bg-gradient-to-r from-pink-300 to-pink-500 text-white py-8 text-center shadow-xl">
    <div class="max-w-6xl mx-auto px-4">
      <h1 class="text-4xl font-bold mb-2">Twenty Toys</h1>
      <p class="opacity-90 text-lg">Track your investment </p>
    </div>
  </header>

  <main class="py-8">
    <div class="max-w-6xl mx-auto px-4">
      <!-- Summary Cards -->
      <section class="mb-12">
        <h2 class="text-2xl font-semibold text-gray-800 mb-6 flex items-center gap-2">📊 Overview</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div class="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-2xl">💰</div>
            <div class="flex-1">
              <h3 class="text-sm text-gray-600 font-medium mb-1">เงินลงทุนรวม</h3>
              <p class="text-2xl font-bold text-gray-800">{totalInvested.toLocaleString()}</p>
              <span class="text-sm text-gray-500">บาท</span>
            </div>
          </div>
          
          <div class="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-2xl">💵</div>
            <div class="flex-1">
              <h3 class="text-sm text-gray-600 font-medium mb-1">เงินที่ได้รับแล้ว</h3>
              <p class="text-2xl font-bold text-green-600">{totalReceived.toLocaleString()}</p>
              <span class="text-sm text-gray-500">บาท</span>
            </div>
          </div>
          
          <div class="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-2xl">{totalProfit >= 0 ? '📈' : '📉'}</div>
            <div class="flex-1">
              <h3 class="text-sm text-gray-600 font-medium mb-1">กำไร/ขาดทุน</h3>
              <p class="text-2xl font-bold {totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}">
                {totalProfit >= 0 ? '+' : ''}{totalProfit.toLocaleString()}
              </p>
              <span class="text-sm text-gray-500">บาท</span>
            </div>
          </div>
          
          <div class="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-2xl">🎯</div>
            <div class="flex-1">
              <h3 class="text-sm text-gray-600 font-medium mb-1">ROI รวม</h3>
              <p class="text-2xl font-bold {overallROI >= 0 ? 'text-green-600' : 'text-red-600'}">
                {overallROI >= 0 ? '+' : ''}{overallROI.toFixed(1)}
              </p>
              <span class="text-sm text-gray-500">%</span>
          </div>
          </div>
          
          <div class="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-2xl">🔄</div>
            <div class="flex-1">
              <h3 class="text-sm text-gray-600 font-medium mb-1">กำลังดำเนินการ</h3>
              <p class="text-2xl font-bold text-pink-600">{activeInvestments.length}</p>
              <span class="text-sm text-gray-500">รอบ</span>
            </div>
          </div>
          
          <div class="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div class="w-12 h-12 bg-pink-100 rounded-lg flex items-center justify-center text-2xl">✅</div>
            <div class="flex-1">
              <h3 class="text-sm text-gray-600 font-medium mb-1">เสร็จสิ้นแล้ว</h3>
              <p class="text-2xl font-bold text-green-600">{completedInvestments.length}</p>
              <span class="text-sm text-gray-500">รอบ</span>
            </div>
          </div>
        </div>
      </section>

      {#if error}
        <div class="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2 mb-6">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      {/if}

      <!-- Action Bar -->
      <section class="mb-12">
        <div class="flex flex-wrap gap-4">
          <button class="inline-flex items-center gap-2 px-6 py-3 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-600 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200" on:click={() => {
            showAddForm = !showAddForm
            showEditModal = false
            editingInvestment = null
            editModalInvestment = null
            if (showAddForm) resetForm()
          }}>
            <span>{showAddForm ? '❌' : '➕'}</span>
            {showAddForm ? 'ยกเลิก' : 'เพิ่มการลงทุนใหม่'}
          </button>
          
          <button class="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200" on:click={() => showCharts = !showCharts}>
            <span>📊</span>
            {showCharts ? 'ซ่อนกราฟ' : 'แสดงกราฟ'}
          </button>
          
          <button class="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200" on:click={addSampleData}>
            <span>🧪</span>
            เพิ่มข้อมูลตัวอย่าง
          </button>
        </div>
      </section>

      <!-- Charts Section -->
      {#if showCharts}
        <section class="charts-section">
          <h2 class="section-title">📈 กราฟและสถิติ</h2>
          
          <!-- Debug Info -->
          <div class="debug-info" style="background: #f0f0f0; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.75rem;">
            <p>Investments count: {investments.length}</p>
            <p>Chart data available: {JSON.stringify(Object.keys(chartData))}</p>
            <p>ROI comparison items: {chartData.roiComparison.length}</p>
            <p>Monthly data items: {chartData.monthly.length}</p>
            <p>Product types: {chartData.productTypeData.length}</p>
          </div>
          
          <div class="charts-grid">
            <!-- ROI Comparison Chart -->
            <div class="chart-card">
              <h3 class="chart-title">🏆 TOP 5 การลงทุนที่ให้ผลตอบแทนดีที่สุด</h3>
              <div class="chart-content">
                {#each chartData.roiComparison as item, index}
                  <div class="roi-bar">
                    <div class="roi-info">
                      <span class="roi-rank">#{index + 1}</span>
                      <span class="roi-name">{item.name}</span>
                      <span class="roi-value {item.roi >= 0 ? 'positive' : 'negative'}">
                        {item.roi.toFixed(1)}%
                      </span>
                    </div>
                    <div class="roi-bar-container">
                      <div 
                        class="roi-bar-fill {item.roi >= 0 ? 'positive' : 'negative'}" 
                        style="width: {Math.min(Math.abs(item.roi) * 2, 100)}%"
                      ></div>
                    </div>
                  </div>
                {/each}
                {#if chartData.roiComparison.length === 0}
                  <p class="no-data">ยังไม่มีข้อมูลผลตอบแทน</p>
                {/if}
              </div>
            </div>

            <!-- Status Distribution -->
            <div class="chart-card">
              <h3 class="chart-title">📊 สถานะการลงทุน</h3>
              <div class="chart-content">
                <div class="status-stats">
                  <div class="status-item">
                    <div class="status-indicator active"></div>
                    <span class="status-label">กำลังดำเนินการ</span>
                    <span class="status-count">{chartData.statusDistribution.active}</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator completed"></div>
                    <span class="status-label">เสร็จสิ้น</span>
                    <span class="status-count">{chartData.statusDistribution.completed}</span>
                  </div>
                  <div class="status-item">
                    <div class="status-indicator cancelled"></div>
                    <span class="status-label">ยกเลิก</span>
                    <span class="status-count">{chartData.statusDistribution.cancelled || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Monthly Investment Trend -->
            <div class="chart-card full-width">
              <h3 class="chart-title">📅 แนวโน้มการลงทุนรายเดือน (6 เดือนล่าสุด)</h3>
              <div class="chart-content">
                {#if chartData.monthly.length > 0}
                  <div class="monthly-chart">
                    {#each chartData.monthly as [month, data]}
                      <div class="monthly-item">
                        <div class="monthly-bars">
                          <div class="bar-container">
                            <div 
                              class="bar invested" 
                              style="height: {(data.invested / Math.max(...chartData.monthly.map(([,d]) => (d as any).invested))) * 100}%"
                              title="ลงทุน: {data.invested.toLocaleString()} บาท"
                            ></div>
                          </div>
                          <div class="bar-container">
                            <div 
                              class="bar received" 
                              style="height: {(data.received / Math.max(...chartData.monthly.map(([,d]) => (d as any).invested))) * 100}%"
                              title="ได้รับ: {data.received.toLocaleString()} บาท"
                            ></div>
                          </div>
                        </div>
                        <div class="monthly-label">{month}</div>
                        <div class="monthly-count">{data.count} รอบ</div>
                      </div>
                    {/each}
                  </div>
                  <div class="chart-legend">
                    <div class="legend-item">
                      <div class="legend-color invested"></div>
                      <span>เงินลงทุน</span>
                    </div>
                    <div class="legend-item">
                      <div class="legend-color received"></div>
                      <span>เงินที่ได้รับ</span>
                    </div>
                  </div>
                {:else}
                  <p class="no-data">ยังไม่มีข้อมูลรายเดือน</p>
                {/if}
              </div>
            </div>

            <!-- Product Type Analysis -->
            <div class="chart-card full-width">
              <h3 class="chart-title">🛍️ วิเคราะห์ตามประเภทสินค้า</h3>
              <div class="chart-content">
                {#if chartData.productTypeData.length > 0}
                  <div class="product-table">
                    <div class="table-header">
                      <div>ประเภทสินค้า</div>
                      <div>จำนวนรอบ</div>
                      <div>เงินลงทุน</div>
                      <div>เงินที่ได้รับ</div>
                      <div>ROI</div>
                    </div>
                    {#each chartData.productTypeData as item}
                      <div class="table-row">
                        <div class="product-name">{item.type}</div>
                        <div class="product-count">{item.count}</div>
                        <div class="product-amount">{item.amount.toLocaleString()}</div>
                        <div class="product-received">{item.received.toLocaleString()}</div>
                        <div class="product-roi {item.roi >= 0 ? 'positive' : 'negative'}">
                          {item.roi.toFixed(1)}%
                        </div>
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="no-data">ยังไม่มีข้อมูลประเภทสินค้า</p>
                {/if}
              </div>
            </div>
          </div>
        </section>
      {/if}

      <!-- Add Investment Form -->
      {#if showAddForm}
        <section class="p-6 bg-white rounded-lg shadow-lg border border-pink-200">
          <div class="space-y-6">
            <div class="text-center border-b border-pink-200 pb-4">
              <h3 class="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
                <span class="text-2xl">➕</span>
                เพิ่มการลงทุนใหม่
              </h3>
            </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-2">
          <label for="amount" class="block text-sm font-medium text-gray-700">จำนวนเงินลงทุน (บาท) *</label>
          <input type="number" id="amount" bind:value={formData.amount} placeholder="8000" 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="start_date" class="block text-sm font-medium text-gray-700">วันที่เริ่มต้น *</label>
          <input type="date" id="start_date" bind:value={formData.start_date} 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="end_date" class="block text-sm font-medium text-gray-700">วันที่คาดว่าจะจบ</label>
          <input type="date" id="end_date" bind:value={formData.end_date} 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="expected_return" class="block text-sm font-medium text-gray-700">ผลตอบแทนที่คาดหวัง (บาท)</label>
          <input type="number" id="expected_return" bind:value={formData.expected_return} placeholder="9600" 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="current_received" class="block text-sm font-medium text-gray-700">เงินที่ได้รับแล้ว (บาท)</label>
          <input type="number" id="current_received" bind:value={formData.current_received} placeholder="0" 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="status" class="block text-sm font-medium text-gray-700">สถานะ</label>
          <select id="status" bind:value={formData.status} 
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500">
            <option value="active">กำลังดำเนินการ</option>
            <option value="completed">เสร็จสิ้น</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
        
        <div class="space-y-2">
          <label for="product_type" class="block text-sm font-medium text-gray-700">ประเภทสินค้า</label>
          <input type="text" id="product_type" bind:value={formData.product_type} placeholder="เสื้อผ้า, อิเล็กทรอนิกส์, ของเล่น..." 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="supplier" class="block text-sm font-medium text-gray-700">ซัพพลายเออร์/แหล่งซื้อ</label>
          <input type="text" id="supplier" bind:value={formData.supplier} placeholder="ชื่อร้าน, ผู้ผลิต..." 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="customer" class="block text-sm font-medium text-gray-700">ลูกค้า/ช่องทางขาย</label>
          <input type="text" id="customer" bind:value={formData.customer} placeholder="Facebook, Shopee, ลูกค้าเก่า..." 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2">
          <label for="profit_margin" class="block text-sm font-medium text-gray-700">เปอร์เซ็นต์กำไรที่คาดหวัง (%)</label>
          <input type="number" id="profit_margin" bind:value={formData.profit_margin} placeholder="20" step="0.01" 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500" />
        </div>
        
        <div class="space-y-2 md:col-span-2">
          <label for="notes" class="block text-sm font-medium text-gray-700">หมายเหตุ/รายละเอียด</label>
          <textarea id="notes" bind:value={formData.notes} placeholder="พรีออร์เดอร์ของใหม่, ข้อมูลเพิ่มเติม..." 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 min-h-[80px]"></textarea>
        </div>
      </div>
            
            <div class="flex flex-col sm:flex-row gap-3 pt-4">
                <button class="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2" on:click={addInvestment}>
                  <span class="text-lg">💾</span>
                  บันทึก
                </button>
                <button class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2" on:click={() => {
                  showAddForm = false
                  resetForm()
                }}>
                  <span class="text-lg">❌</span>
                  ยกเลิก
                </button>
            </div>
          </div>
        </section>
      {/if}

      <!-- Received Amount Modal -->
      {#if showReceivedModal && modalInvestment}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" on:click={closeReceivedModal} role="dialog" aria-modal="true">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" on:click|stopPropagation role="document">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span class="text-2xl">💰</span>
                เพิ่มเงินที่ได้รับ
              </h3>
              <button class="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" on:click={closeReceivedModal}>
                <span>✕</span>
              </button>
            </div>
            
            <div class="p-6 space-y-6">
              <div class="bg-pink-50 p-4 rounded-lg border border-pink-200">
                <h4 class="font-semibold text-gray-800 mb-3">{modalInvestment.product_type || 'การลงทุน'} #{modalInvestment.id}</h4>
                <div class="space-y-2">
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">เงินลงทุน:</span>
                    <span class="font-medium text-gray-800">{parseFloat(modalInvestment.amount).toLocaleString()} บาท</span>
                  </div>
                  <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-600">ได้รับแล้ว:</span>
                    <span class="font-medium text-green-600">{(modalInvestment.current_received || 0).toLocaleString()} บาท</span>
                  </div>
                  {#if modalInvestment.expected_return}
                    <div class="flex justify-between items-center">
                      <span class="text-sm text-gray-600">เป้าหมาย:</span>
                      <span class="font-medium text-blue-600">{parseFloat(modalInvestment.expected_return).toLocaleString()} บาท</span>
                    </div>
                  {/if}
                </div>
              </div>

              <div class="space-y-4">
                <div class="space-y-2">
                  <label for="received-amount" class="block text-sm font-medium text-gray-700">จำนวนเงินที่ได้รับเพิ่มเติม (บาท)</label>
                  <!-- svelte-ignore a11y-autofocus -->
                  <input 
                    type="number" 
                    id="received-amount" 
                    bind:value={receivedAmount} 
                    placeholder="เช่น 2000" 
                    step="0.01"
                    min="0"
                    autofocus
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>
                
                {#if receivedAmount && !isNaN(parseFloat(receivedAmount))}
                  <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between items-center">
                        <span>ได้รับแล้ว:</span>
                        <span class="font-medium">{(modalInvestment.current_received || 0).toLocaleString()} บาท</span>
                      </div>
                      <div class="flex justify-between items-center text-green-600">
                        <span>+ เพิ่มเติม:</span>
                        <span class="font-medium">{parseFloat(receivedAmount).toLocaleString()} บาท</span>
                      </div>
                      <div class="flex justify-between items-center border-t border-gray-300 pt-2 font-semibold text-lg">
                        <span>= รวม:</span>
                        <span class="text-pink-600">{((modalInvestment.current_received || 0) + parseFloat(receivedAmount)).toLocaleString()} บาท</span>
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200">
              <button class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2" on:click={closeReceivedModal}>
                <span class="text-lg">❌</span>
                ยกเลิก
              </button>
              <button 
                class="flex-1 bg-pink-500 hover:bg-pink-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2" 
                on:click={updateReceivedAmount}
                disabled={!receivedAmount || isNaN(parseFloat(receivedAmount)) || parseFloat(receivedAmount) <= 0}
              >
                <span class="text-lg">💾</span>
                บันทึก
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Edit Investment Modal -->
      {#if showEditModal && editModalInvestment}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" on:click={closeEditModal} role="dialog" aria-modal="true">
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" on:click|stopPropagation role="document">
            <div class="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span class="text-2xl">✏️</span>
                แก้ไขการลงทุน
              </h3>
              <button class="text-gray-400 hover:text-gray-600 text-2xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" on:click={closeEditModal}>×</button>
            </div>
            
            <div class="p-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="edit-amount" class="block text-sm font-medium text-gray-700">จำนวนเงินลงทุน (บาท) *</label>
                  <input 
                    id="edit-amount" 
                    type="number" 
                    bind:value={formData.amount} 
                    required 
                    min="1"
                    placeholder="เช่น 10000"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-start-date" class="block text-sm font-medium text-gray-700">วันที่เริ่มลงทุน *</label>
                  <input 
                    id="edit-start-date" 
                    type="date" 
                    bind:value={formData.start_date} 
                    required 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-end-date" class="block text-sm font-medium text-gray-700">วันที่คาดหวังคืนทุน</label>
                  <input 
                    id="edit-end-date" 
                    type="date" 
                    bind:value={formData.end_date} 
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-expected-return" class="block text-sm font-medium text-gray-700">ผลตอบแทนที่คาดหวัง (บาท)</label>
                  <input 
                    id="edit-expected-return" 
                    type="number" 
                    bind:value={formData.expected_return} 
                    min="0"
                    placeholder="เช่น 12000"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-current-received" class="block text-sm font-medium text-gray-700">เงินที่ได้รับแล้ว (บาท)</label>
                  <input 
                    id="edit-current-received" 
                    type="number" 
                    bind:value={formData.current_received} 
                    min="0"
                    placeholder="เช่น 5000"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-status" class="block text-sm font-medium text-gray-700">สถานะ</label>
                  <select id="edit-status" bind:value={formData.status} class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500">
                    <option value="active">กำลังดำเนินการ</option>
                    <option value="completed">เสร็จสิ้น</option>
                    <option value="cancelled">ยกเลิก</option>
                  </select>
                </div>

                <div class="space-y-2">
                  <label for="edit-product-type" class="block text-sm font-medium text-gray-700">ประเภทสินค้า</label>
                  <input 
                    id="edit-product-type" 
                    type="text" 
                    bind:value={formData.product_type} 
                    placeholder="เช่น เสื้อผ้า, อิเล็กทรอนิกส์"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-supplier" class="block text-sm font-medium text-gray-700">ซัพพลายเออร์</label>
                  <input 
                    id="edit-supplier" 
                    type="text" 
                    bind:value={formData.supplier} 
                    placeholder="เช่น บริษัท ABC"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-customer" class="block text-sm font-medium text-gray-700">ลูกค้า/แพลตฟอร์ม</label>
                  <input 
                    id="edit-customer" 
                    type="text" 
                    bind:value={formData.customer} 
                    placeholder="เช่น Facebook, Shopee, Lazada"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2">
                  <label for="edit-profit-margin" class="block text-sm font-medium text-gray-700">กำไรต่อหน่วย (%)</label>
                  <input 
                    id="edit-profit-margin" 
                    type="number" 
                    bind:value={formData.profit_margin} 
                    min="0"
                    step="0.01"
                    placeholder="เช่น 15.5"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                <div class="space-y-2 md:col-span-2">
                  <label for="edit-notes" class="block text-sm font-medium text-gray-700">หมายเหตุ</label>
                  <textarea 
                    id="edit-notes" 
                    bind:value={formData.notes} 
                    placeholder="พรีออร์เดอร์ของใหม่, ข้อมูลเพิ่มเติม..."
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 min-h-[80px]"
                  ></textarea>
                </div>
              </div>
            </div>
            
            <div class="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200">
              <button class="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2" on:click={closeEditModal}>
                <span class="text-lg">❌</span>
                ยกเลิก
              </button>
              <button class="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center justify-center gap-2" on:click={updateInvestment}>
                <span class="text-lg">💾</span>
                บันทึกการแก้ไข
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Investments List -->
      {#if loading}
        <section class="flex flex-col items-center justify-center py-12 bg-white rounded-lg shadow-lg border border-pink-200">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
          <p class="mt-4 text-gray-600 font-medium">กำลังโหลดข้อมูล...</p>
        </section>
      {:else}
        <section class="space-y-6">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span class="text-2xl">📋</span>
              การลงทุนทั้งหมด ({investments.length})
            </h2>
          </div>
          
          {#each investments as investment (investment.id)}
            <div class="bg-white rounded-lg shadow-lg border border-pink-200 p-6 {investment.status === 'active' ? 'border-l-4 border-l-green-500' : investment.status === 'completed' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-gray-400'}">
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                <div class="mb-2 lg:mb-0">
                  <h4 class="text-lg font-semibold text-gray-800">
                    {investment.product_type || 'การลงทุน'} #{investment.id}
                    {#if investment.supplier}
                      <small class="text-sm text-gray-500 font-normal">จาก {investment.supplier}</small>
                    {/if}
                  </h4>
                </div>
                <div>
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium {
                    investment.status === 'active' ? 'bg-green-100 text-green-800' :
                    investment.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
                    'bg-gray-100 text-gray-800'
                  }">{
                    investment.status === 'active' ? 'กำลังดำเนินการ' :
                    investment.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'
                  }</span>
                </div>
              </div>
              
              <!-- Progress Bar -->
              {#if investment.status === 'active' && investment.expected_return}
                <div class="mb-4">
                  <div class="w-full bg-gray-200 rounded-full h-3 mb-2">
                    <div class="bg-gradient-to-r from-pink-400 to-pink-600 h-3 rounded-full transition-all duration-300" style="width: {calculateProgress(investment)}%"></div>
                  </div>
                  <span class="text-sm text-gray-600">
                    ได้รับแล้ว {calculateProgress(investment)}% 
                    ({(investment.current_received || 0).toLocaleString()}/{investment.expected_return.toLocaleString()} บาท)
                  </span>
                </div>
              {/if}
              
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-2xl">💰</span>
                    <div>
                      <span class="block text-sm text-gray-600">เงินลงทุน</span>
                      <span class="font-semibold text-gray-800">{parseFloat(investment.amount).toLocaleString()} บาท</span>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-2xl">💵</span>
                    <div class="flex-1">
                      <span class="block text-sm text-gray-600">ได้รับแล้ว</span>
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-green-600">{(investment.current_received || 0).toLocaleString()} บาท</span>
                        <button class="bg-pink-500 hover:bg-pink-600 text-white text-xs px-2 py-1 rounded transition-colors" on:click={() => quickUpdateReceived(investment)}>+เพิ่ม</button>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-2xl">🎯</span>
                    <div>
                      <span class="block text-sm text-gray-600">เป้าหมาย</span>
                      <span class="font-semibold text-gray-800">
                        {investment.expected_return ? parseFloat(investment.expected_return).toLocaleString() + ' บาท' : 'ไม่ระบุ'}
                      </span>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-2xl">📈</span>
                    <div>
                      <span class="block text-sm text-gray-600">ROI ปัจจุบัน</span>
                      <span class="font-semibold">
                        {#if calculateROI(investment)}
                          <span class="{parseFloat(calculateROI(investment) || '0') >= 0 ? 'text-green-600' : 'text-red-600'}">
                            {calculateROI(investment)}%
                          </span>
                        {:else}
                          <span class="text-gray-500">ยังไม่มีข้อมูล</span>
                        {/if}
                      </span>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-2xl">📅</span>
                    <div>
                      <span class="block text-sm text-gray-600">วันที่เริ่ม</span>
                      <span class="font-semibold text-gray-800">{investment.start_date}</span>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span class="text-2xl">⏱️</span>
                    <div>
                      <span class="block text-sm text-gray-600">ระยะเวลาที่ผ่านมา</span>
                      <span class="font-semibold text-gray-800">{calculateDaysRunning(investment.start_date)} วัน</span>
                    </div>
                  </div>
                  
                  {#if investment.end_date}
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span class="text-2xl">🏁</span>
                      <div>
                        <span class="block text-sm text-gray-600">วันที่สิ้นสุด</span>
                        <span class="font-semibold text-gray-800">{investment.end_date}</span>
                      </div>
                    </div>
                    
                    {#if investment.status === 'active'}
                      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                        <span class="text-2xl">⏰</span>
                        <div>
                          <span class="block text-sm text-gray-600">เหลืออีก</span>
                          <span class="font-semibold {calculateDaysLeft(investment.end_date) !== null && calculateDaysLeft(investment.end_date)! < 0 ? 'text-red-600' : 'text-gray-800'}">
                            {calculateDaysLeft(investment.end_date)} วัน
                          </span>
                        </div>
                      </div>
                    {/if}
                  {/if}
                  
                  {#if investment.customer}
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span class="text-2xl">🛒</span>
                      <div>
                        <span class="block text-sm text-gray-600">ช่องทางขาย</span>
                        <span class="font-semibold text-gray-800">{investment.customer}</span>
                      </div>
                    </div>
                  {/if}
                  
                  {#if investment.profit_margin}
                    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <span class="text-2xl">📊</span>
                      <div>
                        <span class="block text-sm text-gray-600">กำไรคาดหวัง</span>
                        <span class="font-semibold text-gray-800">{investment.profit_margin}%</span>
                      </div>
                    </div>
                  {/if}
                </div>
                
                {#if investment.notes}
                  <div class="flex items-start gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <span class="text-2xl mt-1">📝</span>
                    <div>
                      <span class="block text-sm font-medium text-amber-800 mb-1">หมายเหตุ:</span>
                      <span class="text-amber-700">{investment.notes}</span>
                    </div>
                  </div>
                {/if}
              </div>
              
              <div class="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                <button class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2" on:click={() => startEdit(investment)}>
                  <span class="text-lg">✏️</span>
                  แก้ไข
                </button>
                
                {#if investment.status === 'active'}
                  <button class="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2" on:click={() => updateInvestmentStatus(investment.id, 'completed')}>
                    <span class="text-lg">✅</span>
                    เสร็จสิ้น
                  </button>
                  <button class="bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2" on:click={() => updateInvestmentStatus(investment.id, 'cancelled')}>
                    <span class="text-lg">❌</span>
                    ยกเลิก
                  </button>
                {:else if investment.status === 'completed' || investment.status === 'cancelled'}
                  <button class="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2" on:click={() => updateInvestmentStatus(investment.id, 'active')}>
                    <span class="text-lg">🔄</span>
                    เปิดใหม่
                  </button>
                {/if}
                
                <button class="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 flex items-center gap-2" on:click={() => deleteInvestment(investment.id)}>
                  <span class="text-lg">🗑️</span>
                  ลบ
                </button>
              </div>
            </div>
          {/each}
          
          {#if investments.length === 0}
            <div class="flex flex-col items-center justify-center py-16 bg-white rounded-lg shadow-lg border border-pink-200">
              <div class="text-6xl mb-4">💼</div>
              <h3 class="text-2xl font-bold text-gray-800 mb-2">ยังไม่มีการลงทุน</h3>
              <p class="text-gray-600 mb-6">เริ่มต้นติดตามการลงทุนของคุณวันนี้</p>
              <button class="bg-pink-500 hover:bg-pink-600 text-white font-medium py-3 px-6 rounded-md transition-colors duration-200 flex items-center gap-2" on:click={() => {
                showAddForm = true
                resetForm()
              }}>
                <span class="text-lg">➕</span>
                เพิ่มการลงทุนแรก
              </button>
            </div>
          {/if}
        </section>
      {/if}
    </div>
    
  </main>
    <header class="bg-gradient-to-r from-pink-300 to-pink-500 text-white py-16 text-center shadow-xl">
    <div class="max-w-6xl mx-auto px-4">
      <h1 class="text-2xl font-bold mb-2">This Website was made by Chulinxz, feel free to contact me anytime :D</h1>
      <p class="opacity-90 text-lg">© Chulinx Folio, All Right Reserved | Implemented by Svelte+Supabase</p>
    </div>
  </header>
</div>

