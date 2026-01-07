<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fade, slide, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';

	// Types
	interface Product {
		id: string;
		product_code: string;
		product_name: string;
		price: number;
		total_preorder_qty: number;
		remaining_qty: number;
		image_url: string | null;
		description: string | null;
		is_active: boolean;
		created_at: string;
	}

	interface PreorderLog {
		id: string;
		order_group_id: string;
		product_code: string;
		product_name: string;
		user_line_id: string;
		user_display_name: string | null;
		quantity: number;
		total_price: number;
		status: string;
		payment_status: boolean;
		created_at: string;
	}

	interface GroupedOrder {
		order_group_id: string;
		user_line_id: string;
		user_display_name: string | null;
		items: PreorderLog[];
		total_items: number;
		total_price: number;
		status: string;
		payment_status: boolean;
		created_at: string;
	}

	// State
	let activeTab = $state('products'); // products | preorders
	let products: Product[] = $state([]);
	let preorderLogs: PreorderLog[] = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');
	let openDropdownId = $state<string | null>(null);
	let selectedItems = $state<Set<string>>(new Set());

	// Confirmation Modal State
	let showConfirmModal = $state(false);
	let confirmConfig = $state({
		title: '',
		message: '',
		confirmText: 'Confirm',
		cancelText: 'Cancel',
		type: 'info', // info | warning | danger
		onConfirm: async () => {}
	});

	function closeConfirmModal() {
		showConfirmModal = false;
	}

	// Modal State
	let showModal = $state(false);
	let modalMode = $state('add'); // add | edit
	let editingProduct: Product | null = $state(null);
	let formData = $state({
		product_code: '',
		product_name: '',
		price: 0,
		total_preorder_qty: 0,
		remaining_qty: 0,
		description: '',
		image_url: '',
		is_active: true
	});

	let selectedFile: File | null = $state(null);
	let uploading = $state(false);

	// Fetch Data
	async function fetchProducts() {
		loading = true;
		const { data, error } = await supabase
			.from('products')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) console.error('Error fetching products:', error);
		else products = data || [];
		loading = false;
	}

	async function fetchPreorders() {
		loading = true;
		const { data, error } = await supabase
			.from('preorder_logs')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) console.error('Error fetching preorders:', error);
		else preorderLogs = data || [];
		loading = false;
	}

	// Actions
	async function toggleActive(product: Product) {
		const { error } = await supabase
			.from('products')
			.update({ is_active: !product.is_active })
			.eq('id', product.id);

		if (!error) {
			const index = products.findIndex((p) => p.id === product.id);
			if (index !== -1) products[index].is_active = !products[index].is_active;
		}
	}

	async function processUpdateOrderStatus(logId: string, newStatus: string) {
		const { error } = await supabase
			.from('preorder_logs')
			.update({ status: newStatus })
			.eq('id', logId);

		if (error) {
			alert('Error updating status: ' + error.message);
		} else {
			const index = preorderLogs.findIndex((l) => l.id === logId);
			if (index !== -1) {
				const oldStatus = preorderLogs[index].status;
				preorderLogs[index].status = newStatus;

				// Notify if changed to complete and was not already complete
				if (newStatus === 'complete' && oldStatus !== 'complete' && oldStatus !== 'completed') {
					console.log(`[Individual Notify] Triggering notification for item ${logId}`);
					const item = preorderLogs[index];
					try {
						const backendUrl = import.meta.env.VITE_BACKEND_URL;
						fetch(`${backendUrl}/api/notify-arrived`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								userLineId: item.user_line_id,
								items: [item]
							})
						});
					} catch (e) {
						console.error('Failed to notify user for single item:', e);
					}
				}
			}
		}
		showConfirmModal = false; // Close modal on success
	}

	async function updateOrderStatus(logId: string, newStatus: string) {
		// ถ้าจะเปลี่ยนเป็น complete (Product arrived) ให้ Confirm ก่อน
		if (newStatus === 'complete') {
			confirmConfig = {
				title: 'Confirm Product Arrival',
				message:
					'Are you sure you want to mark this item as ARRIVED? This will send a notification to the customer immediately.',
				confirmText: 'Yes, Notify Customer',
				cancelText: 'Cancel',
				type: 'info',
				onConfirm: async () => await processUpdateOrderStatus(logId, newStatus)
			};
			showConfirmModal = true;
		} else {
			// สถานะอื่นอัพเดตเลย
			await processUpdateOrderStatus(logId, newStatus);
		}
	}

	// อัปเดตสถานะทั้ง group พร้อมกัน
	async function updateGroupStatus(orderGroupId: string, newStatus: string) {
		const { error } = await supabase
			.from('preorder_logs')
			.update({ status: newStatus })
			.eq('order_group_id', orderGroupId);

		if (error) {
			alert('Error updating group status: ' + error.message);
		} else {
			// อัปเดต local state ทุก item ที่อยู่ในกลุ่มเดียวกัน
			preorderLogs = preorderLogs.map((log) =>
				log.order_group_id === orderGroupId ? { ...log, status: newStatus } : log
			);
		}
	}

	async function updatePaymentStatus(orderGroupId: string, newPaidStatus: boolean) {
		const { error } = await supabase
			.from('preorder_logs')
			.update({ payment_status: newPaidStatus })
			.eq('order_group_id', orderGroupId);

		if (error) {
			alert('Error updating payment status: ' + error.message);
		} else {
			preorderLogs = preorderLogs.map((log) =>
				log.order_group_id === orderGroupId ? { ...log, payment_status: newPaidStatus } : log
			);
		}
	}

	function toggleItemSelection(id: string) {
		if (selectedItems.has(id)) {
			selectedItems.delete(id);
		} else {
			selectedItems.add(id);
		}
		selectedItems = new Set(selectedItems); // Trigger reactivity
	}

	async function handleBulkArrived() {
		if (selectedItems.size === 0) return;

		// Filter out items that are already complete to avoid double notification
		const itemsToUpdate = Array.from(selectedItems).filter((id) => {
			const item = preorderLogs.find((l) => l.id === id);
			return item && item.status !== 'complete' && item.status !== 'completed';
		});

		if (itemsToUpdate.length === 0) {
			alert('Selected items are already marked as arrived.');
			selectedItems = new Set();
			return;
		}

		confirmConfig = {
			title: 'Bulk Product Arrival',
			message: `Are you sure you want to mark ${itemsToUpdate.length} NEW items as ARRIVED? This will send notifications to customers immediately.`,
			confirmText: 'Yes, Notify All',
			cancelText: 'Cancel',
			type: 'info',
			onConfirm: async () => {
				loading = true;

				// 1. Update status to 'complete' in Supabase
				const { error } = await supabase
					.from('preorder_logs')
					.update({ status: 'complete' })
					.in('id', itemsToUpdate);

				if (error) {
					alert('Error updating items: ' + error.message);
				} else {
					// 2. Identify unique users to notify
					const usersToNotify = new Map<string, PreorderLog[]>();
					preorderLogs.forEach((log) => {
						if (itemsToUpdate.includes(log.id)) {
							const userItems = usersToNotify.get(log.user_line_id) || [];
							userItems.push(log);
							usersToNotify.set(log.user_line_id, userItems);
						}
					});

					// 3. Send notifications via BOT API
					for (const [userId, items] of usersToNotify.entries()) {
						try {
							const backendUrl = import.meta.env.VITE_BACKEND_URL;
							await fetch(`${backendUrl}/api/notify-arrived`, {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ userLineId: userId, items })
							});
						} catch (e) {
							console.error('Failed to notify user:', userId, e);
						}
					}

					// 4. Update local state
					preorderLogs = preorderLogs.map((log) =>
						selectedItems.has(log.id) ? { ...log, status: 'complete' } : log
					);
					selectedItems = new Set();
				}
				loading = false;
				showConfirmModal = false; // Close modal logic
			}
		};
		showConfirmModal = true;
	}

	async function deleteProduct(id: string) {
		if (!confirm('Are you sure you want to delete this product?')) return;

		const { error } = await supabase.from('products').delete().eq('id', id);

		if (!error) {
			products = products.filter((p) => p.id !== id);
		}
	}

	function openModal(mode: 'add' | 'edit', product?: Product) {
		modalMode = mode;
		if (mode === 'edit' && product) {
			editingProduct = product;
			formData = {
				product_code: product.product_code,
				product_name: product.product_name,
				price: product.price,
				total_preorder_qty: product.total_preorder_qty,
				remaining_qty: product.remaining_qty,
				description: product.description || '',
				image_url: product.image_url || '',
				is_active: product.is_active
			};
		} else {
			editingProduct = null;
			formData = {
				product_code: '',
				product_name: '',
				price: 0,
				total_preorder_qty: 0,
				remaining_qty: 0,
				description: '',
				image_url: '',
				is_active: true
			};
		}
		selectedFile = null;
		showModal = true;
	}

	async function compressImage(file: File): Promise<Blob> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = (event) => {
				const img = new Image();
				img.src = event.target?.result as string;
				img.onload = () => {
					const canvas = document.createElement('canvas');
					let width = img.width;
					let height = img.height;
					const maxDim = 1200;
					if (width > height && width > maxDim) {
						height *= maxDim / width;
						width = maxDim;
					} else if (height > maxDim) {
						width *= maxDim / height;
						height = maxDim;
					}
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext('2d');
					ctx?.drawImage(img, 0, 0, width, height);
					canvas.toBlob(
						(blob) => {
							if (blob) resolve(blob);
						},
						'image/jpeg',
						0.82
					);
				};
			};
			reader.onerror = (error) => reject(error);
		});
	}

	async function uploadImage(file: File): Promise<string | null> {
		try {
			const compressedBlob = await compressImage(file);
			const fileExt = file.name.split('.').pop();
			const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

			const { data, error } = await supabase.storage
				.from('twentytoys')
				.upload(fileName, compressedBlob);

			if (error) throw error;

			const { data: publicUrlData } = supabase.storage.from('twentytoys').getPublicUrl(data.path);

			return publicUrlData.publicUrl;
		} catch (err) {
			console.error('Upload failed:', err);
			return null;
		}
	}

	async function handleSubmit() {
		uploading = true;
		try {
			if (selectedFile) {
				const uploadedUrl = await uploadImage(selectedFile);
				if (uploadedUrl) {
					formData.image_url = uploadedUrl;
				}
			}

			if (modalMode === 'add') {
				const { data, error } = await supabase
					.from('products')
					.insert([formData])
					.select()
					.single();

				if (error) alert('Error adding product: ' + error.message);
				else {
					products = [data, ...products];
					showModal = false;
				}
			} else if (modalMode === 'edit' && editingProduct) {
				const { error } = await supabase
					.from('products')
					.update(formData)
					.eq('id', editingProduct.id);

				if (error) alert('Error updating product: ' + error.message);
				else {
					fetchProducts(); // Refresh list
					showModal = false;
				}
			}
		} finally {
			uploading = false;
		}
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			selectedFile = target.files[0];
		}
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) openDropdownId = null;
		else openDropdownId = id;
	}

	onMount(() => {
		fetchProducts();
		const handleClickOutside = () => {
			openDropdownId = null;
		};
		window.addEventListener('click', handleClickOutside);
		return () => window.removeEventListener('click', handleClickOutside);
	});

	$effect(() => {
		if (activeTab === 'products') fetchProducts();
		else fetchPreorders();
	});

	// Derived
	let filteredProducts = $derived(
		products.filter(
			(p) =>
				p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				p.product_code.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	// จัดกลุ่มออเดอร์ตาม order_group_id
	let groupedOrders = $derived.by(() => {
		const groups = new Map<string, GroupedOrder>();

		for (const log of preorderLogs) {
			// ใช้ order_group_id ถ้ามี ไม่งั้นใช้ id (สำหรับข้อมูลเก่า)
			const groupId = log.order_group_id || log.id;

			if (groups.has(groupId)) {
				const group = groups.get(groupId)!;
				group.items.push(log);
				group.total_items += log.quantity;
				group.total_price += log.total_price;
			} else {
				groups.set(groupId, {
					order_group_id: groupId,
					user_line_id: log.user_line_id,
					user_display_name: log.user_display_name,
					items: [log],
					total_items: log.quantity,
					total_price: log.total_price,
					status: log.status,
					payment_status: log.payment_status || false,
					created_at: log.created_at
				});
			}
		}

		return Array.from(groups.values()).sort(
			(a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
		);
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
					class="w-24 rounded-md py-1.5 text-[11px] font-medium transition-all sm:w-32 sm:text-sm {activeTab ===
					'products'
						? 'bg-white text-indigo-600 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (activeTab = 'products')}
				>
					Products
				</button>
				<button
					class="w-24 rounded-md py-1.5 text-[11px] font-medium transition-all sm:w-32 sm:text-sm {activeTab ===
					'preorders'
						? 'bg-white text-indigo-600 shadow-sm'
						: 'text-slate-500 hover:text-slate-700'}"
					onclick={() => (activeTab = 'preorders')}
				>
					Pre-orders
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
		{#if activeTab === 'products'}
			<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div class="relative w-full md:w-96">
					<input
						type="text"
						placeholder="Search products..."
						bind:value={searchTerm}
						class="w-full rounded-xl border-0 bg-white py-3 pl-11 pr-4 shadow-sm ring-1 ring-slate-200 transition-all focus:ring-2 focus:ring-indigo-500"
					/>
					<svg
						class="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
				</div>
				<button
					onclick={() => openModal('add')}
					class="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
				>
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					Add Product
				</button>
			</div>

			{#if loading}
				<div class="flex justify-center py-20">
					<div
						class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"
					></div>
				</div>
			{:else}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each filteredProducts as product (product.id)}
						<div
							class="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-md"
							transition:fade
						>
							<div class="aspect-square w-full overflow-hidden bg-slate-100">
								{#if product.image_url}
									<img
										src={product.image_url}
										alt={product.product_name}
										class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
									/>
								{:else}
									<div class="flex h-full w-full items-center justify-center text-slate-300">
										<svg class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
											/>
										</svg>
									</div>
								{/if}
								<div class="absolute right-3 top-3">
									<button
										onclick={(e) => {
											e.stopPropagation();
											toggleActive(product);
										}}
										class="rounded-full px-3 py-1 text-xs font-medium backdrop-blur-md transition-colors {product.is_active
											? 'bg-green-500/90 text-white'
											: 'bg-slate-500/90 text-white'}"
									>
										{product.is_active ? 'Active' : 'Inactive'}
									</button>
								</div>
							</div>

							<div class="p-4">
								<div class="mb-2 flex items-start justify-between">
									<div>
										<p class="text-xs font-medium text-slate-400">{product.product_code}</p>
										<h3
											class="line-clamp-1 text-lg font-bold text-slate-800"
											title={product.product_name}
										>
											{product.product_name}
										</h3>
									</div>
								</div>

								<p class="mb-4 line-clamp-2 min-h-[2.5em] text-sm text-slate-500">
									{product.description || 'No description available'}
								</p>

								<div class="mb-4 flex items-center justify-between rounded-lg bg-slate-50 p-3">
									<div>
										<p class="text-[10px] uppercase tracking-wider text-slate-400">Price</p>
										<p class="font-bold text-slate-700">฿{product.price.toLocaleString()}</p>
									</div>
									<div class="text-right">
										<p class="text-[10px] uppercase tracking-wider text-slate-400">Stock</p>
										<p class="font-bold text-indigo-600">
											{product.remaining_qty} / {product.total_preorder_qty}
										</p>
									</div>
								</div>

								<div class="grid grid-cols-2 gap-2">
									<button
										onclick={() => openModal('edit', product)}
										class="flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-indigo-600"
									>
										Edit
									</button>
									<button
										onclick={() => deleteProduct(product.id)}
										class="flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-red-100 hover:bg-red-50 hover:text-red-600"
									>
										Delete
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			<!-- Preorders Tab -->
			<div class="space-y-4">
				<!-- Desktop View (Cards) -->
				<div class="hidden space-y-4 md:block">
					{#each groupedOrders as order (order.order_group_id)}
						<div
							class="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md"
							transition:fade
						>
							<!-- Order Header -->
							<div
								class="flex items-center justify-between overflow-hidden rounded-t-2xl border-b border-slate-100 bg-slate-50/50 px-6 py-4"
							>
								<div class="flex items-center gap-4">
									<div>
										<p class="text-xs font-medium text-slate-400">
											{new Date(order.created_at).toLocaleDateString('th-TH', {
												year: 'numeric',
												month: 'short',
												day: 'numeric',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</p>
										<h4 class="font-bold text-slate-900">{order.user_display_name || 'Unknown'}</h4>
										<p class="font-mono text-[10px] text-slate-400">{order.user_line_id}</p>
									</div>
								</div>

								<div class="flex items-center gap-6">
									<!-- Summary -->
									<div class="text-right">
										<p class="text-xs text-slate-400">{order.total_items} ชิ้น</p>
										<p class="text-lg font-bold text-indigo-600">
											฿{order.total_price.toLocaleString()}
										</p>
									</div>

									<!-- Payment Toggle -->
									<div class="flex items-center gap-2 border-l border-slate-100 pl-6">
										<span class="text-[10px] font-bold text-slate-400">PAID</span>
										<button
											type="button"
											onclick={() =>
												updatePaymentStatus(order.order_group_id, !order.payment_status)}
											class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
											{order.payment_status ? 'bg-emerald-500' : 'bg-slate-200'}"
										>
											<span
												class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
												{order.payment_status ? 'translate-x-5' : 'translate-x-0'}"
											></span>
										</button>
									</div>
								</div>
							</div>

							<!-- Order Items -->
							<div class="divide-y divide-slate-100">
								{#each order.items as item}
									<div
										class="relative flex items-center justify-between px-6 py-3 transition-colors hover:bg-slate-50/30 {openDropdownId ===
										item.id.toString()
											? 'z-20'
											: 'z-auto'}"
									>
										<div class="flex flex-1 items-center gap-4">
											<!-- Checkbox -->
											<input
												type="checkbox"
												checked={selectedItems.has(item.id)}
												onchange={() => toggleItemSelection(item.id)}
												disabled={item.status === 'complete'}
												class="h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
											/>
											<div class="flex-1">
												<span class="font-bold text-indigo-600">{item.product_code}</span>
												<span class="ml-2 font-medium text-slate-700">{item.product_name}</span>
											</div>
										</div>
										<div class="flex items-center gap-4">
											<span class="text-sm font-medium text-slate-400">x{item.quantity}</span>
											<span class="w-16 text-right font-bold text-slate-700"
												>฿{item.total_price.toLocaleString()}</span
											>

											<!-- Individual Status Dropdown -->
											<div class="relative">
												<button
													onclick={(e) => {
														e.stopPropagation();
														toggleDropdown(item.id.toString());
													}}
													class="inline-flex w-24 items-center justify-between rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm ring-1 ring-inset transition-all
													{item.status === 'complete' || item.status === 'completed'
														? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
														: item.status === 'fail' || item.status === 'cancelled'
															? 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100'
															: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100'}"
												>
													<span class="capitalize">{item.status}</span>
													<svg
														class="h-3 w-3 opacity-50"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M19 9l-7 7-7-7"
														/>
													</svg>
												</button>

												{#if openDropdownId === item.id.toString()}
													<div
														transition:fade={{ duration: 100 }}
														class="absolute right-0 z-50 mt-1 w-32 origin-top-right rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200 focus:outline-none"
													>
														<div class="space-y-0.5">
															<button
																onclick={() => updateOrderStatus(item.id, 'pending')}
																class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-50"
															>
																<div class="h-1.5 w-1.5 rounded-full bg-amber-400"></div>
																Pending
															</button>
															<button
																onclick={() => updateOrderStatus(item.id, 'complete')}
																class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
															>
																<div class="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
																Product arrived
															</button>
															<button
																onclick={() => updateOrderStatus(item.id, 'fail')}
																class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-semibold text-rose-700 transition-colors hover:bg-rose-50"
															>
																<div class="h-1.5 w-1.5 rounded-full bg-rose-400"></div>
																Fail
															</button>
														</div>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Mobile View (Card List) -->
				<div class="space-y-3 md:hidden">
					{#each groupedOrders as order (order.order_group_id)}
						<div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
							<!-- Order Header -->
							<div class="overflow-hidden rounded-t-2xl border-b border-slate-100 p-4">
								<div class="mb-3 flex items-start justify-between">
									<div>
										<p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
											{new Date(order.created_at).toLocaleDateString('th-TH', {
												day: 'numeric',
												month: 'short',
												year: '2-digit',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</p>
										<h4 class="font-bold text-slate-900">{order.user_display_name || 'Unknown'}</h4>
										<p class="font-mono text-[10px] text-slate-400">{order.user_line_id}</p>
									</div>

									<!-- Payment Toggle (Mobile) -->
									<div class="flex flex-col items-end gap-1">
										<span class="text-[8px] font-bold text-slate-400">PAYMENT</span>
										<button
											type="button"
											onclick={() =>
												updatePaymentStatus(order.order_group_id, !order.payment_status)}
											class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
											{order.payment_status ? 'bg-emerald-500' : 'bg-slate-200'}"
										>
											<span
												class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
												{order.payment_status ? 'translate-x-5' : 'translate-x-0'}"
											></span>
										</button>
									</div>
								</div>
							</div>

							<!-- Order Items -->
							<div class="divide-y divide-slate-100 bg-slate-50/50">
								{#each order.items as item}
									<div
										class="relative px-4 py-3 {openDropdownId === item.id.toString()
											? 'z-20'
											: 'z-auto'}"
									>
										<div class="mb-2 flex items-start gap-3">
											<!-- Checkbox Mobile -->
											<div class="pt-1">
												<input
													type="checkbox"
													checked={selectedItems.has(item.id)}
													onchange={() => toggleItemSelection(item.id)}
													disabled={item.status === 'complete'}
													class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
												/>
											</div>
											<div class="min-w-0 flex-1">
												<p class="text-[10px] font-bold text-indigo-600">{item.product_code}</p>
												<p class="truncate text-xs font-medium text-slate-700">
													{item.product_name}
												</p>
											</div>
											<div class="ml-3 flex-shrink-0 text-right">
												<p class="text-[10px] text-slate-400">x{item.quantity}</p>
												<p class="text-sm font-bold text-slate-900">
													฿{item.total_price.toLocaleString()}
												</p>
											</div>
										</div>

										<!-- Mobile Individual Status -->
										<div class="flex justify-end">
											<div class="relative">
												<button
													onclick={(e) => {
														e.stopPropagation();
														toggleDropdown(item.id.toString());
													}}
													class="inline-flex w-24 items-center justify-between rounded-lg px-2 py-1 text-[10px] font-bold shadow-sm ring-1 ring-inset transition-all
													{item.status === 'complete' || item.status === 'completed'
														? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
														: item.status === 'fail' || item.status === 'cancelled'
															? 'bg-rose-50 text-rose-700 ring-rose-200'
															: 'bg-amber-50 text-amber-700 ring-amber-200'}"
												>
													<span class="capitalize">{item.status}</span>
													<svg
														class="h-3 w-3 opacity-50"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M19 9l-7 7-7-7"
														/>
													</svg>
												</button>

												{#if openDropdownId === item.id.toString()}
													<div
														transition:fade={{ duration: 100 }}
														class="absolute right-0 z-50 mt-1 w-32 origin-top-right rounded-xl bg-white p-1 shadow-lg ring-1 ring-slate-200"
													>
														<div class="space-y-0.5">
															<button
																onclick={() => updateOrderStatus(item.id, 'pending')}
																class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-amber-700 hover:bg-amber-50"
															>
																<div class="h-1.5 w-1.5 rounded-full bg-amber-400"></div>
																Pending
															</button>
															<button
																onclick={() => updateOrderStatus(item.id, 'complete')}
																class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-emerald-700 hover:bg-emerald-50"
															>
																<div class="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
																Product arrived
															</button>
															<button
																onclick={() => updateOrderStatus(item.id, 'fail')}
																class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] font-bold text-rose-700 hover:bg-rose-50"
															>
																<div class="h-1.5 w-1.5 rounded-full bg-rose-400"></div>
																Fail
															</button>
														</div>
													</div>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>

							<!-- Order Total (Mobile) -->
							<div
								class="flex items-center justify-between overflow-hidden rounded-b-2xl bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3"
							>
								<div class="flex flex-col">
									<span class="text-[10px] font-medium text-slate-500"
										>ยอดรวมทั้งหมด {order.total_items} ชิ้น</span
									>
									<span class="text-lg font-bold text-indigo-600"
										>฿{order.total_price.toLocaleString()}</span
									>
								</div>

								<!-- Mobile Payment Toggle Moved to Bottom Right near total -->
								<div class="flex items-center gap-2 rounded-xl bg-white/50 px-3 py-1.5 shadow-sm">
									<span class="text-[8px] font-bold text-slate-400">PAID</span>
									<button
										type="button"
										onclick={() => updatePaymentStatus(order.order_group_id, !order.payment_status)}
										class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
										{order.payment_status ? 'bg-emerald-500' : 'bg-slate-200'}"
									>
										<span
											class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
											{order.payment_status ? 'translate-x-5' : 'translate-x-0'}"
										></span>
									</button>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>

<!-- Modal -->
{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<button
			type="button"
			class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
			onclick={() => (showModal = false)}
			aria-label="Close modal overlay"
			transition:fade
		></button>
		<div class="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl" transition:slide>
			<div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
				<h2 class="text-lg font-bold text-slate-800">
					{modalMode === 'add' ? 'Add New Product' : 'Edit Product'}
				</h2>
				<button
					onclick={() => (showModal = false)}
					class="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
					aria-label="Close modal"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="p-6">
				<div class="grid gap-4">
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="product_code" class="mb-1 block text-sm font-medium text-slate-700"
								>Code</label
							>
							<input
								id="product_code"
								type="text"
								bind:value={formData.product_code}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
								placeholder="TOY-001"
							/>
						</div>
						<div>
							<label for="price" class="mb-1 block text-sm font-medium text-slate-700">Price</label>
							<input
								id="price"
								type="number"
								bind:value={formData.price}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							/>
						</div>
					</div>

					<div>
						<label for="product_name" class="mb-1 block text-sm font-medium text-slate-700"
							>Product Name</label
						>
						<input
							id="product_name"
							type="text"
							bind:value={formData.product_name}
							class="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							placeholder="Nendoroid Character A"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="total_qty" class="mb-1 block text-sm font-medium text-slate-700"
								>Total Qty</label
							>
							<input
								id="total_qty"
								type="number"
								bind:value={formData.total_preorder_qty}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							/>
						</div>
						<div>
							<label for="remaining_qty" class="mb-1 block text-sm font-medium text-slate-700"
								>Remaining</label
							>
							<input
								id="remaining_qty"
								type="number"
								bind:value={formData.remaining_qty}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							/>
						</div>
					</div>

					<div>
						<label for="image_file" class="mb-1 block text-sm font-medium text-slate-700"
							>Product Image</label
						>
						<div class="flex items-center gap-4">
							<div class="relative flex-1">
								<input
									id="image_file"
									type="file"
									accept="image/*"
									onchange={handleFileChange}
									class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
								/>
								<div
									class="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
								>
									<span class="truncate"
										>{selectedFile
											? selectedFile.name
											: formData.image_url
												? 'Change Image...'
												: 'Click to upload image...'}</span
									>
									<svg
										class="h-5 w-5 text-indigo-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
								</div>
							</div>
							{#if formData.image_url && !selectedFile}
								<div
									class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200"
								>
									<img src={formData.image_url} alt="Preview" class="h-full w-full object-cover" />
								</div>
							{/if}
						</div>
						<p class="mt-1 text-[10px] text-slate-400">
							Max size 1MB. Auto-resized for performance.
						</p>
					</div>

					<div class="flex items-center gap-3 py-2">
						<button
							type="button"
							onclick={() => (formData.is_active = !formData.is_active)}
							aria-label="Toggle product active status"
							class="relative inline-flex h-6 w-11 items-center rounded-full ring-2 ring-indigo-500 ring-offset-2 transition-colors focus:outline-none {formData.is_active
								? 'bg-indigo-600'
								: 'bg-slate-200'}"
						>
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {formData.is_active
									? 'translate-x-6'
									: 'translate-x-1'}"
							></span>
						</button>
						<span class="text-sm font-medium text-slate-700"
							>Product Status: {formData.is_active ? 'Active' : 'Inactive'}</span
						>
					</div>

					<div>
						<label for="description" class="mb-1 block text-sm font-medium text-slate-700"
							>Description</label
						>
						<textarea
							id="description"
							rows="3"
							bind:value={formData.description}
							class="w-full rounded-lg border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
						></textarea>
					</div>
				</div>

				<button
					onclick={handleSubmit}
					disabled={uploading}
					class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 font-medium text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:bg-indigo-400"
				>
					{#if uploading}
						<svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Saving...
					{:else}
						{modalMode === 'add' ? 'Create Product' : 'Save Changes'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if selectedItems.size > 0}
	<div
		transition:slide={{ axis: 'y' }}
		class="fixed bottom-24 left-1/2 z-[100] w-[90%] -translate-x-1/2 md:bottom-10 md:w-auto"
	>
		<div
			class="flex items-center gap-4 rounded-2xl bg-slate-900/90 px-6 py-4 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl"
		>
			<div class="hidden border-r border-white/10 pr-4 md:block">
				<p class="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Selected</p>
				<p class="text-xl font-black text-white">
					{selectedItems.size} <span class="text-xs font-normal opacity-60">items</span>
				</p>
			</div>
			<div class="md:hidden">
				<p class="text-xs font-bold text-white">{selectedItems.size} ชิ้น</p>
			</div>
			<button
				onclick={handleBulkArrived}
				disabled={loading}
				class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 font-bold text-white shadow-lg transition-transform active:scale-95 disabled:grayscale"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
					/>
				</svg>
				Mark Arrived & Notify
			</button>
			<button
				onclick={() => (selectedItems = new Set())}
				class="ml-2 text-xs font-medium text-white/60 hover:text-white"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<!-- Confirmation Modal -->
{#if showConfirmModal}
	<div
		class="fixed inset-0 z-[200] flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
			transition:fade
		></div>
		<div
			class="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
			transition:scale={{ start: 0.95 }}
		>
			<div class="p-6 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50"
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
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h3 class="mb-2 text-lg font-bold text-slate-900">{confirmConfig.title}</h3>
				<p class="mb-6 text-sm text-slate-500">{confirmConfig.message}</p>
				<div class="grid grid-cols-2 gap-3">
					<button
						onclick={() => (showConfirmModal = false)}
						class="rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
					>
						{confirmConfig.cancelText}
					</button>
					<button
						onclick={confirmConfig.onConfirm}
						class="rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-transform hover:bg-indigo-700 active:scale-95"
					>
						{confirmConfig.confirmText}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
