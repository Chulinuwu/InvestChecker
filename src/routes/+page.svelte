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
	let showTypeSelector = false; // NEW: Popup for selecting investment type
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
	let filterProductType = 'all'; // NEW: Filter by investment category
	let searchQuery = '';

	// Period Summary state
	let periodViewMode = 'monthly'; // 'weekly' | 'monthly'
	let periodSortField = 'period'; // 'period' | 'invested' | 'received' | 'profit' | 'roi' | 'count'
	let periodSortDirection = 'desc'; // 'asc' | 'desc'
	let sortOrder = 'latest'; // 'latest' | 'oldest' | 'amount_high' | 'amount_low'
	let summaryType = 'investments'; // 'investments' | 'logs'
	let showMobilePeriodSummaries = false; // NEW: Toggle monthly cards on mobile

	// Form data
	let formData = {
		amount: '',
		start_date: new Date().toISOString().split('T')[0],
		end_date: '',
		expected_return: '',
		notes: '',
		product_type: ''
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
				current_received: 0,
				status: 'active',
				notes: formData.notes,
				product_type: formData.product_type
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
				notes: formData.notes,
				product_type: formData.product_type
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
			notes: investment.notes || '',
			product_type: investment.product_type || ''
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
			notes: '',
			product_type: ''
		};
	}

	// NEW: Investment Type Selection
	const investmentTypes = [
		{
			id: 'investment',
			label: 'ค่าลงทุน',
			emoji: '💰',
			color: 'from-emerald-500 to-teal-500',
			bgColor: 'bg-emerald-50'
		},
		{
			id: 'shipping',
			label: 'ค่าส่ง',
			emoji: '📦',
			color: 'from-amber-500 to-orange-500',
			bgColor: 'bg-amber-50'
		},
		{
			id: 'lisa',
			label: 'ค่าลิซ่า',
			emoji: '💌',
			color: 'from-pink-500 to-rose-500',
			bgColor: 'bg-pink-50'
		},
		{
			id: 'collab',
			label: 'ค่าคอลแลป',
			emoji: '🤝',
			color: 'from-violet-500 to-purple-500',
			bgColor: 'bg-violet-50'
		},
		{
			id: 'other',
			label: 'ค่าอื่นๆ',
			emoji: '📋',
			color: 'from-slate-500 to-gray-600',
			bgColor: 'bg-slate-50'
		}
	];

	function openTypeSelector() {
		resetForm();
		showTypeSelector = true;
		showAddForm = false;
		showEditModal = false;
		editingInvestment = null;
		editModalInvestment = null;
	}

	function selectInvestmentType(typeId: string) {
		const selectedType = investmentTypes.find((t) => t.id === typeId);
		if (selectedType) {
			formData.product_type = selectedType.label;
		}
		showTypeSelector = false;
		showAddForm = true;
	}

	function closeTypeSelector() {
		showTypeSelector = false;
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
					product_type: 'ค่าส่ง'
				},
				{
					amount: 15000,
					start_date: '2024-10-15',
					end_date: '2024-11-15',
					expected_return: 18000,
					current_received: 18500,
					status: 'completed',
					notes: 'การลงทุนตัวอย่าง 2',
					product_type: 'ค่าลิซ่า'
				},
				{
					amount: 8000,
					start_date: '2024-12-01',
					end_date: '2025-01-01',
					expected_return: 9500,
					current_received: 5000,
					status: 'active',
					notes: 'การลงทุนตัวอย่าง 3',
					product_type: 'ค่าคอลแลป'
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

			// Filter by product type
			if (filterProductType !== 'all') {
				const investmentType = investment.product_type || 'ค่าลงทุน'; // Default to 'ค่าลงทุน' if empty
				if (investmentType !== filterProductType) {
					return false;
				}
			}

			// Filter by search query
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				return (
					(investment.product_type || '').toLowerCase().includes(query) ||
					(investment.notes || '').toLowerCase().includes(query) ||
					investment.id.toString().includes(query)
				);
			}

			return true;
		})
		.sort((a, b) => {
			if (sortOrder === 'latest') {
				return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
			} else if (sortOrder === 'oldest') {
				return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
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
					const dayOfYear = Math.floor(
						(date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
					);
					const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
					period = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
					periodLabel = `สัปดาห์ที่ ${weekNum}, ${date.getFullYear()}`;
				} else {
					period = inv.start_date.substring(0, 7); // YYYY-MM
					const monthNames = [
						'ม.ค.',
						'ก.พ.',
						'มี.ค.',
						'เม.ย.',
						'พ.ค.',
						'มิ.ย.',
						'ก.ค.',
						'ส.ค.',
						'ก.ย.',
						'ต.ค.',
						'พ.ย.',
						'ธ.ค.'
					];
					periodLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
				}

				if (!summaries.has(period)) {
					summaries.set(period, {
						period,
						periodLabel,
						invested: 0,
						received: 0,
						profit: 0,
						roi: 0,
						count: 0
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
					const dayOfYear = Math.floor(
						(date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)
					);
					const weekNum = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
					period = `${date.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`;
					periodLabel = `สัปดาห์ที่ ${weekNum}, ${date.getFullYear()}`;
				} else {
					const month = (date.getMonth() + 1).toString().padStart(2, '0');
					period = `${date.getFullYear()}-${month}`;
					const monthNames = [
						'ม.ค.',
						'ก.พ.',
						'มี.ค.',
						'เม.ย.',
						'พ.ค.',
						'มิ.ย.',
						'ก.ค.',
						'ส.ค.',
						'ก.ย.',
						'ต.ค.',
						'พ.ย.',
						'ธ.ค.'
					];
					periodLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
				}

				if (!summaries.has(period)) {
					summaries.set(period, {
						period,
						periodLabel,
						invested: 0,
						received: 0,
						profit: 0,
						roi: 0,
						count: 0
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
			summary.roi =
				summary.invested > 0 ? ((summary.received - summary.invested) / summary.invested) * 100 : 0;
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
		roi:
			periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0) > 0
				? ((periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.received, 0) -
						periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0)) /
						periodSummaries.reduce((sum: number, s: PeriodSummary) => sum + s.invested, 0)) *
					100
				: 0
	};

	function togglePeriodSort(
		field: 'period' | 'invested' | 'received' | 'profit' | 'roi' | 'count'
	) {
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

		return Object.entries(monthlyStats)
			.sort((a, b) => a[0].localeCompare(b[0]))
			.slice(-6); // 6 เดือนล่าสุด
	}

	function getROIComparisonData(invs: any[]) {
		return (invs || [])
			.filter(
				(inv) =>
					inv && (parseFloat(inv.current_received || 0) > 0 || parseFloat(inv.amount || 0) > 0)
			)
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
		const typeStats: Record<string, { count: number; totalAmount: number; totalReceived: number }> =
			{};

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
				roi:
					data.totalAmount > 0
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
		<header class="relative overflow-hidden py-12 text-white shadow-2xl">
			<!-- Banner Image Background with Overlays -->
			<div class="absolute inset-0 z-0">
				<img src="/Twentytoy.jpg" alt="Twenty Toys Shop" class="h-full w-full object-cover" />
				<!-- Primary Overlay: Deep blue tint for brand consistency -->
				<div class="absolute inset-0 bg-indigo-900/40"></div>
				<!-- Secondary Overlay: Gradient for better text readability -->
				<div
					class="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/40 to-transparent"
				></div>
				<!-- Light Blur for a premium feel -->
				<div class="absolute inset-0 backdrop-blur-[1px]"></div>
			</div>

			<div class="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4">
				<div class="flex-1">
					<div class="mb-2 flex items-center gap-3">
						<div class="h-10 w-1 rounded-full bg-white"></div>
						<h1 class="text-4xl font-black tracking-tight text-white drop-shadow-md">
							Twenty Toys
						</h1>
					</div>
					<p class="text-sm font-bold uppercase tracking-[0.2em] text-indigo-100/80 drop-shadow-sm">
						Investment Portfolio Tracker
					</p>
				</div>
				<button
					on:click={handleLogout}
					class="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-white/20 active:scale-95"
				>
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
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
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {summaryType ===
									'investments'
										? 'bg-white text-indigo-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (summaryType = 'investments')}
								>
									📂 Investment
								</button>
								<button
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {summaryType ===
									'logs'
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
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {periodViewMode ===
									'weekly'
										? 'bg-white text-teal-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (periodViewMode = 'weekly')}
								>
									📅 Weekly
								</button>
								<button
									class="rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all sm:px-4 sm:py-2 sm:text-xs {periodViewMode ===
									'monthly'
										? 'bg-white text-teal-600 shadow-sm'
										: 'text-slate-500 hover:text-slate-700'}"
									on:click={() => (periodViewMode = 'monthly')}
								>
									📆 Monthly
								</button>
							</div>
						</div>
					</div>

					<!-- Summary Cards -->
					<div class="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
						<div class="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 sm:p-4">
							<div
								class="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400 sm:text-xs"
							>
								ลงทุนรวม
							</div>
							<div class="text-base font-black tracking-tight text-slate-800 sm:text-xl">
								฿{periodTotals.invested.toLocaleString()}
							</div>
						</div>
						<div class="rounded-2xl bg-emerald-50/30 p-3 ring-1 ring-emerald-100/50 sm:p-4">
							<div
								class="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-600/60 sm:text-xs"
							>
								รับคืนรวม
							</div>
							<div class="text-base font-black tracking-tight text-emerald-600 sm:text-xl">
								฿{periodTotals.received.toLocaleString()}
							</div>
						</div>
						<div
							class="rounded-2xl {periodTotals.profit >= 0
								? 'bg-emerald-50/30'
								: 'bg-rose-50/30'} p-3 ring-1 sm:p-4 {periodTotals.profit >= 0
								? 'ring-emerald-100/50'
								: 'ring-rose-100/50'}"
						>
							<div
								class="mb-1 text-[10px] font-black uppercase tracking-widest sm:text-xs {periodTotals.profit >=
								0
									? 'text-emerald-600/60'
									: 'text-rose-600/60'}"
							>
								กำไร/ขาดทุน
							</div>
							<div
								class="text-base font-black sm:text-xl {periodTotals.profit >= 0
									? 'text-emerald-600'
									: 'text-rose-600'} tracking-tight"
							>
								{periodTotals.profit >= 0 ? '+' : ''}฿{periodTotals.profit.toLocaleString()}
							</div>
						</div>
						<div class="rounded-2xl bg-indigo-50/30 p-3 ring-1 ring-indigo-100/50 sm:p-4">
							<div
								class="mb-1 text-[10px] font-black uppercase tracking-widest text-indigo-600/60 sm:text-xs"
							>
								ROI เฉลี่ย
							</div>
							<div
								class="text-base font-black sm:text-xl {periodTotals.roi >= 0
									? 'text-indigo-600'
									: 'text-rose-600'} tracking-tight"
							>
								{periodTotals.roi >= 0 ? '+' : ''}{periodTotals.roi.toFixed(2)}%
							</div>
						</div>
					</div>

					<!-- Mobile Toggle for Period Summaries -->
					<div class="mb-4 sm:hidden">
						<button
							class="flex w-full items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-600 transition-all active:scale-[0.98]"
							on:click={() => (showMobilePeriodSummaries = !showMobilePeriodSummaries)}
						>
							<div class="flex items-center gap-2">
								<span>📊</span>
								<span>สรุปราย{periodViewMode === 'monthly' ? 'เดือน' : 'สัปดาห์'}</span>
							</div>
							<span
								class="text-xs transition-transform duration-300 {showMobilePeriodSummaries
									? 'rotate-180'
									: ''}"
							>
								▼
							</span>
						</button>
					</div>

					<!-- Data Summary View -->
					{#if periodSummaries.length > 0}
						<!-- Desktop Table View (Hidden on Mobile) -->
						<div class="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-slate-100 bg-slate-50/50">
										<th class="px-4 py-3 text-left">
											<button
												class="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-slate-400 hover:text-slate-600"
												on:click={() => togglePeriodSort('period')}
											>
												ช่วงเวลา
												{#if periodSortField === 'period'}
													<span class="text-indigo-600"
														>{periodSortDirection === 'asc' ? '↑' : '↓'}</span
													>
												{/if}
											</button>
										</th>
										<th
											class="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-400"
											>รายการ</th
										>
										<th
											class="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-400"
											>ลงทุน</th
										>
										<th
											class="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-400"
											>คืน</th
										>
										<th
											class="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-400"
											>กำไร</th
										>
										<th
											class="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-slate-400"
											>ROI</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-100">
									{#each periodSummaries as summary (summary.period)}
										<tr class="transition-colors hover:bg-slate-50/50">
											<td class="px-4 py-3">
												<div class="text-sm font-black leading-tight text-slate-800">
													{summary.periodLabel}
												</div>
												<div class="text-[0.625rem] font-bold text-slate-400">{summary.period}</div>
											</td>
											<td class="px-4 py-3 text-right">
												<span
													class="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-black text-slate-500"
												>
													{summary.count}
												</span>
											</td>
											<td class="px-4 py-3 text-right text-sm font-bold text-slate-700">
												฿{summary.invested.toLocaleString()}
											</td>
											<td class="px-4 py-3 text-right text-sm font-bold text-emerald-600">
												฿{summary.received.toLocaleString()}
											</td>
											<td
												class="px-4 py-3 text-right text-sm font-black {summary.profit >= 0
													? 'text-emerald-600'
													: 'text-rose-600'}"
											>
												{summary.profit >= 0 ? '+' : ''}฿{summary.profit.toLocaleString()}
											</td>
											<td class="px-4 py-3 text-right">
												<span
													class="rounded-lg px-2 py-0.5 text-xs font-black {summary.roi >= 0
														? 'bg-emerald-50 text-emerald-600'
														: 'bg-rose-50 text-rose-600'}"
												>
													{summary.roi >= 0 ? '+' : ''}{summary.roi.toFixed(1)}%
												</span>
											</td>
										</tr>
									{/each}
								</tbody>
								<tfoot>
									<tr class="border-t-2 border-slate-200 bg-slate-50/50 font-black">
										<td class="px-4 py-4 text-sm uppercase tracking-widest text-slate-900"
											>รวมทั้งหมด</td
										>
										<td class="px-4 py-4 text-right text-xs text-slate-400"
											>{periodTotals.count} รายการ</td
										>
										<td class="px-4 py-4 text-right text-sm text-slate-900"
											>฿{periodTotals.invested.toLocaleString()}</td
										>
										<td class="px-4 py-4 text-right text-sm text-emerald-600"
											>฿{periodTotals.received.toLocaleString()}</td
										>
										<td
											class="px-4 py-4 text-right text-sm {periodTotals.profit >= 0
												? 'text-emerald-600'
												: 'text-rose-600'}"
										>
											฿{periodTotals.profit.toLocaleString()}
										</td>
										<td class="px-4 py-4 text-right">
											<span
												class="text-xs font-black {periodTotals.roi >= 0
													? 'text-indigo-600'
													: 'text-rose-600'}"
											>
												{periodTotals.roi.toFixed(1)}%
											</span>
										</td>
									</tr>
								</tfoot>
							</table>
						</div>

						<!-- Mobile Stacked Card View (Visible only on Mobile) -->
						{#if showMobilePeriodSummaries}
							<div class="space-y-3 sm:hidden">
								{#each periodSummaries as summary (summary.period)}
									<div
										class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/50 transition-all active:scale-[0.98]"
									>
										<div
											class="mb-3 flex items-center justify-between border-b border-slate-50 pb-2"
										>
											<div>
												<div class="text-xs font-black tracking-tight text-slate-800">
													{summary.periodLabel}
												</div>
												<div
													class="text-[0.625rem] font-bold uppercase tracking-wider text-slate-400"
												>
													{summary.period}
												</div>
											</div>
											<span
												class="rounded-lg bg-slate-50 px-2 py-1 text-[0.625rem] font-black text-slate-400 ring-1 ring-slate-100"
											>
												{summary.count} รายการ
											</span>
										</div>

										<div class="grid grid-cols-2 gap-x-4">
											<div class="space-y-2 border-r border-slate-50 pr-4">
												<div>
													<div
														class="text-[0.625rem] font-black uppercase tracking-widest text-slate-300"
													>
														กระแสเงิน
													</div>
													<div class="mt-1 flex flex-col gap-0.5">
														<div class="text-[0.7rem] font-bold text-slate-600">
															ลง: ฿{summary.invested.toLocaleString()}
														</div>
														<div class="text-[0.7rem] font-bold text-emerald-600">
															คืน: ฿{summary.received.toLocaleString()}
														</div>
													</div>
												</div>
											</div>
											<div class="pl-0">
												<div>
													<div
														class="text-[0.625rem] font-black uppercase tracking-widest text-slate-300"
													>
														ผลประกอบการ
													</div>
													<div class="mt-1 flex flex-col items-start gap-1">
														<div
															class="text-[0.75rem] font-black {summary.profit >= 0
																? 'text-emerald-600'
																: 'text-rose-600'}"
														>
															{summary.profit >= 0 ? '+' : ''}฿{summary.profit.toLocaleString()}
														</div>
														<div
															class="rounded-md px-1.5 py-0.5 text-[0.625rem] font-black {summary.roi >=
															0
																? 'bg-emerald-50 text-emerald-600'
																: 'bg-rose-50 text-rose-600'}"
														>
															{summary.roi >= 0 ? '+' : ''}{summary.roi.toFixed(1)}%
														</div>
													</div>
												</div>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
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

				<!-- Dashboard Controls (Action Bar) -->
				<section class="mb-10 space-y-6">
					<!-- Top Row: Main Actions -->
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex flex-wrap items-center gap-3">
							<button
								class="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-indigo-100 transition-all duration-300 hover:-translate-y-1 hover:bg-indigo-700 hover:shadow-indigo-200 active:scale-95"
								on:click={() => {
									if (showAddForm || showTypeSelector) {
										showAddForm = false;
										showTypeSelector = false;
									} else {
										openTypeSelector();
									}
								}}
							>
								{#if showAddForm || showTypeSelector}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="3"
											d="M6 18L18 6M6 6l12 12"
										/></svg
									>
									ปิดหน้าฟอร์ม
								{:else}
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="3"
											d="M12 4v16m8-8H4"
										/></svg
									>
									เพิ่มการลงทุนใหม่
								{/if}
							</button>

							<div
								class="flex items-center gap-1 rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200"
							>
								<button
									class="flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black transition-all {showCharts
										? 'bg-indigo-50 text-indigo-600'
										: 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (showCharts = !showCharts)}
								>
									📊 สถิติ
								</button>
								<div class="mx-1 h-4 w-px bg-slate-200"></div>
								<button
									class="flex h-11 items-center gap-2 rounded-xl px-4 text-xs font-black transition-all {showTransactionHistory
										? 'bg-purple-50 text-purple-600'
										: 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => openTransactionHistory(null)}
								>
									📜 ประวัติ log
								</button>
							</div>
						</div>
					</div>

					<!-- Filter Panel: Structured & Aligned -->
					<div
						class="rounded-3xl bg-slate-50/50 p-6 ring-1 ring-slate-100 transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50"
					>
						<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
							<!-- Group 1: Status -->
							<div class="space-y-3">
								<div class="flex items-center gap-2">
									<div class="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
									<span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
										>Filter by Status</span
									>
								</div>
								<div class="flex flex-wrap gap-2">
									<button
										class="rounded-xl px-5 py-2.5 text-xs font-black transition-all {filterStatus ===
										'all'
											? 'bg-slate-900 text-white shadow-lg shadow-slate-200'
											: 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}"
										on:click={() => (filterStatus = 'all')}
									>
										ทั้งหมด
									</button>
									<button
										class="rounded-xl px-5 py-2.5 text-xs font-black transition-all {filterStatus ===
										'active'
											? 'bg-orange-500 text-white shadow-lg shadow-orange-100'
											: 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}"
										on:click={() => (filterStatus = 'active')}
									>
										กำลังลงทุน (Active)
									</button>
									<button
										class="rounded-xl px-5 py-2.5 text-xs font-black transition-all {filterStatus ===
										'completed'
											? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100'
											: 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}"
										on:click={() => (filterStatus = 'completed')}
									>
										จบแล้ว (Completed)
									</button>
								</div>
							</div>

							<!-- Group 2: Category -->
							<div class="space-y-3">
								<div class="flex items-center gap-2">
									<div class="h-1.5 w-1.5 rounded-full bg-slate-300"></div>
									<span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"
										>Filter by Category</span
									>
								</div>
								<div class="flex flex-wrap gap-2">
									<button
										class="rounded-xl px-5 py-2.5 text-xs font-black transition-all {filterProductType ===
										'all'
											? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
											: 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}"
										on:click={() => (filterProductType = 'all')}
									>
										ทุกประเภท
									</button>
									{#each investmentTypes as type}
										<button
											class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition-all {filterProductType ===
											type.label
												? 'bg-white text-slate-800 shadow-md ring-2 ring-indigo-500/20'
												: 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}"
											on:click={() => (filterProductType = type.label)}
										>
											<span>
												{#if type.label === 'ค่าลงทุน'}
													💰
												{:else if type.label === 'ค่าส่ง'}
													📦
												{:else if type.label === 'ค่าลิซ่า'}
													💌
												{:else if type.label === 'ค่าคอลแลป'}
													🤝
												{:else}
													📋
												{/if}
											</span>
											{type.label}
										</button>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</section>

				<!-- Search & Filter Bar Renovated -->
				<section class="mb-8 rounded-[2rem] bg-indigo-900/5 p-6 backdrop-blur-sm">
					<div class="flex flex-col gap-4 md:flex-row md:items-center">
						<div class="flex-shrink-0">
							<span class="flex items-center gap-2 text-sm font-bold text-indigo-900">
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2.5"
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/></svg
								>
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
						<div
							class="flex items-center gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200"
						>
							<div class="flex items-center gap-1 overflow-x-auto whitespace-nowrap p-1">
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder ===
									'latest'
										? 'bg-indigo-600 text-white'
										: 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'latest')}
								>
									Latest
								</button>
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder ===
									'oldest'
										? 'bg-indigo-600 text-white'
										: 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'oldest')}
								>
									Oldest
								</button>
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder ===
									'amount_high'
										? 'bg-indigo-600 text-white'
										: 'text-slate-500 hover:bg-slate-50'}"
									on:click={() => (sortOrder = 'amount_high')}
								>
									฿ High
								</button>
								<button
									class="rounded-xl px-3 py-2 text-xs font-bold transition-all {sortOrder ===
									'amount_low'
										? 'bg-indigo-600 text-white'
										: 'text-slate-500 hover:bg-slate-50'}"
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

				<!-- Investment Type Selector Popup -->
				{#if showTypeSelector}
					<div
						class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
						on:click|self={closeTypeSelector}
					>
						<div
							class="mx-4 w-full max-w-lg scale-100 transform rounded-3xl bg-white p-8 shadow-2xl transition-all"
						>
							<div class="mb-8 text-center">
								<div
									class="mb-3 inline-flex items-center justify-center rounded-2xl bg-indigo-100 p-4"
								>
									<svg
										class="h-8 w-8 text-indigo-600"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 6v6m0 0v6m0-6h6m-6 0H6"
										/>
									</svg>
								</div>
								<h3 class="text-2xl font-bold text-slate-800">เลือกประเภทการลงทุน</h3>
								<p class="mt-1 text-sm text-slate-500">กรุณาเลือกประเภทของรายการนี้</p>
							</div>

							<div class="grid grid-cols-2 gap-4">
								<!-- ค่าลงทุน (New) -->
								<button
									class="group relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-100"
									on:click={() => selectInvestmentType('investment')}
								>
									<div class="mb-3 text-4xl">💰</div>
									<div class="text-lg font-bold text-emerald-700">ค่าลงทุน</div>
									<div class="text-xs text-emerald-600/70">Capital, ลงทุนหลัก</div>
									<div
										class="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-emerald-200/30 transition-transform group-hover:scale-150"
									></div>
								</button>

								<!-- ค่าส่ง -->
								<button
									class="group relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-100"
									on:click={() => selectInvestmentType('shipping')}
								>
									<div class="mb-3 text-4xl">📦</div>
									<div class="text-lg font-bold text-amber-700">ค่าส่ง</div>
									<div class="text-xs text-amber-600/70">ค่าขนส่ง, ค่าพัสดุ</div>
									<div
										class="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-amber-200/30 transition-transform group-hover:scale-150"
									></div>
								</button>

								<!-- ค่าลิซ่า -->
								<button
									class="group relative overflow-hidden rounded-2xl border-2 border-pink-200 bg-pink-50 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-pink-400 hover:shadow-lg hover:shadow-pink-100"
									on:click={() => selectInvestmentType('lisa')}
								>
									<div class="mb-3 text-4xl">💌</div>
									<div class="text-lg font-bold text-pink-700">ค่าลิซ่า</div>
									<div class="text-xs text-pink-600/70">Lisa, LINE Delivery</div>
									<div
										class="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-pink-200/30 transition-transform group-hover:scale-150"
									></div>
								</button>

								<!-- ค่าคอลแลป -->
								<button
									class="group relative overflow-hidden rounded-2xl border-2 border-violet-200 bg-violet-50 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-violet-400 hover:shadow-lg hover:shadow-violet-100"
									on:click={() => selectInvestmentType('collab')}
								>
									<div class="mb-3 text-4xl">🤝</div>
									<div class="text-lg font-bold text-violet-700">ค่าคอลแลป</div>
									<div class="text-xs text-violet-600/70">Collaboration, ร่วมมือ</div>
									<div
										class="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-violet-200/30 transition-transform group-hover:scale-150"
									></div>
								</button>

								<!-- ค่าอื่นๆ -->
								<button
									class="group relative overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-slate-400 hover:shadow-lg hover:shadow-slate-100"
									on:click={() => selectInvestmentType('other')}
								>
									<div class="mb-3 text-4xl">📋</div>
									<div class="text-lg font-bold text-slate-700">ค่าอื่นๆ</div>
									<div class="text-xs text-slate-600/70">รายการทั่วไป</div>
									<div
										class="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-slate-200/30 transition-transform group-hover:scale-150"
									></div>
								</button>
							</div>

							<button
								class="mt-6 w-full rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200"
								on:click={closeTypeSelector}
							>
								ยกเลิก
							</button>
						</div>
					</div>
				{/if}

				<!-- Add Investment Form -->
				{#if showAddForm}
					<section
						class="relative overflow-hidden rounded-[2.5rem] bg-white shadow-2xl ring-1 ring-slate-200 transition-all duration-500"
					>
						<!-- Decorative Background -->
						<div
							class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-50/50 blur-3xl"
						></div>
						<div
							class="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-pink-50/50 blur-3xl"
						></div>

						<div class="relative p-8 sm:p-12">
							<div class="mb-10 text-center">
								<div
									class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl shadow-inner"
								>
									➕
								</div>
								<h3 class="text-3xl font-black tracking-tight text-slate-800">เพิ่มการลงทุนใหม่</h3>
								{#if formData.product_type}
									<div
										class="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-black uppercase tracking-widest shadow-sm
										{formData.product_type === 'ค่าลงทุน'
											? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
											: ''}
										{formData.product_type === 'ค่าส่ง' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200' : ''}
										{formData.product_type === 'ค่าลิซ่า' ? 'bg-pink-100 text-pink-700 ring-1 ring-pink-200' : ''}
										{formData.product_type === 'ค่าคอลแลป'
											? 'bg-violet-100 text-violet-700 ring-1 ring-violet-200'
											: ''}
										{formData.product_type === 'ค่าอื่นๆ' ? 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' : ''}
									"
									>
										<span>
											{formData.product_type === 'ค่าลงทุน' ? '💰' : ''}
											{formData.product_type === 'ค่าส่ง' ? '📦' : ''}
											{formData.product_type === 'ค่าลิซ่า' ? '💌' : ''}
											{formData.product_type === 'ค่าคอลแลป' ? '🤝' : ''}
											{formData.product_type === 'ค่าอื่นๆ' ? '📋' : ''}
										</span>
										{formData.product_type}
									</div>
								{/if}
							</div>

							<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
								<div class="space-y-2">
									<label
										for="amount"
										class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
										>จำนวนเงินลงทุน (บาท) *</label
									>
									<div class="relative">
										<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
											>💰</span
										>
										<input
											type="number"
											id="amount"
											bind:value={formData.amount}
											placeholder="0.00"
											class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
								</div>

								<div class="space-y-2">
									<label
										for="start_date"
										class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
										>วันที่เริ่มต้น *</label
									>
									<div class="relative">
										<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
											>📅</span
										>
										<input
											type="date"
											id="start_date"
											bind:value={formData.start_date}
											class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
								</div>

								<div class="space-y-2">
									<label
										for="end_date"
										class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
										>วันที่คาดว่าจะจบ</label
									>
									<div class="relative">
										<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
											>🏁</span
										>
										<input
											type="date"
											id="end_date"
											bind:value={formData.end_date}
											class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
								</div>

								<div class="space-y-2">
									<label
										for="expected_return"
										class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
										>เป้าหมาย (บาท)</label
									>
									<div class="relative">
										<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
											>🎯</span
										>
										<input
											type="number"
											id="expected_return"
											bind:value={formData.expected_return}
											placeholder="0.00"
											class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
										/>
									</div>
								</div>

								<div class="space-y-2 md:col-span-2">
									<label
										for="notes"
										class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
										>หมายเหตุ / รายละเอียด</label
									>
									<div class="relative">
										<span class="absolute left-4 top-4 text-xl opacity-40">📝</span>
										<textarea
											id="notes"
											bind:value={formData.notes}
											placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับการลงทุนนี้..."
											class="min-h-[120px] w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-medium text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
										></textarea>
									</div>
								</div>
							</div>

							<div class="mt-10 flex flex-col gap-4 sm:flex-row">
								<button
									class="group flex flex-1 items-center justify-center gap-3 rounded-[1.5rem] bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-100 transition-all hover:-translate-y-1 hover:bg-indigo-700 active:scale-95"
									on:click={addInvestment}
								>
									<span class="transition-transform group-hover:scale-125">💾</span>
									บันทึกการลงทุน
								</button>
								<button
									class="flex flex-1 items-center justify-center gap-3 rounded-[1.5rem] bg-slate-100 py-5 text-lg font-black text-slate-600 transition-all hover:bg-slate-200 active:scale-95"
									on:click={() => {
										showAddForm = false;
										resetForm();
									}}
								>
									<span>✕</span>
									ยกเลิก
								</button>
							</div>
						</div>
					</section>
				{/if}

				<!-- Received Amount Modal -->
				{#if showReceivedModal && modalInvestment}
					<div
						class="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300"
						style="background: rgba(15, 23, 42, 0.6);"
						on:click={closeReceivedModal}
						role="dialog"
						aria-modal="true"
					>
						<div
							class="relative max-h-[90vh] w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-2xl transition-all duration-500"
							on:click|stopPropagation={() => {}}
						>
							<!-- Header -->
							<div class="bg-emerald-50/50 p-8 text-center">
								<div
									class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-emerald-100"
								>
									💵
								</div>
								<h3 class="text-2xl font-black tracking-tight text-slate-800">
									เพิ่มยอดเงินที่ได้รับ
								</h3>
								<p class="mt-1 text-sm font-bold text-emerald-600">
									{modalInvestment.product_type} #{modalInvestment.id}
								</p>
							</div>

							<div class="space-y-6 p-8">
								<div class="grid grid-cols-2 gap-4">
									<div class="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
										<div
											class="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400"
										>
											ลงทุน
										</div>
										<div class="text-sm font-black text-slate-800">
											฿{parseFloat(modalInvestment.amount).toLocaleString()}
										</div>
									</div>
									<div class="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
										<div
											class="mb-1 text-[10px] font-black uppercase tracking-widest text-emerald-600"
										>
											ได้รับแล้ว
										</div>
										<div class="text-sm font-black text-emerald-600">
											฿{(modalInvestment.current_received || 0).toLocaleString()}
										</div>
									</div>
								</div>

								<div class="space-y-2">
									<label
										for="received-amount"
										class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
										>เงินที่ได้รับเพิ่ม (บาท)</label
									>
									<div class="relative">
										<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
											>➕</span
										>
										<input
											type="number"
											id="received-amount"
											bind:value={receivedAmount}
											placeholder="0.00"
											autofocus
											class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
										/>
									</div>
								</div>

								{#if receivedAmount && !isNaN(parseFloat(receivedAmount))}
									<div class="mt-4 rounded-2xl bg-slate-900 p-5 shadow-xl shadow-slate-200">
										<div
											class="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-slate-400"
										>
											<span>Total Sum</span>
											<span class="text-emerald-400">Preview</span>
										</div>
										<div class="flex items-baseline justify-between">
											<span class="text-2xl font-black text-white"
												>฿{(
													(modalInvestment.current_received || 0) + parseFloat(receivedAmount)
												).toLocaleString()}</span
											>
											<span class="text-xs font-bold text-emerald-400"
												>+{parseFloat(receivedAmount).toLocaleString()}</span
											>
										</div>
									</div>
								{/if}
							</div>

							<div class="flex flex-col gap-3 p-8 pt-0">
								<button
									class="w-full rounded-[1.5rem] bg-emerald-500 py-5 text-lg font-black text-white shadow-xl shadow-emerald-100 transition-all hover:bg-emerald-600 active:scale-95 disabled:opacity-50 disabled:grayscale"
									on:click={updateReceivedAmount}
									disabled={!receivedAmount ||
										isNaN(parseFloat(receivedAmount)) ||
										parseFloat(receivedAmount) <= 0}
								>
									บันทึกข้อมูล
								</button>
								<button
									class="w-full rounded-[1.5rem] bg-slate-100 py-4 text-sm font-black text-slate-500 transition-all hover:bg-slate-200"
									on:click={closeReceivedModal}
								>
									ยกเลิก
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Edit Investment Modal -->
				{#if showEditModal && editModalInvestment}
					<div
						class="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm transition-all duration-300"
						style="background: rgba(15, 23, 42, 0.6);"
						on:click={closeEditModal}
						role="dialog"
						aria-modal="true"
					>
						<div
							class="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] bg-white shadow-2xl transition-all duration-500"
							on:click|stopPropagation={() => {}}
						>
							<div class="sticky top-0 z-10 bg-white/80 p-8 pb-4 backdrop-blur-md">
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-4">
										<div
											class="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl shadow-inner"
										>
											✏️
										</div>
										<h3 class="text-2xl font-black tracking-tight text-slate-800">
											แก้ไขข้อมูลการลงทุน
										</h3>
									</div>
									<button
										class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
										on:click={closeEditModal}>✕</button
									>
								</div>
							</div>

							<div class="space-y-8 p-8 pt-4">
								<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
									<div class="space-y-2">
										<label
											for="edit-amount"
											class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
											>จำนวนเงินลงทุน (บาท) *</label
										>
										<div class="relative">
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
												>💰</span
											>
											<input
												id="edit-amount"
												type="number"
												bind:value={formData.amount}
												required
												class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
											/>
										</div>
									</div>

									<div class="space-y-2">
										<label
											for="edit-start-date"
											class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
											>วันที่เริ่มลงทุน *</label
										>
										<div class="relative">
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
												>📅</span
											>
											<input
												id="edit-start-date"
												type="date"
												bind:value={formData.start_date}
												required
												class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
											/>
										</div>
									</div>

									<div class="space-y-2">
										<label
											for="edit-end-date"
											class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
											>วันที่คาดว่าจบ</label
										>
										<div class="relative">
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
												>🏁</span
											>
											<input
												id="edit-end-date"
												type="date"
												bind:value={formData.end_date}
												class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
											/>
										</div>
									</div>

									<div class="space-y-2">
										<label
											for="edit-expected-return"
											class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
											>เป้าหมาย (บาท)</label
										>
										<div class="relative">
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl opacity-40"
												>🎯</span
											>
											<input
												id="edit-expected-return"
												type="number"
												bind:value={formData.expected_return}
												class="w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-bold text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
											/>
										</div>
									</div>

									<div class="space-y-3 md:col-span-2">
										<label class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
											>ประเภทการลงทุน</label
										>
										<div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
											<button
												type="button"
												class="flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-300 {formData.product_type ===
												'ค่าลงทุน'
													? 'border-emerald-400 bg-emerald-50 shadow-lg ring-4 ring-emerald-100'
													: 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'}"
												on:click={() => (formData.product_type = 'ค่าลงทุน')}
											>
												<span class="text-3xl">💰</span>
												<span
													class="text-xs font-black {formData.product_type === 'ค่าลงทุน'
														? 'text-emerald-700'
														: 'text-slate-400'}">ค่าลงทุน</span
												>
											</button>
											<button
												type="button"
												class="flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-300 {formData.product_type ===
												'ค่าส่ง'
													? 'border-amber-400 bg-amber-50 shadow-lg ring-4 ring-amber-100'
													: 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'}"
												on:click={() => (formData.product_type = 'ค่าส่ง')}
											>
												<span class="text-3xl">📦</span>
												<span
													class="text-xs font-black {formData.product_type === 'ค่าส่ง'
														? 'text-amber-700'
														: 'text-slate-400'}">ค่าส่ง</span
												>
											</button>
											<button
												type="button"
												class="flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-300 {formData.product_type ===
												'ค่าลิซ่า'
													? 'border-pink-400 bg-pink-50 shadow-lg ring-4 ring-pink-100'
													: 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'}"
												on:click={() => (formData.product_type = 'ค่าลิซ่า')}
											>
												<span class="text-3xl">💌</span>
												<span
													class="text-xs font-black {formData.product_type === 'ค่าลิซ่า'
														? 'text-pink-700'
														: 'text-slate-400'}">ค่าลิซ่า</span
												>
											</button>
											<button
												type="button"
												class="flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-300 {formData.product_type ===
												'ค่าคอลแลป'
													? 'border-violet-400 bg-violet-50 shadow-lg ring-4 ring-violet-100'
													: 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'}"
												on:click={() => (formData.product_type = 'ค่าคอลแลป')}
											>
												<span class="text-3xl">🤝</span>
												<span
													class="text-xs font-black {formData.product_type === 'ค่าคอลแลป'
														? 'text-violet-700'
														: 'text-slate-400'}">ค่าคอลแลป</span
												>
											</button>
											<button
												type="button"
												class="flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all duration-300 {formData.product_type ===
												'ค่าอื่นๆ'
													? 'border-slate-400 bg-slate-100 shadow-lg ring-4 ring-slate-100'
													: 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-white'}"
												on:click={() => (formData.product_type = 'ค่าอื่นๆ')}
											>
												<span class="text-3xl">📋</span>
												<span
													class="text-xs font-black {formData.product_type === 'ค่าอื่นๆ'
														? 'text-slate-700'
														: 'text-slate-400'}">ค่าอื่นๆ</span
												>
											</button>
										</div>
									</div>

									<div class="space-y-2 md:col-span-2">
										<label
											for="edit-notes"
											class="ml-1 text-xs font-black uppercase tracking-widest text-slate-400"
											>หมายเหตุ</label
										>
										<div class="relative">
											<span class="absolute left-4 top-4 text-xl opacity-40">📝</span>
											<textarea
												id="edit-notes"
												bind:value={formData.notes}
												class="min-h-[120px] w-full rounded-2xl bg-slate-50 py-4 pl-12 pr-4 text-lg font-medium text-slate-800 ring-1 ring-inset ring-slate-100 transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
											></textarea>
										</div>
									</div>
								</div>

								<div class="flex flex-col gap-4 pt-4 sm:flex-row">
									<button
										class="flex-1 rounded-[1.5rem] bg-indigo-600 py-5 text-lg font-black text-white shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
										on:click={updateInvestment}
									>
										บันทึกการแก้ไข
									</button>
									<button
										class="flex-1 rounded-[1.5rem] bg-slate-100 py-5 text-lg font-black text-slate-500 transition-all hover:bg-slate-200"
										on:click={closeEditModal}
									>
										ยกเลิก
									</button>
								</div>
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
								<h2 class="text-xl font-bold text-gray-800">
									การลงทุนทั้งหมด ({filteredInvestments.length})
								</h2>
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
								class="group relative overflow-hidden rounded-[1.5rem] bg-white shadow-lg ring-1 ring-slate-200 transition-all duration-300 hover:shadow-xl"
							>
								<div class="relative p-5 sm:p-8">
									<!-- Header Area: More Compact -->
									<div class="mb-5 flex items-start justify-between">
										<div class="flex items-center gap-3">
											<div
												class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl shadow-inner transition-transform group-hover:rotate-6"
											>
												{#if investment.product_type === 'ค่าลงทุน' || !investment.product_type}
													💰
												{:else if investment.product_type === 'ค่าส่ง'}
													📦
												{:else if investment.product_type === 'ค่าลิซ่า'}
													💌
												{:else if investment.product_type === 'ค่าคอลแลป'}
													🤝
												{:else if investment.product_type === 'ค่าอื่นๆ'}
													📋
												{:else}
													💰
												{/if}
											</div>
											<div class="min-w-0">
												<h4 class="truncate text-lg font-black tracking-tight text-slate-800">
													{investment.product_type || 'ค่าลงทุน'}
													<span class="text-indigo-400 opacity-60">#{investment.id}</span>
												</h4>
												<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
													{new Date(investment.start_date).toLocaleDateString('th-TH')}
												</p>
											</div>
										</div>

										<span
											class="flex-shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm
											{investment.status === 'active' ? 'bg-amber-100 text-amber-700' : ''}
											{investment.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : ''}
											{investment.status === 'cancelled' ? 'bg-slate-100 text-slate-700' : ''}"
										>
											{investment.status === 'active'
												? 'Active'
												: investment.status === 'completed'
													? 'Done'
													: 'N/A'}
										</span>
									</div>

									<!-- Stats Grid: 2 columns on mobile, 3 on desktop -->
									<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
										<!-- Invested -->
										<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
											<div
												class="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400"
											>
												ลงทุน
											</div>
											<div class="text-sm font-black text-slate-800">
												฿{parseFloat(investment.amount).toLocaleString()}
											</div>
										</div>

										<!-- Received -->
										<div
											class="relative rounded-xl bg-emerald-50/50 p-3 ring-1 ring-inset ring-emerald-100"
										>
											<div
												class="mb-1 text-[9px] font-black uppercase tracking-widest text-emerald-600/60"
											>
												ได้รับ
											</div>
											<div class="flex items-center justify-between gap-1">
												<div class="truncate text-sm font-black text-emerald-600">
													฿{(investment.current_received || 0).toLocaleString()}
												</div>
												<button
													class="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-[10px] text-white shadow-sm hover:bg-emerald-600"
													on:click={() => quickUpdateReceived(investment)}>+</button
												>
											</div>
										</div>

										<!-- ROI -->
										<div class="rounded-xl bg-indigo-50/50 p-3 ring-1 ring-inset ring-indigo-100">
											<div
												class="mb-1 text-[9px] font-black uppercase tracking-widest text-indigo-600/60"
											>
												กำไร
											</div>
											{#if calculateROI(investment)}
												<div
													class="text-sm font-black {parseFloat(calculateROI(investment) || '0') >=
													0
														? 'text-indigo-600'
														: 'text-rose-600'}"
												>
													{calculateROI(investment)}%
												</div>
											{:else}
												<div class="text-xs font-bold text-slate-400">N/A</div>
											{/if}
										</div>

										<!-- Target -->
										<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
											<div
												class="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400"
											>
												เป้าหมาย
											</div>
											<div class="truncate text-sm font-black text-slate-800">
												{investment.expected_return
													? '฿' + parseFloat(investment.expected_return).toLocaleString()
													: '-'}
											</div>
										</div>

										<!-- Duration (Mobile Optimized hide/smaller) -->
										<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
											<div
												class="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400"
											>
												ระยะเวลา
											</div>
											<div class="text-sm font-black text-slate-800">
												{calculateDaysRunning(investment.start_date)} วัน
											</div>
										</div>

										<!-- End Date / Status -->
										<div class="rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
											<div
												class="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-400"
											>
												สิ้นสุด
											</div>
											<div class="text-xs font-black text-slate-800">
												{investment.end_date || '-'}
											</div>
										</div>
									</div>

									<!-- Slim Progress Section -->
									{#if investment.status === 'active' && investment.expected_return}
										<div class="mt-4">
											<div
												class="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest"
											>
												<span class="text-slate-400">Progress</span>
												<span class="text-indigo-600">{calculateProgress(investment)}%</span>
											</div>
											<div class="h-2 w-full overflow-hidden rounded-full bg-slate-100">
												<div
													class="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-1000"
													style="width: {calculateProgress(investment)}%"
												></div>
											</div>
										</div>
									{/if}

									<!-- Action Buttons: Tighter Row -->
									<div class="mt-5 flex gap-2">
										<button
											class="flex-1 rounded-xl bg-slate-900 py-3 text-xs font-black text-white transition-all hover:bg-slate-800 active:scale-95"
											on:click={() => startEdit(investment)}
										>
											แก้ไข
										</button>

										{#if investment.status === 'active'}
											<button
												class="flex-1 rounded-xl bg-emerald-500 py-3 text-xs font-black text-white transition-all hover:bg-emerald-600 active:scale-95"
												on:click={() => updateInvestmentStatus(investment.id, 'completed')}
											>
												จบ
											</button>
										{:else}
											<button
												class="flex-1 rounded-xl bg-indigo-500 py-3 text-xs font-black text-white transition-all hover:bg-indigo-600 active:scale-95"
												on:click={() => updateInvestmentStatus(investment.id, 'active')}
											>
												เปิด
											</button>
										{/if}

										<button
											class="flex h-[44px] w-[20%] items-center justify-center rounded-xl bg-rose-50 text-rose-500 ring-1 ring-rose-100 transition-all hover:bg-rose-500 hover:text-white"
											on:click={() => deleteInvestment(investment.id)}
										>
											🗑️
										</button>
									</div>
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
