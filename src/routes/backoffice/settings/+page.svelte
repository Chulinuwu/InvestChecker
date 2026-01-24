<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fade, slide } from 'svelte/transition';
	import { goto } from '$app/navigation';

	// Types
	interface ConfigItem {
		id: string;
		key: string;
		value: string;
		description: string | null;
		updated_at: string;
	}

	// State
	let configs: ConfigItem[] = $state([]);
	let loading = $state(true);
	let saving = $state(false);
	let saveSuccess = $state(false);

	// Editable config values
	let pricePerItem = $state(50);
	let pricePerSet = $state(150);

	// Fetch Config
	async function fetchConfigs() {
		loading = true;
		const { data, error } = await supabase
			.from('config')
			.select('*')
			.order('key');

		if (error) {
			console.error('Error fetching configs:', error);
		} else {
			configs = data || [];
			// Map to local state
			for (const cfg of configs) {
				if (cfg.key === 'preorder_price_per_item') {
					pricePerItem = parseInt(cfg.value, 10) || 50;
				} else if (cfg.key === 'preorder_price_per_set') {
					pricePerSet = parseInt(cfg.value, 10) || 150;
				}
			}
		}
		loading = false;
	}

	async function saveConfigs() {
		saving = true;
		saveSuccess = false;

		try {
			// Update price per item
			const { error: err1 } = await supabase
				.from('config')
				.update({ value: pricePerItem.toString() })
				.eq('key', 'preorder_price_per_item');

			if (err1) {
				// If not exists, insert
				await supabase.from('config').upsert({
					key: 'preorder_price_per_item',
					value: pricePerItem.toString(),
					description: 'ราคามัดจำพรีสินค้าเดี่ยว (บาท/ชิ้น)'
				}, { onConflict: 'key' });
			}

			// Update price per set
			const { error: err2 } = await supabase
				.from('config')
				.update({ value: pricePerSet.toString() })
				.eq('key', 'preorder_price_per_set');

			if (err2) {
				// If not exists, insert
				await supabase.from('config').upsert({
					key: 'preorder_price_per_set',
					value: pricePerSet.toString(),
					description: 'ราคามัดจำพรีเซตสินค้า (บาท/เซต)'
				}, { onConflict: 'key' });
			}

			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 3000);
		} catch (error) {
			console.error('Error saving configs:', error);
			alert('เกิดข้อผิดพลาดในการบันทึก');
		} finally {
			saving = false;
		}
	}

	onMount(() => {
		fetchConfigs();
	});
</script>

<div class="min-h-screen bg-slate-50 pb-20 text-slate-900 md:pb-10">
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
					Backoffice
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
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all text-slate-500 hover:text-slate-700 sm:w-24 sm:text-sm"
					onclick={() => goto('/backoffice/sets')}
				>
					Sets
				</button>
				<button
					class="w-20 rounded-md py-1.5 text-[10px] font-medium transition-all text-slate-500 hover:text-slate-700 sm:w-28 sm:text-sm"
					onclick={() => goto('/backoffice?tab=preorders')}
				>
					Pre-orders
				</button>
				<button
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all bg-white text-indigo-600 shadow-sm sm:w-24 sm:text-sm"
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

	<main class="mx-auto max-w-3xl px-4 py-8 md:px-8">
		<div class="mb-8 flex items-center gap-3">
			<div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
				<svg class="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.1 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.1c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.1-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.1z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			</div>
			<div>
				<h2 class="text-2xl font-bold text-slate-800">Settings</h2>
				<p class="text-sm text-slate-500">จัดการการตั้งค่าระบบและราคามัดจำ</p>
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center py-20">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"></div>
			</div>
		{:else}
			<!-- Pricing Config Card -->
			<div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" transition:fade>
				<div class="mb-6 flex items-center gap-3 border-b border-slate-100 pb-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div>
						<h3 class="font-bold text-slate-800">ราคามัดจำพรีออเดอร์</h3>
						<p class="text-xs text-slate-400">ค่าเริ่มต้นสำหรับการสั่งพรีสินค้าผ่าน LINE BOT</p>
					</div>
				</div>

				<div class="grid gap-6 md:grid-cols-2">
					<!-- Price per item -->
					<div class="rounded-xl border border-slate-200 bg-slate-50/30 p-4 transition-all focus-within:ring-2 focus-within:ring-indigo-100">
						<div class="mb-3 flex items-center gap-2">
							<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
								<svg class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
								</svg>
							</div>
							<div>
								<p class="text-sm font-bold text-slate-800">สินค้าเดี่ยว</p>
								<p class="text-[10px] text-slate-400 uppercase">Per Item Deposit</p>
							</div>
						</div>
						<div class="relative">
							<span class="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">฿</span>
							<input
								type="number"
								min="0"
								step="10"
								bind:value={pricePerItem}
								class="w-full rounded-xl border-slate-200 py-3 pl-10 pr-16 text-2xl font-bold text-slate-800 focus:border-indigo-500 focus:ring-indigo-500"
							/>
							<span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">/ชิ้น</span>
						</div>
					</div>

					<!-- Price per set -->
					<div class="rounded-xl border border-indigo-100 bg-indigo-50/20 p-4 transition-all focus-within:ring-2 focus-within:ring-purple-100">
						<div class="mb-3 flex items-center gap-2">
							<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-indigo-100">
								<svg class="h-4 w-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
								</svg>
							</div>
							<div>
								<p class="text-sm font-bold text-indigo-900">เซตสินค้า</p>
								<p class="text-[10px] text-indigo-400 uppercase">Set Bundle Deposit</p>
							</div>
						</div>
						<div class="relative">
							<span class="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-indigo-300">฿</span>
							<input
								type="number"
								min="0"
								step="10"
								bind:value={pricePerSet}
								class="w-full rounded-xl border-indigo-200 py-3 pl-10 pr-16 text-2xl font-bold text-indigo-900 focus:border-indigo-500 focus:ring-indigo-500"
							/>
							<span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-indigo-400">/เซต</span>
						</div>
					</div>
				</div>

				<!-- Preview -->
				<div class="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
					<div class="mb-3 flex items-center gap-2">
						<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
						</svg>
						<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">ประมาณการสรุปยอด</p>
					</div>
					<div class="space-y-2 text-sm text-slate-600">
						<div class="flex justify-between items-center py-1 border-b border-slate-200/50">
							<span>สั่งสินค้าเดี่ยว 3 ชิ้น</span>
							<span class="font-bold text-slate-800">฿{(pricePerItem * 3).toLocaleString()}</span>
						</div>
						<div class="flex justify-between items-center py-1 border-b border-slate-200/50">
							<span>สั่งเซตพรีเมียม 2 เซต</span>
							<span class="font-bold text-indigo-600">฿{(pricePerSet * 2).toLocaleString()}</span>
						</div>
						<div class="flex justify-between items-center py-1">
							<span class="text-xs text-slate-400">ยอดรวมสำหรับชุดสินค้าผสม</span>
							<span class="font-bold text-slate-900">฿{(pricePerItem * 2 + pricePerSet).toLocaleString()}</span>
						</div>
					</div>
				</div>

				<!-- Save Button -->
				<div class="mt-8 flex items-center gap-4">
					<button
						onclick={saveConfigs}
						disabled={saving}
						class="flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-400"
					>
						{#if saving}
							<svg class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Saving...
						{:else}
							บันทึกการตั้งค่า
						{/if}
					</button>

					{#if saveSuccess}
						<div class="flex items-center gap-2 text-emerald-600" transition:slide={{ axis: 'x' }}>
							<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-xs font-bold">Changes saved successfully</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- Info -->
			<div class="mt-6 rounded-xl border border-slate-200 bg-white p-4">
				<div class="flex gap-3">
					<div class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50">
						<svg class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="text-xs text-slate-500 leading-relaxed">
						<p class="font-bold text-slate-700">ข้อควรทราบ</p>
						<p class="mt-0.5">ราคามัดจำที่ตั้งค่าไว้จะถูกนำไปใช้โดยอัตโนมัติเมื่อลูกค้าสั่งพรีออเดอร์ผ่าน LINE BOT โดยจะไม่มีผลกับออเดอร์ที่ถูกบันทึกไปก่อนหน้านี้</p>
					</div>
				</div>
			</div>
		{/if}
	</main>
</div>
