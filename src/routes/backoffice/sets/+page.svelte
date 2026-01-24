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
		image_url: string | null;
	}

	interface ProductSet {
		id: string;
		set_code: string;
		set_name: string;
		set_price: number;
		original_price: number | null;
		total_preorder_qty: number;
		remaining_qty: number;
		image_url: string | null;
		description: string | null;
		is_active: boolean;
		created_at: string;
		items?: SetItem[];
	}

	interface SetItem {
		id: string;
		set_id: string;
		product_id: string;
		quantity: number;
		product?: Product;
	}

	// State
	let productSets: ProductSet[] = $state([]);
	let products: Product[] = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');

	// Modal State
	let showModal = $state(false);
	let modalMode = $state<'add' | 'edit'>('add');
	let editingSet: ProductSet | null = $state(null);
	let formData = $state({
		set_code: '',
		set_name: '',
		set_price: 0,
		original_price: 0,
		total_preorder_qty: 0,
		remaining_qty: 0,
		description: '',
		image_url: '',
		is_active: true
	});

	// สินค้าที่เลือกใส่ในเซต
	let selectedProducts = $state<{ product_id: string; quantity: number }[]>([]);

	let selectedFile: File | null = $state(null);
	let uploading = $state(false);

	// Fetch Data
	async function fetchProductSets() {
		loading = true;
		const { data, error } = await supabase
			.from('product_sets')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error fetching product sets:', error);
		} else {
			productSets = data || [];
			// Fetch items for each set
			for (const set of productSets) {
				const { data: items } = await supabase
					.from('product_set_items')
					.select('*, products(*)')
					.eq('set_id', set.id);
				set.items = items?.map((item) => ({
					...item,
					product: item.products
				})) || [];
			}
		}
		loading = false;
	}

	async function fetchProducts() {
		const { data, error } = await supabase
			.from('products')
			.select('id, product_code, product_name, price, image_url')
			.eq('is_active', true)
			.order('product_name');

		if (error) console.error('Error fetching products:', error);
		else products = data || [];
	}

	// Actions
	async function toggleActive(set: ProductSet) {
		const { error } = await supabase
			.from('product_sets')
			.update({ is_active: !set.is_active })
			.eq('id', set.id);

		if (!error) {
			const index = productSets.findIndex((s) => s.id === set.id);
			if (index !== -1) productSets[index].is_active = !productSets[index].is_active;
		}
	}

	async function deleteSet(id: string) {
		if (!confirm('Are you sure you want to delete this set?')) return;

		const { error } = await supabase.from('product_sets').delete().eq('id', id);

		if (!error) {
			productSets = productSets.filter((s) => s.id !== id);
		}
	}

	function openModal(mode: 'add' | 'edit', set?: ProductSet) {
		modalMode = mode;
		if (mode === 'edit' && set) {
			editingSet = set;
			formData = {
				set_code: set.set_code,
				set_name: set.set_name,
				set_price: set.set_price,
				original_price: set.original_price || 0,
				total_preorder_qty: set.total_preorder_qty,
				remaining_qty: set.remaining_qty,
				description: set.description || '',
				image_url: set.image_url || '',
				is_active: set.is_active
			};
			selectedProducts =
				set.items?.map((item) => ({
					product_id: item.product_id,
					quantity: item.quantity
				})) || [];
		} else {
			editingSet = null;
			formData = {
				set_code: '',
				set_name: '',
				set_price: 0,
				original_price: 0,
				total_preorder_qty: 0,
				remaining_qty: 0,
				description: '',
				image_url: '',
				is_active: true
			};
			selectedProducts = [];
		}
		selectedFile = null;
		showModal = true;
	}

	function addProductToSet() {
		selectedProducts = [...selectedProducts, { product_id: '', quantity: 1 }];
	}

	function removeProductFromSet(index: number) {
		selectedProducts = selectedProducts.filter((_, i) => i !== index);
	}

	function updateProductSelection(index: number, productId: string) {
		selectedProducts[index].product_id = productId;
	}

	function updateProductQuantity(index: number, qty: number) {
		selectedProducts[index].quantity = qty;
	}

	// คำนวณราคารวมปกติจากสินค้าที่เลือก
	let calculatedOriginalPrice = $derived(() => {
		let total = 0;
		for (const item of selectedProducts) {
			const product = products.find((p) => p.id === item.product_id);
			if (product) {
				total += product.price * item.quantity;
			}
		}
		return total;
	});

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
			const fileName = `sets/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

			const { data, error } = await supabase.storage.from('twentytoys').upload(fileName, compressedBlob);

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
			// Validate
			if (!formData.set_code || !formData.set_name) {
				alert('Please fill in set code and name');
				return;
			}

			if (selectedProducts.length === 0) {
				alert('Please add at least one product to the set');
				return;
			}

			// Upload image if selected
			if (selectedFile) {
				const uploadedUrl = await uploadImage(selectedFile);
				if (uploadedUrl) {
					formData.image_url = uploadedUrl;
				}
			}

			// Update original price from calculated
			formData.original_price = calculatedOriginalPrice();

			if (modalMode === 'add') {
				// Create set
				const { data: newSet, error } = await supabase
					.from('product_sets')
					.insert([formData])
					.select()
					.single();

				if (error) {
					alert('Error adding set: ' + error.message);
					return;
				}

				// Add products to set
				const setItems = selectedProducts
					.filter((p) => p.product_id)
					.map((p) => ({
						set_id: newSet.id,
						product_id: p.product_id,
						quantity: p.quantity
					}));

				if (setItems.length > 0) {
					const { error: itemsError } = await supabase.from('product_set_items').insert(setItems);

					if (itemsError) {
						console.error('Error adding set items:', itemsError);
					}
				}

				showModal = false;
				fetchProductSets();
			} else if (modalMode === 'edit' && editingSet) {
				// Update set
				const { error } = await supabase
					.from('product_sets')
					.update(formData)
					.eq('id', editingSet.id);

				if (error) {
					alert('Error updating set: ' + error.message);
					return;
				}

				// Delete old items and insert new ones
				await supabase.from('product_set_items').delete().eq('set_id', editingSet.id);

				const setItems = selectedProducts
					.filter((p) => p.product_id)
					.map((p) => ({
						set_id: editingSet!.id,
						product_id: p.product_id,
						quantity: p.quantity
					}));

				if (setItems.length > 0) {
					await supabase.from('product_set_items').insert(setItems);
				}

				showModal = false;
				fetchProductSets();
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

	onMount(() => {
		fetchProductSets();
		fetchProducts();
	});

	// Derived
	let filteredSets = $derived(
		productSets.filter(
			(s) =>
				s.set_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				s.set_code.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	// Get product name by ID
	function getProductName(productId: string): string {
		const product = products.find((p) => p.id === productId);
		return product ? `${product.product_code} - ${product.product_name}` : 'Unknown Product';
	}
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
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all text-slate-500 hover:text-slate-700 sm:w-24 sm:text-sm"
					onclick={() => goto('/backoffice')}
				>
					Products
				</button>
				<button
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all bg-white text-indigo-600 shadow-sm sm:w-24 sm:text-sm"
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
					class="w-16 rounded-md py-1.5 text-[10px] font-medium transition-all text-slate-500 hover:text-slate-700 sm:w-24 sm:text-sm"
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
		<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<div class="relative w-full md:w-96">
				<input
					type="text"
					placeholder="Search sets..."
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
				class="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-3 font-medium text-white shadow-lg shadow-purple-200 transition-all hover:from-purple-700 hover:to-indigo-700 active:scale-95"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Add Set
			</button>
		</div>

		{#if loading}
			<div class="flex justify-center py-20">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
			</div>
		{:else if filteredSets.length === 0}
			<div class="flex flex-col items-center justify-center py-20 text-center">
				<div class="mb-4 rounded-full bg-purple-100 p-4">
					<svg class="h-12 w-12 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
					</svg>
				</div>
				<h3 class="mb-2 text-lg font-bold text-slate-700">No Product Sets Yet</h3>
				<p class="text-sm text-slate-500">Create your first product set to bundle items together</p>
			</div>
		{:else}
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredSets as set (set.id)}
					<div
						class="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-lg"
						transition:fade
					>
						<!-- Badge -->
						<div class="absolute left-3 top-3 z-10">
							<span class="rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
								Set
							</span>
						</div>

						<div class="aspect-square w-full overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50">
							{#if set.image_url}
								<img
									src={set.image_url}
									alt={set.set_name}
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
								/>
							{:else}
								<div class="flex h-full w-full flex-col items-center justify-center text-purple-300">
									<svg class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
									</svg>
									<span class="mt-2 text-sm font-medium">{set.items?.length || 0} items</span>
								</div>
							{/if}
							<div class="absolute right-3 top-3">
								<button
									onclick={(e) => {
										e.stopPropagation();
										toggleActive(set);
									}}
									class="rounded-full px-3 py-1 text-xs font-medium backdrop-blur-md transition-colors {set.is_active
										? 'bg-green-500/90 text-white'
										: 'bg-slate-500/90 text-white'}"
								>
									{set.is_active ? 'Active' : 'Inactive'}
								</button>
							</div>
						</div>

						<div class="p-4">
							<div class="mb-2">
								<p class="text-xs font-medium text-purple-500">{set.set_code}</p>
								<h3 class="line-clamp-1 text-lg font-bold text-slate-800" title={set.set_name}>
									{set.set_name}
								</h3>
							</div>

							<!-- Items in set -->
							<div class="mb-3">
								<p class="mb-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
									Items in set ({set.items?.length || 0})
								</p>
								<div class="flex flex-wrap gap-1">
									{#each (set.items || []).slice(0, 3) as item}
										<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
											{item.product?.product_code} x{item.quantity}
										</span>
									{/each}
									{#if (set.items?.length || 0) > 3}
										<span class="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-600">
											+{(set.items?.length || 0) - 3} more
										</span>
									{/if}
								</div>
							</div>

							<p class="mb-4 line-clamp-2 min-h-[2.5em] text-sm text-slate-500">
								{set.description || 'No description available'}
							</p>

							<div class="mb-4 flex items-center justify-between rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 p-3">
								<div>
									<p class="text-[10px] uppercase tracking-wider text-slate-400">Set Price</p>
									<p class="text-lg font-bold text-purple-600">฿{set.set_price.toLocaleString()}</p>
									{#if set.original_price && set.original_price > set.set_price}
										<p class="text-[10px] text-slate-400 line-through">
											฿{set.original_price.toLocaleString()}
										</p>
									{/if}
								</div>
								<div class="text-right">
									<p class="text-[10px] uppercase tracking-wider text-slate-400">Stock</p>
									<p class="font-bold text-indigo-600">
										{set.remaining_qty} / {set.total_preorder_qty}
									</p>
								</div>
							</div>

							{#if set.original_price && set.original_price > set.set_price}
								<div class="mb-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 py-2">
									<svg class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span class="text-sm font-bold text-green-600">
										Save ฿{(set.original_price - set.set_price).toLocaleString()}
									</span>
								</div>
							{/if}

							<div class="grid grid-cols-2 gap-2">
								<button
									onclick={() => openModal('edit', set)}
									class="flex items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-purple-600"
								>
									Edit
								</button>
								<button
									onclick={() => deleteSet(set.id)}
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
		<div class="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl" transition:slide>
			<div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
				<h2 class="text-lg font-bold text-slate-800">
					{modalMode === 'add' ? 'Create New Set' : 'Edit Set'}
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
					<!-- Basic Info -->
					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="set_code" class="mb-1 block text-sm font-medium text-slate-700">Set Code</label>
							<input
								id="set_code"
								type="text"
								bind:value={formData.set_code}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
								placeholder="SET-001"
							/>
						</div>
						<div>
							<label for="set_price" class="mb-1 block text-sm font-medium text-slate-700">Set Price (฿)</label>
							<input
								id="set_price"
								type="number"
								bind:value={formData.set_price}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
							/>
						</div>
					</div>

					<div>
						<label for="set_name" class="mb-1 block text-sm font-medium text-slate-700">Set Name</label>
						<input
							id="set_name"
							type="text"
							bind:value={formData.set_name}
							class="w-full rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
							placeholder="Nendoroid Duo Bundle"
						/>
					</div>

					<div class="grid grid-cols-2 gap-4">
						<div>
							<label for="total_qty" class="mb-1 block text-sm font-medium text-slate-700">Total Qty</label>
							<input
								id="total_qty"
								type="number"
								bind:value={formData.total_preorder_qty}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
							/>
						</div>
						<div>
							<label for="remaining_qty" class="mb-1 block text-sm font-medium text-slate-700">Remaining</label>
							<input
								id="remaining_qty"
								type="number"
								bind:value={formData.remaining_qty}
								class="w-full rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
							/>
						</div>
					</div>

					<!-- Products in Set -->
					<div class="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
						<div class="mb-3 flex items-center justify-between">
							<label class="text-sm font-bold text-purple-900">Products in Set</label>
							<button
								type="button"
								onclick={addProductToSet}
								class="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
								</svg>
								Add Product
							</button>
						</div>

						{#if selectedProducts.length === 0}
							<p class="py-4 text-center text-sm text-purple-400">
								No products added yet. Click "Add Product" to start building your set.
							</p>
						{:else}
							<div class="space-y-2">
								{#each selectedProducts as item, index}
									<div class="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
										<select
											class="flex-1 rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
											value={item.product_id}
											onchange={(e) => updateProductSelection(index, (e.target as HTMLSelectElement).value)}
										>
											<option value="">Select a product...</option>
											{#each products as product}
												<option value={product.id}>{product.product_code} - {product.product_name} (฿{product.price.toLocaleString()})</option>
											{/each}
										</select>
										<div class="flex items-center gap-1">
											<span class="text-xs text-slate-500">Qty:</span>
											<input
												type="number"
												min="1"
												class="w-16 rounded-lg border-slate-200 text-center text-sm focus:border-purple-500 focus:ring-purple-500"
												value={item.quantity}
												onchange={(e) => updateProductQuantity(index, parseInt((e.target as HTMLInputElement).value) || 1)}
											/>
										</div>
										<button
											type="button"
											onclick={() => removeProductFromSet(index)}
											class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
										>
											<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								{/each}
							</div>

							<!-- Calculated Price -->
							<div class="mt-3 flex items-center justify-between rounded-lg bg-purple-100 p-3">
								<span class="text-sm font-medium text-purple-800">Original Price (if bought separately):</span>
								<span class="text-lg font-bold text-purple-900">฿{calculatedOriginalPrice().toLocaleString()}</span>
							</div>

							{#if formData.set_price > 0 && calculatedOriginalPrice() > formData.set_price}
								<div class="mt-2 flex items-center justify-center gap-2 rounded-lg bg-green-100 p-2">
									<svg class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span class="text-sm font-bold text-green-700">
										Customer saves ฿{(calculatedOriginalPrice() - formData.set_price).toLocaleString()}!
									</span>
								</div>
							{/if}
						{/if}
					</div>

					<!-- Image Upload -->
					<div>
						<label for="image_file" class="mb-1 block text-sm font-medium text-slate-700">Set Image</label>
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
										class="h-5 w-5 text-purple-500"
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
								<div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
									<img src={formData.image_url} alt="Preview" class="h-full w-full object-cover" />
								</div>
							{/if}
						</div>
					</div>

					<!-- Active Toggle -->
					<div class="flex items-center gap-3 py-2">
						<button
							type="button"
							onclick={() => (formData.is_active = !formData.is_active)}
							aria-label="Toggle set active status"
							class="relative inline-flex h-6 w-11 items-center rounded-full ring-2 ring-purple-500 ring-offset-2 transition-colors focus:outline-none {formData.is_active
								? 'bg-purple-600'
								: 'bg-slate-200'}"
						>
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {formData.is_active
									? 'translate-x-6'
									: 'translate-x-1'}"
							></span>
						</button>
						<span class="text-sm font-medium text-slate-700"
							>Set Status: {formData.is_active ? 'Active' : 'Inactive'}</span
						>
					</div>

					<!-- Description -->
					<div>
						<label for="description" class="mb-1 block text-sm font-medium text-slate-700">Description</label>
						<textarea
							id="description"
							rows="3"
							bind:value={formData.description}
							class="w-full rounded-lg border-slate-200 text-sm focus:border-purple-500 focus:ring-purple-500"
							placeholder="Bundle description..."
						></textarea>
					</div>
				</div>

				<button
					onclick={handleSubmit}
					disabled={uploading}
					class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 py-3 font-medium text-white shadow-lg shadow-purple-100 transition-all hover:from-purple-700 hover:to-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:from-purple-400 disabled:to-indigo-400"
				>
					{#if uploading}
						<svg class="h-5 w-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Saving...
					{:else}
						{modalMode === 'add' ? 'Create Set' : 'Save Changes'}
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
