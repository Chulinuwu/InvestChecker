<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { investmentService, investmentLogService } from '$lib/supabase';

	// Login state
	let isAuthenticated = false;
	let loginUsername = '';
	let loginPassword = '';
	let loginError = '';

	let investments: any[] = [];
	let loading = true;
	let error: string | null = null;
	let showAddForm = false;
	let editingInvestment: any = null;
	let showEditModal = false;
	let editModalInvestment: any = null;
	let showCharts = false;
	let showReceivedModal = false;
	let modalInvestment: any = null;
	let receivedAmount = '';

	// Transaction History state
	let showTransactionHistory = false;
	let transactionLogs: any[] = [];
	let allTransactionLogs: any[] = [];
	let transactionLoading = false;
	let selectedInvestmentForLogs: number | null = null;
	let transactionViewMode: 'card' | 'table' = 'card'; // 'card' หรือ 'table'

	// Filter state
	let filterStatus = 'all';
	let searchQuery = '';

	// Period Summary state
	let periodViewMode = 'monthly'; // 'weekly' | 'monthly'
	let periodSortField = 'period'; // 'period' | 'invested' | 'received' | 'profit' | 'roi' | 'count'
	let periodSortDirection = 'desc'; // 'asc' | 'desc'
	let sortOrder = 'latest'; // 'latest' | 'oldest' | 'amount_high' | 'amount_low'
	let summaryType = 'investments'; // 'investments' | 'logs'


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
	};

	onMount(async () => {
		// Check if already logged in (from localStorage)
		const savedAuth = localStorage.getItem('isAuthenticated');
		const savedAdminAuth = localStorage.getItem('isAdminAuthenticated');

		if (savedAdminAuth === 'true') {
			goto('/backoffice');
			return;
		}

		if (savedAuth === 'true') {
			isAuthenticated = true;
			await loadInvestments();
		} else {
			loading = false;
		}
	});

	function handleLogin() {
		const validUsername = import.meta.env.VITE_LOGIN_USERNAME;
		const validPassword = import.meta.env.VITE_LOGIN_PASSWORD;

		// Admin / Backoffice User
		const adminUsername = import.meta.env.VITE_LOGIN_USERNAME_2;
		const adminPassword = import.meta.env.VITE_LOGIN_PASSWORD_2;

		if (loginUsername === adminUsername && loginPassword === adminPassword) {
			localStorage.setItem('isAdminAuthenticated', 'true');
			goto('/backoffice');
			return;
		}

		if (loginUsername === validUsername && loginPassword === validPassword) {
			isAuthenticated = true;
			localStorage.setItem('isAuthenticated', 'true');
			loginError = '';
			loadInvestments();
		} else {
			loginError = 'ชื่อผู้ใช้หรือ rหัสผ่านไม่ถูกต้อง';
		}
	}

	function handleLogout() {
		isAuthenticated = false;
		localStorage.removeItem('isAuthenticated');
		loginUsername = '';
		loginPassword = '';
		loginError = '';
		investments = [];
		showAddForm = false;
		showEditModal = false;
		showCharts = false;
		showReceivedModal = false;
	}

	async function loadInvestments() {
		try {
			loading = true;
			const [investmentsData, logsData] = await Promise.all([
				investmentService.getInvestments(),
				investmentLogService.getLogs(null)
			]);
			investments = investmentsData;
			allTransactionLogs = logsData;
			console.log('Loaded investments:', investments); 
			console.log('Loaded all logs:', allTransactionLogs);
			loading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			console.error('Error loading investments:', err);
			loading = false;
		}
	}

	async function addInvestment() {

		try {
			if (!formData.amount || !formData.start_date) {
				error = 'กรุณากรอกจำนวนเงินและวันที่เริ่มต้น';
				return;
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
			};

			const result = await investmentService.addInvestment(newInvestment);
			investments = [result, ...investments];

			// บันทึก log การสร้าง investment ใหม่ (เงินออก)
			await investmentLogService.logInitialInvestment(
				result.id,
				parseFloat(formData.amount),
				`สร้างการลงทุนใหม่: ${formData.product_type || 'ไม่ระบุประเภท'}`
			);

			resetForm();
			showAddForm = false;
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	async function updateInvestment() {
		try {
			if (!formData.amount || !formData.start_date) {
				error = 'กรุณากรอกจำนวนเงินและวันที่เริ่มต้น';
				return;
			}

			if (!editingInvestment) {
				error = 'ไม่พบข้อมูลการลงทุนที่จะแก้ไข';
				return;
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
			};

			await investmentService.updateInvestment(editingInvestment.id, updates);
			await loadInvestments();

			resetForm();
			showEditModal = false;
			editingInvestment = null;
			editModalInvestment = null;
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	function startEdit(investment: any) {
		editModalInvestment = investment;
		editingInvestment = investment;
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
		};
		showEditModal = true;
		showAddForm = false;
	}

	function closeEditModal() {
		showEditModal = false;
		editModalInvestment = null;
		editingInvestment = null;
		resetForm();
	}

	function cancelEdit() {
		closeEditModal();
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
		};
	}

	async function quickUpdateReceived(investment: { current_received: any; id: any }) {
		modalInvestment = investment;
		receivedAmount = '';
		showReceivedModal = true;
	}

	async function updateReceivedAmount() {
		if (!receivedAmount || isNaN(parseFloat(receivedAmount))) {
			error = 'กรุณาใส่จำนวนเงินที่ถูกต้อง';
			return;
		}

		try {
			const balanceBefore = modalInvestment.current_received || 0;
			const amountToAdd = parseFloat(receivedAmount);
			const totalReceived = balanceBefore + amountToAdd;

			await investmentService.updateInvestment(modalInvestment.id, {
				current_received: totalReceived
			});

			// บันทึก log เงินเข้า (deposit)
			await investmentLogService.logDeposit(
				modalInvestment.id,
				amountToAdd,
				balanceBefore,
				`รับเงินคืน: ${modalInvestment.product_type || 'การลงทุน #' + modalInvestment.id}`
			);

			await loadInvestments();
			closeReceivedModal();
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	function closeReceivedModal() {
		showReceivedModal = false;
		modalInvestment = null;
		receivedAmount = '';
	}

	async function updateInvestmentStatus(id: any, status: string) {
		try {
			await investmentService.updateInvestment(id, { status });
			await loadInvestments();
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		}
	}

	async function deleteInvestment(id: any) {
		if (confirm('คุณแน่ใจหรือไม่ที่จะลบการลงทุนนี้?')) {
			try {
				await investmentService.deleteInvestment(id);
				await loadInvestments();
			} catch (err) {
				error = err instanceof Error ? err.message : 'An error occurred';
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
			];

			for (const sample of sampleInvestments) {
				await investmentService.addInvestment(sample);
			}

			await loadInvestments();
			error = null;
			console.log('Sample data added successfully');
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred while adding sample data';
			console.error('Error adding sample data:', err);
		}
	}

	function calculateROI(investment: { current_received: number; amount: number }) {
		const received = investment.current_received || 0;
		if (received === 0) return null;
		const roi = ((received - investment.amount) / investment.amount) * 100;
		return roi.toFixed(2);
	}

	function calculateExpectedROI(investment: { expected_return: number; amount: number }) {
		if (!investment.expected_return) return null;
		const roi = ((investment.expected_return - investment.amount) / investment.amount) * 100;
		return roi.toFixed(2);
	}

	function calculateProgress(investment: { expected_return: number; current_received: number }) {
		if (!investment.expected_return || !investment.current_received) return 0;
		const progress = (investment.current_received / investment.expected_return) * 100;
		return Math.min(progress, 100).toFixed(1);
	}

	function calculateDaysLeft(endDate: string | number | Date) {
		if (!endDate) return null;
		const today = new Date();
		const end = new Date(endDate);
		const diffTime = end.getTime() - today.getTime();
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}

	function calculateDaysRunning(startDate: string | number | Date) {
		const today = new Date();
		const start = new Date(startDate);
		const diffTime = today.getTime() - start.getTime();
		const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
		return diffDays;
	}

	// ข้อมูลสรุป
	$: totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);
	$: totalReceived = investments.reduce(
		(sum, inv) => sum + (parseFloat(inv.current_received) || 0),
		0
	);
	$: totalExpectedReturn = investments.reduce((sum, inv) => {
		const expectedReturn = inv.expected_return || 0;
		return sum + parseFloat(expectedReturn);
	}, 0);
	$: totalProfit = totalReceived - totalInvested;
	$: activeInvestments = investments.filter((inv) => inv.status === 'active');
	$: completedInvestments = investments.filter((inv) => inv.status === 'completed');
	$: overallROI = totalInvested > 0 ? ((totalReceived - totalInvested) / totalInvested) * 100 : 0;

	// Filtered and Sorted investments
	$: filteredInvestments = investments
		.filter((investment) => {
			// Filter by status
			if (filterStatus !== 'all' && investment.status !== filterStatus) {
				return false;
			}

			// Filter by search query
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				return (
					(investment.product_type || '').toLowerCase().includes(query) ||
					(investment.supplier || '').toLowerCase().includes(query) ||
					(investment.customer || '').toLowerCase().includes(query) ||
					(investment.notes || '').toLowerCase().includes(query) ||
					investment.id.toString().includes(query)
				);
			}

			return true;
		})
		.sort((a, b) => {
			if (sortOrder === 'latest') {
				return new Date(b.created_at || b.start_date).getTime() - new Date(a.created_at || a.start_date).getTime();
			} else if (sortOrder === 'oldest') {
				return new Date(a.created_at || a.start_date).getTime() - new Date(b.created_at || b.start_date).getTime();
			} else if (sortOrder === 'amount_high') {
				return parseFloat(b.amount) - parseFloat(a.amount);
			} else if (sortOrder === 'amount_low') {
				return parseFloat(a.amount) - parseFloat(b.amount);
			}
			return 0;
		});

	// Period Summaries (รายเดือน/รายสัปดาห์)
	interface PeriodSummary {
		period: string;
		periodLabel: string;
		invested: number;
		received: number;
		profit: number;
		roi: number;
		count: number;
	}

	$: periodSummaries = (() => {
		const summaries = new Map<string, PeriodSummary>();

		if (summaryType === 'investments') {
			investments.forEach((inv) => {
				const date = new Date(inv.start_date);
				let period: string;
				let periodLabel: string;

				if (periodViewMode === 'weekly') {
					const startOfYear = new Date(date.getFullYear(), 0, 1);
					const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
					const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
					period = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
					periodLabel = `สัปดาห์ที่ ${weekNum}, ${date.getFullYear()}`;
				} else {
					period = inv.start_date.substring(0, 7); // YYYY-MM
					const monthNames = [
						'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
						'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
					];
					periodLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
				}

				if (!summaries.has(period)) {
					summaries.set(period, {
						period, periodLabel, invested: 0, received: 0, profit: 0, roi: 0, count: 0
					});
				}

				const summary = summaries.get(period)!;
				summary.invested += parseFloat(inv.amount);
				summary.received += parseFloat(inv.current_received || 0);
				summary.count += 1;
			});
		} else {
			// Summary from Logs (Cash Flow)
			allTransactionLogs.forEach((log) => {
				const date = new Date(log.transaction_date);
				let period: string;
				let periodLabel: string;

				if (periodViewMode === 'weekly') {
					const startOfYear = new Date(date.getFullYear(), 0, 1);
					const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
					const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
					period = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
					periodLabel = `สัปดาห์ที่ ${weekNum}, ${date.getFullYear()}`;
				} else {
					const month = (date.getMonth() + 1).toString().padStart(2, '0');
					period = `${date.getFullYear()}-${month}`;
					const monthNames = [
						'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
						'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
					];
					periodLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
				}

				if (!summaries.has(period)) {
					summaries.set(period, {
						period, periodLabel, invested: 0, received: 0, profit: 0, roi: 0, count: 0
					});
				}

				const summary = summaries.get(period)!;
				if (log.type === 'initial_investment') {
					summary.invested += Math.abs(parseFloat(log.amount));
				} else if (log.type === 'deposit') {
					summary.received += parseFloat(log.amount);
				} else if (log.type === 'withdrawal') {
					summary.received -= parseFloat(log.amount);
				}
				summary.count += 1;

			});
		}

		// Calculate profit and ROI
		summaries.forEach((summary) => {
			summary.profit = summary.received - summary.invested;
			summary.roi = summary.invested > 0 ? ((summary.received - summary.invested) / summary.invested) * 100 : 0;
		});

		// Sort
		let sortedArray = Array.from(summaries.values());
		sortedArray.sort((a, b) => {
			let comparison = 0;
			switch (periodSortField) {
				case 'period':
					comparison = a.period.localeCompare(b.period);
					break;
				case 'invested':
					comparison = a.invested - b.invested;
					break;
				case 'received':
					comparison = a.received - b.received;
					break;
				case 'profit':
					comparison = a.profit - b.profit;
					break;
				case 'roi':
					comparison = a.roi - b.roi;
					break;
				case 'count':
					comparison = a.count - b.count;
					break;
			}
			return periodSortDirection === 'asc' ? comparison : -comparison;
		});

		return sortedArray;
	})();

	// Period Totals
	$: periodTotals = {
		invested: periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0),
		received: periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.received, 0),
		profit: periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.profit, 0),
		count: periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.count, 0),
		roi: periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0) > 0 
			? ((periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.received, 0) - periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0)) / periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0)) * 100 
			: 0
	};

	function togglePeriodSort(field: 'period' | 'invested' | 'received' | 'profit' | 'roi' | 'count') {
		if (periodSortField === field) {
			periodSortDirection = periodSortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			periodSortField = field;
			periodSortDirection = 'desc';
		}
	}

	// ข้อมูลสำหรับกราฟ
	// ข้อมูลสำหรับกราฟ
	$: chartData = {
		monthly: getMonthlyData(investments, allTransactionLogs, summaryType),
		roiComparison: getROIComparisonData(investments),
		statusDistribution: getStatusDistributionData(investments),
		productTypeData: getProductTypeData(investments, allTransactionLogs, summaryType)
	};

	function getMonthlyData(invs: any[], logs: any[], type: string) {
		const monthlyStats: Record<string, { invested: number; received: number; count: number }> = {};
		
		if (type === 'investments') {
			(invs || []).forEach((inv) => {
				if (!inv || !inv.start_date) return;
				const dateStr = String(inv.start_date);
				const month = dateStr.includes('-') ? dateStr.substring(0, 7) : dateStr.substring(0, 7); // Assuming YYYY-MM-DD
				if (!monthlyStats[month]) {
					monthlyStats[month] = { invested: 0, received: 0, count: 0 };
				}
				monthlyStats[month].invested += parseFloat(inv.amount || 0) || 0;
				monthlyStats[month].received += parseFloat(inv.current_received || 0) || 0;
				monthlyStats[month].count += 1;
			});
		} else {
			// Cash Flow Mode
			(logs || []).forEach((log) => {
				if (!log || !log.transaction_date) return;
				const dateStr = String(log.transaction_date);
				const month = dateStr.substring(0, 7);
				if (!monthlyStats[month]) {
					monthlyStats[month] = { invested: 0, received: 0, count: 0 };
				}
				
				const amount = parseFloat(log.amount || 0) || 0;
				if (log.type === 'initial_investment') {
					monthlyStats[month].invested += Math.abs(amount);
				} else if (log.type === 'deposit') {
					monthlyStats[month].received += amount;
				} else if (log.type === 'withdrawal') {
					monthlyStats[month].received -= amount;
				}
				monthlyStats[month].count += 1;
			});
		}

		return Object.entries(monthlyStats).sort((a, b) => a[0].localeCompare(b[0])).slice(-6); // 6 เดือนล่าสุด
	}

	function getROIComparisonData(invs: any[]) {
		return (invs || [])
			.filter((inv) => inv && (parseFloat(inv.current_received || 0) > 0 || parseFloat(inv.amount || 0) > 0))
			.map((inv) => {
				const invested = parseFloat(inv.amount || 0) || 0;
				const received = parseFloat(inv.current_received || 0) || 0;
				return {
					id: inv.id,
					name: inv.product_type || `การลงทุน #${inv.id}`,
					roi: invested > 0 ? ((received - invested) / invested) * 100 : 0,
					amount: invested
				};
			})
			.sort((a, b) => b.roi - a.roi)
			.slice(0, 5); // Top 5
	}

	function getStatusDistributionData(invs: any[]) {
		const statusCount: Record<string, number> = { active: 0, completed: 0, cancelled: 0 };
		(invs || []).forEach((inv) => {
			if (!inv || !inv.status) return;
			const status = String(inv.status).toLowerCase();
			if (statusCount[status] !== undefined) {
				statusCount[status] = (statusCount[status] || 0) + 1;
			}
		});
		return statusCount;
	}

	function getProductTypeData(invs: any[], logs: any[], type: string) {
		const typeStats: Record<string, { count: number; totalAmount: number; totalReceived: number }> = {};
		
		if (type === 'investments') {
			(invs || []).forEach((inv) => {
				const productType = inv.product_type || 'อื่นๆ';
				if (!typeStats[productType]) {
					typeStats[productType] = { count: 0, totalAmount: 0, totalReceived: 0 };
				}
				typeStats[productType].count += 1;
				typeStats[productType].totalAmount += parseFloat(inv.amount || 0);
				typeStats[productType].totalReceived += parseFloat(inv.current_received || 0);
			});
		} else {
			// Cash Flow Mode
			(logs || []).forEach((log) => {
				const productType = log.investments?.product_type || 'อื่นๆ';
				if (!typeStats[productType]) {
					typeStats[productType] = { count: 0, totalAmount: 0, totalReceived: 0 };
				}
				
				const amount = parseFloat(log.amount || 0);
				if (log.type === 'initial_investment') {
					typeStats[productType].totalAmount += Math.abs(amount);
				} else if (log.type === 'deposit') {
					typeStats[productType].totalReceived += amount;
				} else if (log.type === 'withdrawal') {
					typeStats[productType].totalReceived -= amount;
				}
				typeStats[productType].count += 1;
			});
		}

		return Object.entries(typeStats)
			.map(([productType, data]) => ({
				type: productType,
				count: data.count,
				amount: data.totalAmount,
				received: data.totalReceived,
				roi: data.totalAmount > 0
					? ((data.totalReceived - data.totalAmount) / data.totalAmount) * 100
					: 0
			}))
			.sort((a, b) => b.amount - a.amount);
	}


	// Transaction History Functions
	async function loadTransactionLogs(investmentId: number | null = null) {
		try {
			transactionLoading = true;
			selectedInvestmentForLogs = investmentId;
			transactionLogs = await investmentLogService.getLogs(investmentId);
			transactionLoading = false;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred loading transaction logs';
			transactionLoading = false;
		}
	}

	async function openTransactionHistory(investmentId: number | null = null) {
		showTransactionHistory = true;
		await loadTransactionLogs(investmentId);
	}

	function closeTransactionHistory() {
		showTransactionHistory = false;
		transactionLogs = [];
		selectedInvestmentForLogs = null;
	}

	function formatTransactionType(type: string) {
		switch (type) {
			case 'initial_investment':
				return {
					label: 'สร้างการลงทุน',
					color: 'text-orange-600',
					bg: 'bg-orange-100',
					icon: '💸'
				};
			case 'deposit':
				return { label: 'เงินเข้า', color: 'text-green-600', bg: 'bg-green-100', icon: '💰' };
			case 'withdrawal':
				return { label: 'เงินออก', color: 'text-red-600', bg: 'bg-red-100', icon: '💳' };
			default:
				return { label: type, color: 'text-gray-600', bg: 'bg-gray-100', icon: '📝' };
		}
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleDateString('th-TH', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('th-TH', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
	}
</script>

{#if !isAuthenticated}
	<!-- Login Screen -->
	<div
		class="flex min-h-screen items-center justify-center bg-slate-100/50 p-4 font-sans text-slate-800 selection:bg-indigo-500 selection:text-white"
	>
		<div class="w-full max-w-[400px]">
			<div class="overflow-hidden rounded-[2rem] bg-white shadow-xl ring-1 ring-slate-100">
				<!-- Header Section -->
				<div class="relative overflow-hidden bg-[#1e293b] p-10 text-center text-white">
					<!-- Logo -->
					<div
						class="relative z-10 mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-xl ring-4 ring-white/10"
					>
						<img src="/Twentytoy.jpg" alt="Twenty Toys Logo" class="h-full w-full object-cover" />
					</div>

					<div class="relative z-10">
						<h1 class="mb-2 text-2xl font-bold tracking-tight">Welcome Back</h1>
						<p class="text-sm font-medium text-slate-400">Twenty Toys Investment Tracker</p>
					</div>

					<!-- Decorative subtle pattern/circles -->
					<div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5 blur-2xl"></div>
					<div
						class="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-slate-500/10 blur-2xl"
					></div>
				</div>

				<!-- Form Section -->
				<div class="px-8 py-10">
					<form on:submit|preventDefault={handleLogin} class="space-y-6">
						<div class="space-y-2">
							<label for="username" class="ml-1 block text-sm font-semibold text-slate-600"
								>Username</label
							>
							<div class="relative">
								<div
									class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
								>
									<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<input
									type="text"
									id="username"
									bind:value={loginUsername}
									required
									class="block w-full rounded-2xl border-0 bg-slate-100 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-slate-900"
									placeholder="admin@gmail.com"
								/>
							</div>
						</div>

						<div class="space-y-2">
							<label for="password" class="ml-1 block text-sm font-semibold text-slate-600"
								>Password</label
							>
							<div class="relative">
								<div
									class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400"
								>
									<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
											clip-rule="evenodd"
										/>
									</svg>
								</div>
								<input
									type="password"
									id="password"
									bind:value={loginPassword}
									required
									class="block w-full rounded-2xl border-0 bg-slate-100 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 transition-all focus:bg-white focus:ring-2 focus:ring-slate-900"
									placeholder="••••••••••••"
								/>
							</div>
						</div>

						{#if loginError}
							<div
								class="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-red-600"
							>
								<svg class="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
									<path
										fill-rule="evenodd"
										d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
										clip-rule="evenodd"
									/>
								</svg>
								<span>{loginError}</span>
							</div>
						{/if}

						<button
							type="submit"
							class="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-4 text-base font-bold text-white shadow-lg shadow-slate-200 transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
						>
							Sign In
						</button>
					</form>
				</div>

				<div class="border-t border-slate-50 bg-slate-50/50 p-6 text-center">
					<p class="text-xs font-medium text-slate-400">
						© {new Date().getFullYear()} Twenty Toys System
					</p>
				</div>
			</div>
		</div>
	</div>
{:else}
	<!-- Main Application (ถ้าผ่าน login แล้ว) -->
	<div
		class="flex min-h-screen flex-col bg-slate-100/50 font-sans text-slate-800 selection:bg-indigo-500 selection:text-white"
	>
		<header class="bg-indigo-600 py-8 text-white shadow-lg shadow-indigo-200/50">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-4">
				<div class=" flex-1">
					<h1 class="mb-1 text-3xl font-bold tracking-tight">Twenty Toys</h1>
					<p class="text-sm font-medium text-indigo-200">Investment Portfolio Tracker</p>
				</div>
				<button
					on:click={handleLogout}
					class="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 font-medium text-white backdrop-blur-sm transition-colors duration-200 hover:bg-white/20"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						/>
					</svg>
					Sign Out
				</button>
			</div>
		</header>

		<main class="py-10">
			<div class="mx-auto max-w-6xl px-4">
				<!-- Period Summary Section (Now as Overview) -->
				<section class="mb-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
						<h2 class="flex items-center gap-2 text-xl font-bold text-slate-800">
							<span class="inline-block h-6 w-1 rounded-full bg-indigo-500"></span>
							Overview Summary
						</h2>
						
						<!-- Toggle Weekly/Monthly -->
						<div class="flex items-center gap-4">
							<!-- Summary Type Toggle -->
							<div class="flex rounded-xl bg-slate-100 p-1">
								<button
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {summaryType === 'investments'
										? 'bg-white text-indigo-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (summaryType = 'investments')}
								>
									📂 Investment
								</button>
								<button
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {summaryType === 'logs'
										? 'bg-white text-indigo-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (summaryType = 'logs')}
								>
									💸 Cash Flow
								</button>
							</div>

							<div class="h-6 w-px bg-slate-200"></div>

							<div class="flex rounded-xl bg-slate-100 p-1">
								<button
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {periodViewMode === 'weekly'
										? 'bg-white text-teal-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (periodViewMode = 'weekly')}
								>
									📅 Weekly
								</button>
								<button
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {periodViewMode === 'monthly'
										? 'bg-white text-teal-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (periodViewMode = 'monthly')}
								>
									📆 Monthly
								</button>
							</div>
						</div>
					</div>

					<div class="mb-6 rounded-xl bg-indigo-50/50 p-4 ring-1 ring-indigo-100">
						<p class="text-xs font-bold text-indigo-900">
							{#if summaryType === 'investments'}
								🔍 สรุปตามวันที่เริ่มลงทุน (Investment Date): จะนับยอดเงินลงทุนและรับคืนทั้งหมดของโปรเจกต์นั้นๆ ลงในเดือนที่เริ่มโปรเจกต์
							{:else}
								🔍 สรุปตามการเคลื่อนไหวของเงิน (Actual Cash Flow Log): จะนับยอดเงินลงทุนและรับคืนตามวันที่บันทึก Log จริง (เห็นเงินเข้าเงินออกรายเดือนที่ชัดเจนกว่า)
							{/if}
						</p>
					</div>

					<!-- Summary Cards -->
					<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div class="rounded-xl bg-slate-50 p-4">
							<div class="mb-1 text-xs font-medium text-slate-500">💰 ลงทุนรวม</div>
							<div class="text-xl font-bold text-slate-900">฿{periodTotals.invested.toLocaleString()}</div>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<div class="mb-1 text-xs font-medium text-slate-500">💵 รับคืนรวม</div>
							<div class="text-xl font-bold text-emerald-600">฿{periodTotals.received.toLocaleString()}</div>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<div class="mb-1 text-xs font-medium text-slate-500">📈 กำไร/ขาดทุน</div>
							<div class="text-xl font-bold {periodTotals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
								{periodTotals.profit >= 0 ? '+' : ''}฿{periodTotals.profit.toLocaleString()}
							</div>
						</div>
						<div class="rounded-xl bg-slate-50 p-4">
							<div class="mb-1 text-xs font-medium text-slate-500">📊 ROI เฉลี่ย</div>
							<div class="text-xl font-bold {periodTotals.roi >= 0 ? 'text-indigo-600' : 'text-rose-600'}">
								{periodTotals.roi >= 0 ? '+' : ''}{periodTotals.roi.toFixed(2)}%
							</div>
						</div>
					</div>

					<!-- Data Table -->
					{#if periodSummaries.length > 0}
						<div class="overflow-x-auto rounded-xl border border-slate-200">
							<table class="w-full">
								<thead>
									<tr class="border-b border-slate-100 bg-slate-50/50">
										<th class="px-4 py-3 text-left">
											<button
												class="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
												on:click={() => togglePeriodSort('period')}
											>
												ช่วงเวลา
												{#if periodSortField === 'period'}
													<span class="text-teal-600">{periodSortDirection === 'asc' ? '↑' : '↓'}</span>
												{/if}
											</button>
										</th>
										<th class="px-4 py-3 text-right">
											<button
												class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
												on:click={() => togglePeriodSort('count')}
											>
												จำนวน
												{#if periodSortField === 'count'}
													<span class="text-teal-600">{periodSortDirection === 'asc' ? '↑' : '↓'}</span>
												{/if}
											</button>
										</th>
										<th class="px-4 py-3 text-right">
											<button
												class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
												on:click={() => togglePeriodSort('invested')}
											>
												ลงทุน
												{#if periodSortField === 'invested'}
													<span class="text-teal-600">{periodSortDirection === 'asc' ? '↑' : '↓'}</span>
												{/if}
											</button>
										</th>
										<th class="px-4 py-3 text-right">
											<button
												class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
												on:click={() => togglePeriodSort('received')}
											>
												รับคืน
												{#if periodSortField === 'received'}
													<span class="text-teal-600">{periodSortDirection === 'asc' ? '↑' : '↓'}</span>
												{/if}
											</button>
										</th>
										<th class="px-4 py-3 text-right">
											<button
												class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
												on:click={() => togglePeriodSort('profit')}
											>
												กำไร/ขาดทุน
												{#if periodSortField === 'profit'}
													<span class="text-teal-600">{periodSortDirection === 'asc' ? '↑' : '↓'}</span>
												{/if}
											</button>
										</th>
										<th class="px-4 py-3 text-right">
											<button
												class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
												on:click={() => togglePeriodSort('roi')}
											>
												ROI
												{#if periodSortField === 'roi'}
													<span class="text-teal-600">{periodSortDirection === 'asc' ? '↑' : '↓'}</span>
												{/if}
											</button>
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each periodSummaries as summary (summary.period)}
										<tr class="transition-colors hover:bg-slate-50/50">
											<td class="px-4 py-3">
												<div class="font-bold text-slate-900">{summary.periodLabel}</div>
												<div class="text-xs text-slate-400">{summary.period}</div>
											</td>
											<td class="px-4 py-3 text-right">
												<span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
													{summary.count} รายการ
												</span>
											</td>
											<td class="px-4 py-3 text-right font-medium text-slate-700">
												฿{summary.invested.toLocaleString()}
											</td>
											<td class="px-4 py-3 text-right font-medium text-emerald-600">
												฿{summary.received.toLocaleString()}
											</td>
											<td class="px-4 py-3 text-right font-bold {summary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
												{summary.profit >= 0 ? '+' : ''}฿{summary.profit.toLocaleString()}
											</td>
											<td class="px-4 py-3 text-right">
												<span
													class="rounded-full px-2 py-1 text-xs font-bold {summary.roi >= 0
														? 'bg-emerald-50 text-emerald-700'
														: 'bg-rose-50 text-rose-700'}"
												>
													{summary.roi >= 0 ? '+' : ''}{summary.roi.toFixed(2)}%
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="border-t-2 border-slate-200 bg-slate-50 font-bold">
										<td class="px-4 py-3 text-slate-900">รวมทั้งหมด</td>
										<td class="px-4 py-3 text-right text-slate-700">{periodTotals.count} รายการ</td>
										<td class="px-4 py-3 text-right text-slate-900">฿{periodTotals.invested.toLocaleString()}</td>
										<td class="px-4 py-3 text-right text-emerald-600">฿{periodTotals.received.toLocaleString()}</td>
										<td class="px-4 py-3 text-right {periodTotals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
											{periodTotals.profit >= 0 ? '+' : ''}฿{periodTotals.profit.toLocaleString()}
										</td>
										<td class="px-4 py-3 text-right">
											<span
												class="rounded-full px-2 py-1 text-xs font-bold {periodTotals.roi >= 0
													? 'bg-indigo-100 text-indigo-700'
													: 'bg-rose-100 text-rose-700'}"
											>
												{periodTotals.roi >= 0 ? '+' : ''}{periodTotals.roi.toFixed(2)}%
											</span>
										</td>
									</tr>
								</tfoot>
							</table>
						</div>
					{:else}
						<div class="rounded-xl bg-slate-50 p-8 text-center">
							<div class="mb-2 text-4xl">📭</div>
							<p class="text-slate-500">ยังไม่มีข้อมูลการลงทุน</p>
						</div>
					{/if}
				</section>

				{#if error}
					<div
						class="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
					>
						<span>⚠️</span>
						<span>{error}</span>
					</div>
				{/if}

				<!-- Action Bar Renovated -->
				<section class="mb-10">
					<div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
						<div class="flex flex-wrap items-center gap-3">
							<button
								class="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition-all duration-300 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-95"
								on:click={() => {
									showAddForm = !showAddForm;
									showEditModal = false;
									editingInvestment = null;
									editModalInvestment = null;
									if (showAddForm) resetForm();
								}}
							>
								{#if showAddForm}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
									Cancel
								{:else}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
									Add Investment
								{/if}
							</button>

							<div class="flex items-center gap-2 rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
								<button
									class="flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-all {showCharts ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (showCharts = !showCharts)}
								>
									📊 {showCharts ? 'Hide Charts' : 'Charts'}
								</button>
								<div class="h-4 w-px bg-slate-200"></div>
								<button
									class="flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-bold transition-all {showTransactionHistory ? 'bg-purple-50 text-purple-600' : 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => openTransactionHistory(null)}
								>
									📜 Logs
								</button>
							</div>
						</div>

						<div class="flex items-center gap-3">
							<span class="text-xs font-bold uppercase tracking-widest text-slate-400">Filter Status</span>
							<div class="flex rounded-xl bg-slate-100 p-1.5 shadow-inner">
								<button
									class="rounded-lg px-4 py-2 text-xs font-bold transition-all {filterStatus === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (filterStatus = 'all')}
								>
									All
								</button>
								<button
									class="rounded-lg px-4 py-2 text-xs font-bold transition-all {filterStatus === 'active' ? 'bg-white text-orange-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (filterStatus = 'active')}
								>
									Active
								</button>
								<button
									class="rounded-lg px-4 py-2 text-xs font-bold transition-all {filterStatus === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (filterStatus = 'completed')}
								>
									Completed
								</button>
								<button
									class="rounded-lg px-4 py-2 text-xs font-bold transition-all {filterStatus === 'cancelled' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (filterStatus = 'cancelled')}
								>
									Cancelled
								</button>
							</div>
						</div>
					</div>
				</section>

				<!-- Search & Filter Bar Renovated -->
				<section class="mb-8 rounded-[2rem] bg-indigo-900/5 p-6 backdrop-blur-sm">
					<div class="flex flex-col gap-4 md:flex-row md:items-center">
						<div class="flex-shrink-0">
							<span class="flex items-center gap-2 text-sm font-bold text-indigo-900">
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
								Quick Search
							</span>
						</div>
						<div class="relative flex-1">
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search by ID, Product Type, Supplier, Customer..."
								class="w-full rounded-2xl border-0 bg-white py-4 pl-12 pr-4 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-200 transition-all placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600"
							/>
							<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
								<div class="h-2 w-2 rounded-full bg-indigo-600"></div>
							</div>
						</div>

						<!-- Sort Options -->
						<div class="flex items-center gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
							<div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap p-1">
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder === 'latest' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'latest')}
								>
									Latest
								</button>
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder === 'oldest' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'oldest')}
								>
									Oldest
								</button>
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder === 'amount_high' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'amount_high')}
								>
									฿ High
								</button>
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder === 'amount_low' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'amount_low')}
								>
									฿ Low
								</button>
							</div>
						</div>
					</div>
				</section>


				<!-- Charts Section -->

				{#if showCharts}
					<section class="charts-section">
						<h2 class="section-title">📈 Analytics and Statistics</h2>

						<!-- Debug Info -->
						<div
							class="debug-info"
							style="background: #f0f0f0; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.75rem;"
						>
							<p>Investments count: {investments.length}</p>
							<p>Chart data available: {JSON.stringify(Object.keys(chartData))}</p>
							<p>ROI comparison items: {chartData.roiComparison.length}</p>
							<p>Monthly data items: {chartData.monthly.length}</p>
							<p>Product types: {chartData.productTypeData.length}</p>
						</div>

						<div class="charts-grid">
							<!-- ROI Comparison Chart -->
							<div class="chart-card">
								<h3 class="chart-title">🏆 Top 5 ROI Investments</h3>
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
										<p class="no-data">No ROI data available</p>
									{/if}
								</div>
							</div>

							<!-- Status Distribution -->
							<div class="chart-card">
								<h3 class="chart-title">📊 Investment Status</h3>
								<div class="chart-content">
									{#if Object.values(chartData.statusDistribution).some((v) => v > 0)}
										<div class="status-chart">
											{#each Object.entries(chartData.statusDistribution) as [status, count]}
												{#if count > 0}
													<div class="status-bar-item">
														<span class="status-label">{status}</span>
														<div class="status-bar-track">
															<div
																class="status-bar-fill status-{status}"
																style="width: {(count / investments.length) * 100}%"
															></div>
														</div>
														<span class="status-count"
															>{count} ({((count / investments.length) * 100).toFixed(0)}%)</span
														>
													</div>
												{/if}
											{/each}
										</div>
									{:else}
										<p class="no-data">No Status data available</p>
									{/if}
								</div>
							</div>

							<!-- Monthly Investment Trend -->
							<div class="chart-card full-width">
								<h3 class="chart-title">📅 Monthly Investment Trend (Last 6 Months)</h3>
								<div class="chart-content">
									{#if chartData.monthly.length > 0}
										<div class="monthly-chart">
											{#each chartData.monthly as [month, data]}
												<div class="monthly-item">
													<div class="monthly-bars">
														<div class="bar-container">
															<div
																class="bar invested"
																style="height: {(data.invested /
																	Math.max(
																		...chartData.monthly.map(([, d]) => (d as any).invested)
																	)) *
																	100}%"
																title="Invested: {data.invested.toLocaleString()} THB"
															></div>
														</div>
														<div class="bar-container">
															<div
																class="bar received"
																style="height: {(data.received /
																	Math.max(
																		...chartData.monthly.map(([, d]) => (d as any).invested)
																	)) *
																	100}%"
																title="Received: {data.received.toLocaleString()} THB"
															></div>
														</div>
													</div>
													<div class="monthly-label">{month}</div>
													<div class="monthly-count">{data.count} Deals</div>
												</div>
											{/each}
										</div>
										<div class="chart-legend">
											<div class="legend-item">
												<div class="legend-color invested"></div>
												<span>Invested Amount</span>
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
					<section class="rounded-lg border border-pink-200 bg-white p-6 shadow-lg">
						<div class="space-y-6">
							<div class="border-b border-pink-200 pb-4 text-center">
								<h3 class="flex items-center justify-center gap-2 text-2xl font-bold text-gray-800">
									<span class="text-2xl">➕</span>
									เพิ่มการลงทุนใหม่
								</h3>
							</div>

							<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
								<div class="space-y-2">
									<label for="amount" class="block text-sm font-medium text-gray-700"
										>จำนวนเงินลงทุน (บาท) *</label
									>
									<input
										type="number"
										id="amount"
										bind:value={formData.amount}
										placeholder="8000"
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="start_date" class="block text-sm font-medium text-gray-700"
										>วันที่เริ่มต้น *</label
									>
									<input
										type="date"
										id="start_date"
										bind:value={formData.start_date}
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="end_date" class="block text-sm font-medium text-gray-700"
										>วันที่คาดว่าจะจบ</label
									>
									<input
										type="date"
										id="end_date"
										bind:value={formData.end_date}
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="expected_return" class="block text-sm font-medium text-gray-700"
										>ผลตอบแทนที่คาดหวัง (บาท)</label
									>
									<input
										type="number"
										id="expected_return"
										bind:value={formData.expected_return}
										placeholder="9600"
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="current_received" class="block text-sm font-medium text-gray-700"
										>เงินที่ได้รับแล้ว (บาท)</label
									>
									<input
										type="number"
										id="current_received"
										bind:value={formData.current_received}
										placeholder="0"
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="status" class="block text-sm font-medium text-gray-700">สถานะ</label>
									<select
										id="status"
										bind:value={formData.status}
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									>
										<option value="active">กำลังดำเนินการ</option>
										<option value="completed">เสร็จสิ้น</option>
										<option value="cancelled">ยกเลิก</option>
									</select>
								</div>

								<div class="space-y-2">
									<label for="product_type" class="block text-sm font-medium text-gray-700"
										>ประเภทสินค้า</label
									>
									<input
										type="text"
										id="product_type"
										bind:value={formData.product_type}
										placeholder="เสื้อผ้า, อิเล็กทรอนิกส์, ของเล่น..."
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="supplier" class="block text-sm font-medium text-gray-700"
										>ซัพพลายเออร์/แหล่งซื้อ</label
									>
									<input
										type="text"
										id="supplier"
										bind:value={formData.supplier}
										placeholder="ชื่อร้าน, ผู้ผลิต..."
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="customer" class="block text-sm font-medium text-gray-700"
										>ลูกค้า/ช่องทางขาย</label
									>
									<input
										type="text"
										id="customer"
										bind:value={formData.customer}
										placeholder="Facebook, Shopee, ลูกค้าเก่า..."
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2">
									<label for="profit_margin" class="block text-sm font-medium text-gray-700"
										>เปอร์เซ็นต์กำไรที่คาดหวัง (%)</label
									>
									<input
										type="number"
										id="profit_margin"
										bind:value={formData.profit_margin}
										placeholder="20"
										step="0.01"
										class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									/>
								</div>

								<div class="space-y-2 md:col-span-2">
									<label for="notes" class="block text-sm font-medium text-gray-700"
										>หมายเหตุ/รายละเอียด</label
									>
									<textarea
										id="notes"
										bind:value={formData.notes}
										placeholder="พรีออร์เดอร์ของใหม่, ข้อมูลเพิ่มเติม..."
										class="min-h-[80px] w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
									></textarea>
								</div>
							</div>

							<div class="flex flex-col gap-3 pt-4 sm:flex-row">
								<button
									class="flex flex-1 items-center justify-center gap-2 rounded-md bg-pink-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-pink-600"
									on:click={addInvestment}
								>
									<span class="text-lg">💾</span>
									บันทึก
								</button>
								<button
									class="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-gray-600"
									on:click={() => {
										showAddForm = false;
										resetForm();
									}}
								>
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
					<div
						class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
						on:click={closeReceivedModal}
						role="dialog"
						aria-modal="true"
					>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<div
							class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl"
							on:click|stopPropagation={() => {}}
							role="document"
						>
							<div class="flex items-center justify-between border-b border-gray-200 p-6">
								<h3 class="flex items-center gap-2 text-xl font-bold text-gray-800">
									<span class="text-2xl">💰</span>
									เพิ่มเงินที่ได้รับ
								</h3>
								<button
									class="flex h-8 w-8 items-center justify-center rounded-full text-2xl font-bold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
									on:click={closeReceivedModal}
								>
									<span>✕</span>
								</button>
							</div>

							<div class="space-y-6 p-6">
								<div class="rounded-lg border border-pink-200 bg-pink-50 p-4">
									<h4 class="mb-3 font-semibold text-gray-800">
										{modalInvestment.product_type || 'การลงทุน'} #{modalInvestment.id}
									</h4>
									<div class="space-y-2">
										<div class="flex items-center justify-between">
											<span class="text-sm text-gray-600">เงินลงทุน:</span>
											<span class="font-medium text-gray-800"
												>{parseFloat(modalInvestment.amount).toLocaleString()} บาท</span
											>
										</div>
										<div class="flex items-center justify-between">
											<span class="text-sm text-gray-600">ได้รับแล้ว:</span>
											<span class="font-medium text-green-600"
												>{(modalInvestment.current_received || 0).toLocaleString()} บาท</span
											>
										</div>
										{#if modalInvestment.expected_return}
											<div class="flex items-center justify-between">
												<span class="text-sm text-gray-600">เป้าหมาย:</span>
												<span class="font-medium text-blue-600"
													>{parseFloat(modalInvestment.expected_return).toLocaleString()} บาท</span
												>
											</div>
										{/if}
									</div>
								</div>

								<div class="space-y-4">
									<div class="space-y-2">
										<label for="received-amount" class="block text-sm font-medium text-gray-700"
											>จำนวนเงินที่ได้รับเพิ่มเติม (บาท)</label
										>
										<!-- svelte-ignore a11y-autofocus -->
										<input
											type="number"
											id="received-amount"
											bind:value={receivedAmount}
											placeholder="เช่น 2000"
											step="0.01"
											min="0"
											autofocus
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									{#if receivedAmount && !isNaN(parseFloat(receivedAmount))}
										<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
											<div class="space-y-2 text-sm">
												<div class="flex items-center justify-between">
													<span>ได้รับแล้ว:</span>
													<span class="font-medium"
														>{(modalInvestment.current_received || 0).toLocaleString()} บาท</span
													>
												</div>
												<div class="flex items-center justify-between text-green-600">
													<span>+ เพิ่มเติม:</span>
													<span class="font-medium"
														>{parseFloat(receivedAmount).toLocaleString()} บาท</span
													>
												</div>
												<div
													class="flex items-center justify-between border-t border-gray-300 pt-2 text-lg font-semibold"
												>
													<span>= รวม:</span>
													<span class="text-pink-600"
														>{(
															(modalInvestment.current_received || 0) + parseFloat(receivedAmount)
														).toLocaleString()} บาท</span
													>
												</div>
											</div>
										</div>
									{/if}
								</div>
							</div>

							<div class="flex flex-col gap-3 border-t border-gray-200 p-6 sm:flex-row">
								<button
									class="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-gray-600"
									on:click={closeReceivedModal}
								>
									<span class="text-lg">❌</span>
									ยกเลิก
								</button>
								<button
									class="flex flex-1 items-center justify-center gap-2 rounded-md bg-pink-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-pink-600 disabled:cursor-not-allowed disabled:bg-gray-300"
									on:click={updateReceivedAmount}
									disabled={!receivedAmount ||
										isNaN(parseFloat(receivedAmount)) ||
										parseFloat(receivedAmount) <= 0}
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
					<div
						class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
						on:click={closeEditModal}
						role="dialog"
						aria-modal="true"
					>
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
						<div
							class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl"
							on:click|stopPropagation={() => {}}
							role="document"
						>
							<div class="flex items-center justify-between border-b border-gray-200 p-6">
								<h3 class="flex items-center gap-2 text-xl font-bold text-gray-800">
									<span class="text-2xl">✏️</span>
									แก้ไขการลงทุน
								</h3>
								<button
									class="flex h-8 w-8 items-center justify-center rounded-full text-2xl font-bold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
									on:click={closeEditModal}>×</button
								>
							</div>

							<div class="p-6">
								<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
									<div class="space-y-2">
										<label for="edit-amount" class="block text-sm font-medium text-gray-700"
											>จำนวนเงินลงทุน (บาท) *</label
										>
										<input
											id="edit-amount"
											type="number"
											bind:value={formData.amount}
											required
											min="1"
											placeholder="เช่น 10000"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label for="edit-start-date" class="block text-sm font-medium text-gray-700"
											>วันที่เริ่มลงทุน *</label
										>
										<input
											id="edit-start-date"
											type="date"
											bind:value={formData.start_date}
											required
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label for="edit-end-date" class="block text-sm font-medium text-gray-700"
											>วันที่คาดหวังคืนทุน</label
										>
										<input
											id="edit-end-date"
											type="date"
											bind:value={formData.end_date}
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label
											for="edit-expected-return"
											class="block text-sm font-medium text-gray-700"
											>ผลตอบแทนที่คาดหวัง (บาท)</label
										>
										<input
											id="edit-expected-return"
											type="number"
											bind:value={formData.expected_return}
											min="0"
											placeholder="เช่น 12000"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label
											for="edit-current-received"
											class="block text-sm font-medium text-gray-700">เงินที่ได้รับแล้ว (บาท)</label
										>
										<input
											id="edit-current-received"
											type="number"
											bind:value={formData.current_received}
											min="0"
											placeholder="เช่น 5000"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label for="edit-status" class="block text-sm font-medium text-gray-700"
											>สถานะ</label
										>
										<select
											id="edit-status"
											bind:value={formData.status}
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										>
											<option value="active">กำลังดำเนินการ</option>
											<option value="completed">เสร็จสิ้น</option>
											<option value="cancelled">ยกเลิก</option>
										</select>
									</div>

									<div class="space-y-2">
										<label for="edit-product-type" class="block text-sm font-medium text-gray-700"
											>ประเภทสินค้า</label
										>
										<input
											id="edit-product-type"
											type="text"
											bind:value={formData.product_type}
											placeholder="เช่น เสื้อผ้า, อิเล็กทรอนิกส์"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label for="edit-supplier" class="block text-sm font-medium text-gray-700"
											>ซัพพลายเออร์</label
										>
										<input
											id="edit-supplier"
											type="text"
											bind:value={formData.supplier}
											placeholder="เช่น บริษัท ABC"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label for="edit-customer" class="block text-sm font-medium text-gray-700"
											>ลูกค้า/แพลตฟอร์ม</label
										>
										<input
											id="edit-customer"
											type="text"
											bind:value={formData.customer}
											placeholder="เช่น Facebook, Shopee, Lazada"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2">
										<label for="edit-profit-margin" class="block text-sm font-medium text-gray-700"
											>กำไรต่อหน่วย (%)</label
										>
										<input
											id="edit-profit-margin"
											type="number"
											bind:value={formData.profit_margin}
											min="0"
											step="0.01"
											placeholder="เช่น 15.5"
											class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										/>
									</div>

									<div class="space-y-2 md:col-span-2">
										<label for="edit-notes" class="block text-sm font-medium text-gray-700"
											>หมายเหตุ</label
										>
										<textarea
											id="edit-notes"
											bind:value={formData.notes}
											placeholder="พรีออร์เดอร์ของใหม่, ข้อมูลเพิ่มเติม..."
											class="min-h-[80px] w-full rounded-md border border-gray-300 px-3 py-2 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
										></textarea>
									</div>
								</div>
							</div>

							<div class="flex flex-col gap-3 border-t border-gray-200 p-6 sm:flex-row">
								<button
									class="flex flex-1 items-center justify-center gap-2 rounded-md bg-gray-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-gray-600"
									on:click={closeEditModal}
								>
									<span class="text-lg">❌</span>
									ยกเลิก
								</button>
								<button
									class="flex flex-1 items-center justify-center gap-2 rounded-md bg-pink-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-pink-600"
									on:click={updateInvestment}
								>
									<span class="text-lg">💾</span>
									บันทึกการแก้ไข
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Investments List -->
				{#if loading}
					<section
						class="flex flex-col items-center justify-center rounded-lg border border-pink-200 bg-white py-12 shadow-lg"
					>
						<div class="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-500"></div>
						<p class="mt-4 font-medium text-gray-600">กำลังโหลดข้อมูล...</p>
					</section>
				{:else}
					<section class="space-y-6">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<span class="text-xl">📋</span>
								<h2 class="text-xl font-bold text-gray-800">การลงทุนทั้งหมด ({filteredInvestments.length})</h2>
							</div>
							<div class="text-sm font-medium text-slate-500">
								Showing {filteredInvestments.length} from {investments.length} items
							</div>
						</div>

							<!-- Filter Results Info -->

							<div class="mt-4 flex flex-wrap gap-2 text-sm text-gray-600">
								<span
									>แสดงผล: <strong class="text-pink-600">{filteredInvestments.length}</strong> จาก
									<strong>{investments.length}</strong> รายการ</span
								>
								{#if filterStatus !== 'all'}
									<span class="rounded-full bg-pink-100 px-2 py-1 text-pink-800">
										สถานะ: {filterStatus === 'active'
											? 'กำลังดำเนินการ'
											: filterStatus === 'completed'
												? 'เสร็จสิ้น'
												: 'ยกเลิก'}
									</span>
								{/if}
								{#if searchQuery.trim()}
									<span class="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
										ค้นหา: "{searchQuery}"
									</span>
								{/if}
							</div>



						{#each filteredInvestments as investment (investment.id)}
							<div
								class="rounded-lg border border-pink-200 bg-white p-6 shadow-lg {investment.status ===
								'active'
									? 'border-l-4 border-l-green-500'
									: investment.status === 'completed'
										? 'border-l-4 border-l-blue-500'
										: 'border-l-4 border-l-gray-400'}"
							>
								<div class="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between">
									<div class="mb-2 lg:mb-0">
										<h4 class="text-lg font-semibold text-gray-800">
											{investment.product_type || 'การลงทุน'} #{investment.id}
											{#if investment.supplier}
												<small class="text-sm font-normal text-gray-500"
													>จาก {investment.supplier}</small
												>
											{/if}
										</h4>
									</div>
									<div>
										<span
											class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {investment.status ===
											'active'
												? 'bg-green-100 text-green-800'
												: investment.status === 'completed'
													? 'bg-blue-100 text-blue-800'
													: 'bg-gray-100 text-gray-800'}"
											>{investment.status === 'active'
												? 'กำลังดำเนินการ'
												: investment.status === 'completed'
													? 'เสร็จสิ้น'
													: 'ยกเลิก'}</span
										>
									</div>
								</div>

								<!-- Progress Bar -->
								{#if investment.status === 'active' && investment.expected_return}
									<div class="mb-4">
										<div class="mb-2 h-3 w-full rounded-full bg-gray-200">
											<div
												class="h-3 rounded-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-300"
												style="width: {calculateProgress(investment)}%"
											></div>
										</div>
										<span class="text-sm text-gray-600">
											ได้รับแล้ว {calculateProgress(investment)}% ({(
												investment.current_received || 0
											).toLocaleString()}/{investment.expected_return.toLocaleString()} บาท)
										</span>
									</div>
								{/if}

								<div class="space-y-4">
									<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
										<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
											<span class="text-2xl">💰</span>
											<div>
												<span class="block text-sm text-gray-600">เงินลงทุน</span>
												<span class="font-semibold text-gray-800"
													>{parseFloat(investment.amount).toLocaleString()} บาท</span
												>
											</div>
										</div>

										<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
											<span class="text-2xl">💵</span>
											<div class="flex-1">
												<span class="block text-sm text-gray-600">ได้รับแล้ว</span>
												<div class="flex items-center gap-2">
													<span class="font-semibold text-green-600"
														>{(investment.current_received || 0).toLocaleString()} บาท</span
													>
													<button
														class="rounded bg-pink-500 px-2 py-1 text-xs text-white transition-colors hover:bg-pink-600"
														on:click={() => quickUpdateReceived(investment)}>+เพิ่ม</button
													>
												</div>
											</div>
										</div>

										<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
											<span class="text-2xl">🎯</span>
											<div>
												<span class="block text-sm text-gray-600">เป้าหมาย</span>
												<span class="font-semibold text-gray-800">
													{investment.expected_return
														? parseFloat(investment.expected_return).toLocaleString() + ' บาท'
														: 'ไม่ระบุ'}
												</span>
											</div>
										</div>

										<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
											<span class="text-2xl">📈</span>
											<div>
												<span class="block text-sm text-gray-600">ROI ปัจจุบัน</span>
												<span class="font-semibold">
													{#if calculateROI(investment)}
														<span
															class={parseFloat(calculateROI(investment) || '0') >= 0
																? 'text-green-600'
																: 'text-red-600'}
														>
															{calculateROI(investment)}%
														</span>
													{:else}
														<span class="text-gray-500">ยังไม่มีข้อมูล</span>
													{/if}
												</span>
											</div>
										</div>

										<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
											<span class="text-2xl">📅</span>
											<div>
												<span class="block text-sm text-gray-600">วันที่เริ่ม</span>
												<span class="font-semibold text-gray-800">{investment.start_date}</span>
											</div>
										</div>

										<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
											<span class="text-2xl">⏱️</span>
											<div>
												<span class="block text-sm text-gray-600">ระยะเวลาที่ผ่านมา</span>
												<span class="font-semibold text-gray-800"
													>{calculateDaysRunning(investment.start_date)} วัน</span
												>
											</div>
										</div>

										{#if investment.end_date}
											<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
												<span class="text-2xl">🏁</span>
												<div>
													<span class="block text-sm text-gray-600">วันที่สิ้นสุด</span>
													<span class="font-semibold text-gray-800">{investment.end_date}</span>
												</div>
											</div>

											{#if investment.status === 'active'}
												<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
													<span class="text-2xl">⏰</span>
													<div>
														<span class="block text-sm text-gray-600">เหลืออีก</span>
														<span
															class="font-semibold {calculateDaysLeft(investment.end_date) !==
																null && calculateDaysLeft(investment.end_date)! < 0
																? 'text-red-600'
																: 'text-gray-800'}"
														>
															{calculateDaysLeft(investment.end_date)} วัน
														</span>
													</div>
												</div>
											{/if}
										{/if}

										{#if investment.customer}
											<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
												<span class="text-2xl">🛒</span>
												<div>
													<span class="block text-sm text-gray-600">ช่องทางขาย</span>
													<span class="font-semibold text-gray-800">{investment.customer}</span>
												</div>
											</div>
										{/if}

										{#if investment.profit_margin}
											<div class="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
												<span class="text-2xl">📊</span>
												<div>
													<span class="block text-sm text-gray-600">กำไรคาดหวัง</span>
													<span class="font-semibold text-gray-800"
														>{investment.profit_margin}%</span
													>
												</div>
											</div>
										{/if}
									</div>

									{#if investment.notes}
										<div
											class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
										>
											<span class="mt-1 text-2xl">📝</span>
											<div>
												<span class="mb-1 block text-sm font-medium text-amber-800">หมายเหตุ:</span>
												<span class="text-amber-700">{investment.notes}</span>
											</div>
										</div>
									{/if}
								</div>

								<div class="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
									<button
										class="flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-blue-600"
										on:click={() => startEdit(investment)}
									>
										<span class="text-lg">✏️</span>
										แก้ไข
									</button>

									{#if investment.status === 'active'}
										<button
											class="flex items-center gap-2 rounded-md bg-green-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-green-600"
											on:click={() => updateInvestmentStatus(investment.id, 'completed')}
										>
											<span class="text-lg">✅</span>
											เสร็จสิ้น
										</button>
										<button
											class="flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-orange-600"
											on:click={() => updateInvestmentStatus(investment.id, 'cancelled')}
										>
											<span class="text-lg">❌</span>
											ยกเลิก
										</button>
									{:else if investment.status === 'completed' || investment.status === 'cancelled'}
										<button
											class="flex items-center gap-2 rounded-md bg-gray-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-gray-600"
											on:click={() => updateInvestmentStatus(investment.id, 'active')}
										>
											<span class="text-lg">🔄</span>
											เปิดใหม่
										</button>
									{/if}

									<button
										class="flex items-center gap-2 rounded-md bg-red-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-red-600"
										on:click={() => deleteInvestment(investment.id)}
									>
										<span class="text-lg">🗑️</span>
										ลบ
									</button>
								</div>
							</div>
						{/each}

						{#if filteredInvestments.length === 0}
							<div
								class="flex flex-col items-center justify-center rounded-lg border border-pink-200 bg-white py-16 shadow-lg"
							>
								{#if investments.length === 0}
									<div class="mb-4 text-6xl">💼</div>
									<h3 class="mb-2 text-2xl font-bold text-gray-800">ยังไม่มีการลงทุน</h3>
									<p class="mb-6 text-gray-600">เริ่มต้นติดตามการลงทุนของคุณวันนี้</p>
									<button
										class="flex items-center gap-2 rounded-md bg-pink-500 px-6 py-3 font-medium text-white transition-colors duration-200 hover:bg-pink-600"
										on:click={() => {
											showAddForm = true;
											resetForm();
										}}
									>
										<span class="text-lg">➕</span>
										เพิ่มการลงทุนแรก
									</button>
								{:else}
									<div class="mb-4 text-6xl">🔍</div>
									<h3 class="mb-2 text-2xl font-bold text-gray-800">ไม่พบข้อมูลที่ค้นหา</h3>
									<p class="mb-6 text-gray-600">ลองเปลี่ยนคำค้นหาหรือสถานะที่กรอง</p>
									<div class="flex gap-2">
										<button
											class="rounded-md bg-gray-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-gray-600"
											on:click={() => (searchQuery = '')}
										>
											ล้างการค้นหา
										</button>
										<button
											class="rounded-md bg-pink-500 px-4 py-2 font-medium text-white transition-colors duration-200 hover:bg-pink-600"
											on:click={() => {
												filterStatus = 'all';
												searchQuery = '';
											}}
										>
											รีเซ็ตตัวกรอง
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</section>
				{/if}
			</div>
		</main>

		<!-- Footer -->
		<footer class="bg-gradient-to-r from-pink-300 to-pink-500 py-8 text-center text-white">
			<div class="mx-auto max-w-6xl px-4">
				<h2 class="mb-2 text-lg font-semibold">
					This Website was made by Chulinxz, feel free to contact me anytime :D
				</h2>
				<p class="opacity-90">
					© Chulinx Folio, All Right Reserved | Implemented by Svelte+Supabase
				</p>
			</div>
		</footer>

		<!-- Transaction History Modal -->
		{#if showTransactionHistory}
			<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
				on:click={closeTransactionHistory}
			>
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					class="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
					on:click|stopPropagation={() => {}}
				>
					<!-- Modal Header -->
					<div class="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
						<div class="flex items-center justify-between">
							<div>
								<h2 class="flex items-center gap-2 text-2xl font-bold">
									<span>📜</span>
									ประวัติธุรกรรม
								</h2>
								<p class="mt-1 text-indigo-100">
									{#if selectedInvestmentForLogs}
										การลงทุน #{selectedInvestmentForLogs}
									{:else}
										ธุรกรรมทั้งหมด ({transactionLogs.length} รายการ)
									{/if}
								</p>
							</div>
							<button
								class="p-2 text-white transition-colors hover:text-indigo-200"
								on:click={closeTransactionHistory}
								aria-label="Close transaction history"
							>
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									></path>
								</svg>
							</button>
						</div>
					</div>

					<!-- Modal Body -->
					<div class="max-h-[calc(90vh-200px)] overflow-y-auto p-6">
						{#if transactionLoading}
							<div class="flex items-center justify-center py-12">
								<div
									class="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"
								></div>
							</div>
						{:else if transactionLogs.length === 0}
							<div class="py-12 text-center">
								<div class="mb-4 text-6xl">📭</div>
								<h3 class="mb-2 text-xl font-bold text-gray-700">ยังไม่มีประวัติธุรกรรม</h3>
								<p class="text-gray-500">เริ่มสร้างการลงทุนใหม่เพื่อดูประวัติที่นี่</p>
							</div>
						{:else}
							<!-- View Mode Toggle -->
							<div class="mb-4 flex justify-end">
								<div class="inline-flex rounded-lg border border-gray-200 bg-white p-1">
									<button
										class="rounded-md px-4 py-2 text-sm font-medium transition-colors {transactionViewMode ===
										'card'
											? 'bg-indigo-500 text-white'
											: 'text-gray-600 hover:text-gray-800'}"
										on:click={() => (transactionViewMode = 'card')}
									>
										<span class="mr-1">🃏</span> Card
									</button>
									<button
										class="rounded-md px-4 py-2 text-sm font-medium transition-colors {transactionViewMode ===
										'table'
											? 'bg-indigo-500 text-white'
											: 'text-gray-600 hover:text-gray-800'}"
										on:click={() => (transactionViewMode = 'table')}
									>
										<span class="mr-1">📋</span> Table
									</button>
								</div>
							</div>

							<!-- Card View -->
							{#if transactionViewMode === 'card'}
								<div class="space-y-4">
									{#each transactionLogs as log}
										{@const typeInfo = formatTransactionType(log.type)}
										<div
											class="rounded-xl border border-gray-200 bg-gray-50 p-4 transition-shadow hover:shadow-md"
										>
											<div class="flex items-start justify-between gap-4">
												<!-- Left: Icon & Type -->
												<div class="flex items-center gap-3">
													<div
														class="h-12 w-12 rounded-full {typeInfo.bg} flex items-center justify-center text-2xl"
													>
														{typeInfo.icon}
													</div>
													<div>
														<span
															class="inline-block rounded-full px-3 py-1 text-sm font-medium {typeInfo.bg} {typeInfo.color}"
														>
															{typeInfo.label}
														</span>
														<p class="mt-1 text-sm text-gray-500">
															{formatDate(log.transaction_date)}
														</p>
													</div>
												</div>

												<!-- Right: Amount -->
												<div class="text-right">
													<p
														class="text-xl font-bold {log.amount >= 0
															? 'text-green-600'
															: 'text-red-600'}"
													>
														{log.amount >= 0 ? '+' : ''}{formatCurrency(log.amount)} บาท
													</p>
													{#if log.type !== 'initial_investment'}
														<p class="text-sm text-gray-500">
															ยอดรวม: {formatCurrency(log.balance_after)} บาท
														</p>
													{/if}
												</div>
											</div>

											<!-- Details -->
											<div class="mt-3 border-t border-gray-200 pt-3">
												<div class="flex flex-wrap gap-x-6 gap-y-2 text-sm">
													{#if log.investments}
														<div class="flex items-center gap-1">
															<span class="text-gray-500">🏷️ การลงทุน:</span>
															<span class="font-medium">
																{log.investments.product_type || `#${log.investment_id}`}
															</span>
														</div>
														{#if log.investments.supplier}
															<div class="flex items-center gap-1">
																<span class="text-gray-500">🏭 Supplier:</span>
																<span class="font-medium">{log.investments.supplier}</span>
															</div>
														{/if}
														{#if log.investments.customer}
															<div class="flex items-center gap-1">
																<span class="text-gray-500">🛒 Customer:</span>
																<span class="font-medium">{log.investments.customer}</span>
															</div>
														{/if}
													{/if}
												</div>
												{#if log.notes}
													<p class="mt-2 text-sm text-gray-600">
														💬 {log.notes}
													</p>
												{/if}
												{#if log.type !== 'initial_investment'}
													<div class="mt-2 flex items-center gap-2 text-xs text-gray-400">
														<span>ก่อน: {formatCurrency(log.balance_before)} บาท</span>
														<span>→</span>
														<span>หลัง: {formatCurrency(log.balance_after)} บาท</span>
													</div>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{:else}
								<!-- Table View -->
								<div class="overflow-x-auto">
									<table class="w-full min-w-[800px]">
										<thead class="sticky top-0 bg-gray-100">
											<tr>
												<th
													class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
													>วันที่</th
												>
												<th
													class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
													>ประเภท</th
												>
												<th
													class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
													>การลงทุน</th
												>
												<th
													class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600"
													>จำนวนเงิน</th
												>
												<th
													class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600"
													>ยอดก่อน</th
												>
												<th
													class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600"
													>ยอดหลัง</th
												>
												<th
													class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600"
													>หมายเหตุ</th
												>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray-200">
											{#each transactionLogs as log, index}
												{@const typeInfo = formatTransactionType(log.type)}
												<tr
													class="transition-colors hover:bg-gray-50 {index % 2 === 0
														? 'bg-white'
														: 'bg-gray-50/50'}"
												>
													<!-- วันที่ -->
													<td class="whitespace-nowrap px-4 py-3">
														<div class="text-sm text-gray-900">
															{formatDate(log.transaction_date)}
														</div>
													</td>

													<!-- ประเภท -->
													<td class="whitespace-nowrap px-4 py-3">
														<span
															class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium {typeInfo.bg} {typeInfo.color}"
														>
															<span>{typeInfo.icon}</span>
															{typeInfo.label}
														</span>
													</td>

													<!-- การลงทุน -->
													<td class="px-4 py-3">
														<div class="text-sm font-medium text-gray-900">
															{log.investments?.product_type || `#${log.investment_id}`}
														</div>
														{#if log.investments?.supplier || log.investments?.customer}
															<div class="text-xs text-gray-500">
																{#if log.investments?.supplier}
																	<span>🏭 {log.investments.supplier}</span>
																{/if}
																{#if log.investments?.supplier && log.investments?.customer}
																	<span class="mx-1">•</span>
																{/if}
																{#if log.investments?.customer}
																	<span>🛒 {log.investments.customer}</span>
																{/if}
															</div>
														{/if}
													</td>

													<!-- จำนวนเงิน -->
													<td class="whitespace-nowrap px-4 py-3 text-right">
														<span
															class="text-sm font-bold {log.amount >= 0
																? 'text-green-600'
																: 'text-red-600'}"
														>
															{log.amount >= 0 ? '+' : ''}{formatCurrency(log.amount)}
														</span>
													</td>

													<!-- ยอดก่อน -->
													<td class="whitespace-nowrap px-4 py-3 text-right">
														<span class="text-sm text-gray-600">
															{log.type === 'initial_investment'
																? '-'
																: formatCurrency(log.balance_before)}
														</span>
													</td>

													<!-- ยอดหลัง -->
													<td class="whitespace-nowrap px-4 py-3 text-right">
														<span class="text-sm text-gray-600">
															{log.type === 'initial_investment'
																? '-'
																: formatCurrency(log.balance_after)}
														</span>
													</td>

													<!-- หมายเหตุ -->
													<td class="px-4 py-3">
														<div
															class="max-w-[200px] truncate text-sm text-gray-600"
															title={log.notes || ''}
														>
															{log.notes || '-'}
														</div>
													</td>
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							{/if}
						{/if}
					</div>

					<!-- Modal Footer -->
					<div class="border-t border-gray-200 bg-gray-50 px-6 py-4">
						<div class="flex items-center justify-between">
							<div class="text-sm text-gray-500">
								{#if transactionLogs.length > 0}
									แสดง {transactionLogs.length} รายการ
								{/if}
							</div>
							<button
								class="rounded-lg bg-gray-500 px-6 py-2 font-medium text-white transition-colors hover:bg-gray-600"
								on:click={closeTransactionHistory}
							>
								ปิด
							</button>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Charts Section Styles */
	.charts-section {
		margin-bottom: 3rem;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
		gap: 1.5rem;
	}

	.chart-card {
		background: white;
		border-radius: 1rem;
		padding: 1.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.chart-card.full-width {
		grid-column: 1 / -1;
	}

	.chart-title {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		margin-bottom: 1rem;
	}

	.chart-content {
		min-height: 150px;
	}

	/* ROI Bar Chart */
	.roi-bar {
		margin-bottom: 0.75rem;
	}

	.roi-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.25rem;
	}

	.roi-rank {
		font-weight: 600;
		color: #6b7280;
		font-size: 0.875rem;
		min-width: 1.5rem;
	}

	.roi-name {
		flex: 1;
		font-size: 0.875rem;
		color: #374151;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.roi-value {
		font-weight: 600;
		font-size: 0.875rem;
	}

	.roi-value.positive {
		color: #10b981;
	}

	.roi-value.negative {
		color: #ef4444;
	}

	.roi-bar-container {
		height: 8px;
		background: #e5e7eb;
		border-radius: 4px;
		overflow: hidden;
	}

	.roi-bar-fill {
		height: 100%;
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.roi-bar-fill.positive {
		background: linear-gradient(90deg, #10b981, #34d399);
	}

	.roi-bar-fill.negative {
		background: linear-gradient(90deg, #ef4444, #f87171);
	}

	/* Status Stats */
	.status-stats {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.status-indicator.active {
		background: #10b981;
	}

	.status-indicator.completed {
		background: #3b82f6;
	}

	.status-indicator.cancelled {
		background: #ef4444;
	}

	.status-label {
		flex: 1;
		font-size: 0.875rem;
		color: #374151;
	}

	.status-count {
		font-weight: 600;
		font-size: 1.125rem;
		color: #1f2937;
	}

	/* Monthly Chart */
	.monthly-chart {
		display: flex;
		justify-content: space-around;
		align-items: flex-end;
		height: 200px;
		gap: 1rem;
	}

	.monthly-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		flex: 1;
	}

	.monthly-bars {
		display: flex;
		gap: 4px;
		height: 150px;
		align-items: flex-end;
	}

	.bar-container {
		width: 20px;
		height: 100%;
		display: flex;
		align-items: flex-end;
	}

	.bar {
		width: 100%;
		border-radius: 4px 4px 0 0;
		transition: height 0.3s ease;
		min-height: 4px;
	}

	.bar.invested {
		background: linear-gradient(180deg, #ec4899, #f472b6);
	}

	.bar.received {
		background: linear-gradient(180deg, #10b981, #34d399);
	}

	.monthly-label {
		font-size: 0.75rem;
		color: #6b7280;
		margin-top: 0.5rem;
		text-align: center;
	}

	.monthly-count {
		font-size: 0.625rem;
		color: #9ca3af;
	}

	.chart-legend {
		display: flex;
		justify-content: center;
		gap: 1.5rem;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.legend-color {
		width: 12px;
		height: 12px;
		border-radius: 2px;
	}

	.legend-color.invested {
		background: linear-gradient(180deg, #ec4899, #f472b6);
	}

	.legend-color.received {
		background: linear-gradient(180deg, #10b981, #34d399);
	}

	/* Product Table */
	.product-table {
		width: 100%;
	}

	.table-header {
		display: grid;
		grid-template-columns: 2fr 1fr 1.5fr 1.5fr 1fr;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f3f4f6;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
	}

	.table-row {
		display: grid;
		grid-template-columns: 2fr 1fr 1.5fr 1.5fr 1fr;
		gap: 0.5rem;
		padding: 0.75rem;
		border-bottom: 1px solid #e5e7eb;
		font-size: 0.875rem;
		align-items: center;
	}

	.table-row:hover {
		background: #f9fafb;
	}

	.product-name {
		font-weight: 500;
		color: #1f2937;
	}

	.no-data {
		text-align: center;
		color: #9ca3af;
		padding: 2rem;
		font-size: 0.875rem;
	}

	/* Debug Info - hide in production */
	.debug-info {
		display: none; /* Change to 'block' to show debug info */
	}
</style>
