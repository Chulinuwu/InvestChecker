<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { fade } from 'svelte/transition';

	// Types
	interface Investment {
		id: number;
		amount: number;
		start_date: string;
		end_date: string | null;
		expected_return: number | null;
		current_received: number;
		status: 'active' | 'completed' | 'cancelled';
		notes: string | null;
		product_type: string | null;
		supplier: string | null;
		customer: string | null;
		profit_margin: number | null;
		created_at: string;
	}

	interface PeriodSummary {
		period: string;
		periodLabel: string;
		invested: number;
		received: number;
		profit: number;
		roi: number;
		count: number;
	}

	// State
	let investments: Investment[] = $state([]);
	let loading = $state(true);
	let viewMode: 'weekly' | 'monthly' = $state('monthly');
	let sortField: 'period' | 'invested' | 'received' | 'profit' | 'roi' | 'count' = $state('period');
	let sortDirection: 'asc' | 'desc' = $state('desc');

	// Fetch investments
	async function fetchInvestments() {
		loading = true;
		const { data, error } = await supabase
			.from('investments')
			.select('*')
			.order('start_date', { ascending: false });

		if (error) {
			console.error('Error fetching investments:', error);
		} else {
			investments = data || [];
		}
		loading = false;
	}

	onMount(() => {
		// Check auth
		const savedAdminAuth = localStorage.getItem('isAdminAuthenticated');
		if (savedAdminAuth !== 'true') {
			goto('/');
			return;
		}
		fetchInvestments();
	});

	// Calculate summaries
	let periodSummaries = $derived.by(() => {
		const summaries = new Map<string, PeriodSummary>();

		investments.forEach((inv) => {
			const date = new Date(inv.start_date);
			let period: string;
			let periodLabel: string;

			if (viewMode === 'weekly') {
				// Get week number
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
			summary.invested += inv.amount;
			summary.received += inv.current_received || 0;
			summary.count += 1;
		});

		// Calculate profit and ROI
		summaries.forEach((summary) => {
			summary.profit = summary.received - summary.invested;
			summary.roi = summary.invested > 0 ? ((summary.received - summary.invested) / summary.invested) * 100 : 0;
		});

		// Sort
		let sortedArray = Array.from(summaries.values());
		sortedArray.sort((a, b) => {
			let comparison = 0;
			switch (sortField) {
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
			return sortDirection === 'asc' ? comparison : -comparison;
		});

		return sortedArray;
	});

	// Totals
	let totals = $derived({
		invested: periodSummaries.reduce((sum, s) => sum + s.invested, 0),
		received: periodSummaries.reduce((sum, s) => sum + s.received, 0),
		profit: periodSummaries.reduce((sum, s) => sum + s.profit, 0),
		count: periodSummaries.reduce((sum, s) => sum + s.count, 0),
		get roi() {
			return this.invested > 0 ? ((this.received - this.invested) / this.invested) * 100 : 0;
		}
	});

	function toggleSort(field: typeof sortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'desc';
		}
	}

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('th-TH', {
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}
</script>

<div class="min-h-screen bg-slate-50 pb-20 text-slate-900">
	<!-- Navbar -->
	<nav class="sticky top-0 z-10 bg-white/80 px-3 py-3 backdrop-blur-md md:px-8 md:py-4">
		<div class="mx-auto flex max-w-7xl items-center justify-between gap-2">
			<div class="flex items-center gap-2">
				<div
					class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg"
				>
					<span class="text-base font-bold">TT</span>
				</div>
				<h1
					class="hidden bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent sm:block"
				>
					Investments
				</h1>
			</div>

			<div class="flex rounded-lg bg-slate-100 p-1">
				<button
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all sm:w-24 sm:text-sm text-slate-500 hover:text-slate-700"
					onclick={() => goto('/backoffice')}
				>
					Products
				</button>
				<button
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all sm:w-24 sm:text-sm text-slate-500 hover:text-slate-700"
					onclick={() => goto('/backoffice/sets')}
				>
					Sets
				</button>
				<button
					class="w-20 rounded-md py-1.5 text-[10px] font-medium transition-all sm:w-28 sm:text-sm bg-white text-indigo-600 shadow-sm"
				>
					Investments
				</button>
				<button
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all sm:w-24 sm:text-sm text-slate-500 hover:text-slate-700"
					onclick={() => goto('/backoffice/settings')}
				>
					Settings
				</button>
			</div>

			<button
				onclick={() => {
					localStorage.removeItem('isAdminAuthenticated');
					goto('/');
				}}
				class="flex-shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-red-500 sm:px-4 sm:py-2 sm:text-sm"
			>
				Logout
			</button>
		</div>
	</nav>

	<main class="mx-auto max-w-7xl px-4 py-8 md:px-8">
		<!-- Header -->
		<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div>
				<h2 class="text-2xl font-bold text-slate-900">📊 Investment Reports</h2>
				<p class="text-sm text-slate-500">สรุปข้อมูลการลงทุนตามช่วงเวลา</p>
			</div>

			<!-- View Mode Toggle -->
			<div class="flex items-center gap-3">
				<span class="text-sm font-medium text-slate-600">แสดงเป็น:</span>
				<div class="flex rounded-xl bg-slate-100 p-1">
					<button
						class="rounded-lg px-4 py-2 text-sm font-medium transition-all {viewMode === 'weekly'
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => (viewMode = 'weekly')}
					>
						📅 รายสัปดาห์
					</button>
					<button
						class="rounded-lg px-4 py-2 text-sm font-medium transition-all {viewMode === 'monthly'
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => (viewMode = 'monthly')}
					>
						📆 รายเดือน
					</button>
				</div>
			</div>
		</div>

		<!-- Summary Cards -->
		<div class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
				<div class="mb-2 text-sm font-medium text-slate-500">💰 ลงทุนรวม</div>
				<div class="text-2xl font-bold text-slate-900">฿{formatCurrency(totals.invested)}</div>
			</div>
			<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
				<div class="mb-2 text-sm font-medium text-slate-500">💵 รับคืนรวม</div>
				<div class="text-2xl font-bold text-emerald-600">฿{formatCurrency(totals.received)}</div>
			</div>
			<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
				<div class="mb-2 text-sm font-medium text-slate-500">📈 กำไร/ขาดทุน</div>
				<div class="text-2xl font-bold {totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
					{totals.profit >= 0 ? '+' : ''}฿{formatCurrency(totals.profit)}
				</div>
			</div>
			<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
				<div class="mb-2 text-sm font-medium text-slate-500">📊 ROI เฉลี่ย</div>
				<div class="text-2xl font-bold {totals.roi >= 0 ? 'text-indigo-600' : 'text-rose-600'}">
					{totals.roi >= 0 ? '+' : ''}{totals.roi.toFixed(2)}%
				</div>
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center py-20">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
			</div>
		{:else if periodSummaries.length === 0}
			<div class="rounded-2xl bg-white p-12 text-center shadow-sm ring-1 ring-slate-100">
				<div class="mb-4 text-5xl">📭</div>
				<h3 class="text-lg font-bold text-slate-700">ยังไม่มีข้อมูลการลงทุน</h3>
				<p class="text-slate-500">เพิ่มข้อมูลที่หน้าหลักก่อนนะครับ</p>
			</div>
		{:else}
			<!-- Data Table -->
			<div class="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" transition:fade>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead>
							<tr class="border-b border-slate-100 bg-slate-50/50">
								<th class="px-6 py-4 text-left">
									<button
										class="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
										onclick={() => toggleSort('period')}
									>
										ช่วงเวลา
										{#if sortField === 'period'}
											<span class="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 text-right">
									<button
										class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
										onclick={() => toggleSort('count')}
									>
										จำนวน
										{#if sortField === 'count'}
											<span class="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 text-right">
									<button
										class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
										onclick={() => toggleSort('invested')}
									>
										ลงทุน
										{#if sortField === 'invested'}
											<span class="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 text-right">
									<button
										class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
										onclick={() => toggleSort('received')}
									>
										รับคืน
										{#if sortField === 'received'}
											<span class="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 text-right">
									<button
										class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
										onclick={() => toggleSort('profit')}
									>
										กำไร/ขาดทุน
										{#if sortField === 'profit'}
											<span class="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
										{/if}
									</button>
								</th>
								<th class="px-6 py-4 text-right">
									<button
										class="flex items-center justify-end gap-1 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700"
										onclick={() => toggleSort('roi')}
									>
										ROI
										{#if sortField === 'roi'}
											<span class="text-indigo-600">{sortDirection === 'asc' ? '↑' : '↓'}</span>
										{/if}
									</button>
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each periodSummaries as summary (summary.period)}
								<tr class="transition-colors hover:bg-slate-50/50">
									<td class="px-6 py-4">
										<div class="font-bold text-slate-900">{summary.periodLabel}</div>
										<div class="text-xs text-slate-400">{summary.period}</div>
									</td>
									<td class="px-6 py-4 text-right">
										<span class="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
											{summary.count} รายการ
										</span>
									</td>
									<td class="px-6 py-4 text-right font-medium text-slate-700">
										฿{formatCurrency(summary.invested)}
									</td>
									<td class="px-6 py-4 text-right font-medium text-emerald-600">
										฿{formatCurrency(summary.received)}
									</td>
									<td class="px-6 py-4 text-right font-bold {summary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
										{summary.profit >= 0 ? '+' : ''}฿{formatCurrency(summary.profit)}
									</td>
									<td class="px-6 py-4 text-right">
										<span
											class="rounded-full px-3 py-1 text-sm font-bold {summary.roi >= 0
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
							<tr class="border-t-2 border-slate-200 bg-slate-50">
								<td class="px-6 py-4 font-bold text-slate-900">รวมทั้งหมด</td>
								<td class="px-6 py-4 text-right font-bold text-slate-700">{totals.count} รายการ</td>
								<td class="px-6 py-4 text-right font-bold text-slate-900">฿{formatCurrency(totals.invested)}</td>
								<td class="px-6 py-4 text-right font-bold text-emerald-600">฿{formatCurrency(totals.received)}</td>
								<td class="px-6 py-4 text-right font-bold {totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
									{totals.profit >= 0 ? '+' : ''}฿{formatCurrency(totals.profit)}
								</td>
								<td class="px-6 py-4 text-right">
									<span
										class="rounded-full px-3 py-1 text-sm font-bold {totals.roi >= 0
											? 'bg-indigo-100 text-indigo-700'
											: 'bg-rose-100 text-rose-700'}"
									>
										{totals.roi >= 0 ? '+' : ''}{totals.roi.toFixed(2)}%
									</span>
								</td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>

			<!-- Visual Chart (Simple Bar) -->
			<div class="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100" transition:fade>
				<h3 class="mb-6 text-lg font-bold text-slate-900">📊 กราฟเปรียบเทียบ</h3>
				<div class="space-y-4">
					{#each periodSummaries.slice(0, 10) as summary (summary.period)}
						<div class="flex items-center gap-4">
							<div class="w-24 flex-shrink-0 text-sm font-medium text-slate-600">{summary.periodLabel}</div>
							<div class="flex-1">
								<div class="relative h-8 overflow-hidden rounded-full bg-slate-100">
									<!-- Invested bar -->
									<div
										class="absolute inset-y-0 left-0 bg-indigo-500 transition-all"
										style="width: {((summary.invested / Math.max(...periodSummaries.map((s) => s.invested))) * 100).toFixed(1)}%"
									></div>
									<!-- Received bar (overlay) -->
									<div
										class="absolute inset-y-0 left-0 bg-emerald-500/70 transition-all"
										style="width: {((summary.received / Math.max(...periodSummaries.map((s) => s.invested))) * 100).toFixed(1)}%"
									></div>
								</div>
							</div>
							<div class="w-20 text-right text-sm font-bold {summary.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
								{summary.profit >= 0 ? '+' : ''}{summary.roi.toFixed(1)}%
							</div>
						</div>
					{/each}
				</div>
				<div class="mt-4 flex justify-center gap-6 text-xs">
					<div class="flex items-center gap-2">
						<div class="h-3 w-3 rounded-full bg-indigo-500"></div>
						<span class="text-slate-600">ลงทุน</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="h-3 w-3 rounded-full bg-emerald-500"></div>
						<span class="text-slate-600">รับคืน</span>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>
