<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { fade, slide, scale } from 'svelte/transition';

	// Types
	interface Gift {
		id: string;
		gift_code: string;
		gift_name: string;
		points_cost: number;
		remaining_qty: number;
		image_url: string | null;
		description: string | null;
		is_active: boolean;
		created_at: string;
	}

	// State
	let gifts: Gift[] = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');

	// Modal State
	let showModal = $state(false);
	let modalMode = $state('add'); // add | edit
	let editingGift: Gift | null = $state(null);
	let formData = $state({
		gift_code: '',
		gift_name: '',
		points_cost: 0,
		remaining_qty: 0,
		description: '',
		image_url: '',
		is_active: true
	});

	let selectedFile: File | null = $state(null);
	let uploading = $state(false);

	// Fetch Data
	async function fetchGifts() {
		loading = true;
		const { data, error } = await supabase
			.from('gifts')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) console.error('Error fetching gifts:', error);
		else gifts = data || [];
		loading = false;
	}

	function resetForm() {
		formData = {
			gift_code: '',
			gift_name: '',
			points_cost: 0,
			remaining_qty: 0,
			description: '',
			image_url: '',
			is_active: true
		};
		selectedFile = null;
		editingGift = null;
	}

	function openAddModal() {
		resetForm();
		modalMode = 'add';
		showModal = true;
	}

	function openEditModal(gift: Gift) {
		modalMode = 'edit';
		editingGift = gift;
		formData = {
			gift_code: gift.gift_code,
			gift_name: gift.gift_name,
			points_cost: gift.points_cost,
			remaining_qty: gift.remaining_qty,
			description: gift.description || '',
			image_url: gift.image_url || '',
			is_active: gift.is_active
		};
		showModal = true;
	}

	async function toggleActive(gift: Gift) {
		const { error } = await supabase
			.from('gifts')
			.update({ is_active: !gift.is_active })
			.eq('id', gift.id);

		if (!error) {
			gifts = gifts.map((g) => (g.id === gift.id ? { ...g, is_active: !g.is_active } : g));
		}
	}

	async function deleteGift(id: string) {
		if (!confirm('Are you sure you want to delete this gift?')) return;
		const { error } = await supabase.from('gifts').delete().eq('id', id);
		if (!error) {
			gifts = gifts.filter((g) => g.id !== id);
		} else {
			alert('Error deleting gift: ' + error.message);
		}
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
					const maxDim = 800;
					let width = img.width;
					let height = img.height;
					if (width > height) {
						if (width > maxDim) {
							height *= maxDim / width;
							width = maxDim;
						}
					} else {
						if (height > maxDim) {
							width *= maxDim / height;
							height = maxDim;
						}
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
			const fileName = `gift-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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
				if (uploadedUrl) formData.image_url = uploadedUrl;
			}

			if (modalMode === 'add') {
				const { data, error } = await supabase.from('gifts').insert([formData]).select().single();
				if (error) alert('Error adding gift: ' + error.message);
				else {
					gifts = [data, ...gifts];
					showModal = false;
				}
			} else if (modalMode === 'edit' && editingGift) {
				const { error } = await supabase.from('gifts').update(formData).eq('id', editingGift.id);
				if (error) alert('Error updating gift: ' + error.message);
				else {
					fetchGifts();
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

	let filteredGifts = $derived(
		gifts.filter(
			(g) =>
				g.gift_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				g.gift_code.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);

	onMount(fetchGifts);
</script>

<main class="mx-auto max-w-7xl px-4 py-8 md:px-8">
	<!-- Header & Actions -->
	<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="relative w-full md:w-96">
			<input
				type="text"
				placeholder="Search gifts..."
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
		<div class="flex items-center gap-3">
			<div class="rounded-lg bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-600 sm:text-sm">
				Total: {gifts.length}
			</div>
			<button
				onclick={openAddModal}
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
				Add Gift
			</button>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-20">
			<div
				class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
			></div>
		</div>
	{:else if filteredGifts.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<div class="mb-4 rounded-full bg-slate-100 p-4">
				<svg class="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-bold text-slate-700">No gifts found</h3>
			<p class="text-sm text-slate-500">Create your first point-redeemable item</p>
		</div>
	{:else}
		<!-- Grid View -->
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
			{#each filteredGifts as gift (gift.id)}
				<div
					class="group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-xl hover:ring-indigo-200"
					transition:fade
				>
					<!-- Image Holder -->
					<div class="aspect-square w-full overflow-hidden bg-slate-100">
						{#if gift.image_url}
							<img
								src={gift.image_url}
								alt={gift.gift_name}
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-slate-300">
								<svg class="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="1.5"
										d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
							</div>
						{/if}
						<!-- Status Badge -->
						<div class="absolute right-3 top-3">
							<span
								class="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm
								{gift.is_active ? 'bg-emerald-500 text-white' : 'bg-slate-500 text-white'}"
							>
								{gift.is_active ? 'Active' : 'Inactive'}
							</span>
						</div>
					</div>

					<!-- Content -->
					<div class="p-4">
						<div class="mb-2 flex items-start justify-between">
							<h3 class="line-clamp-1 font-bold text-slate-800">{gift.gift_name}</h3>
							<span class="font-mono text-xs text-slate-400">{gift.gift_code}</span>
						</div>
						<p class="mb-4 line-clamp-2 min-h-[32px] text-xs text-slate-500">
							{gift.description || 'No description provided.'}
						</p>

						<div class="flex items-center justify-between border-t border-slate-100 pt-4">
							<div>
								<p class="text-[10px] font-bold uppercase tracking-tighter text-slate-400">
									Points Cost
								</p>
								<p class="text-lg font-black text-indigo-600">{gift.points_cost}</p>
							</div>
							<div class="text-right">
								<p class="text-[10px] font-bold uppercase tracking-tighter text-slate-400">Stock</p>
								<p class="text-lg font-black text-slate-700">{gift.remaining_qty}</p>
							</div>
						</div>

						<!-- Actions Over -->
						<div class="mt-4 flex gap-2">
							<button
								onclick={() => openEditModal(gift)}
								class="flex-1 rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-indigo-50 hover:text-indigo-600"
							>
								Edit
							</button>
							<button
								onclick={() => toggleActive(gift)}
								class="rounded-xl px-3 py-2 text-xs font-bold transition-all
								{gift.is_active ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}"
							>
								{gift.is_active ? 'Disable' : 'Enable'}
							</button>
							<button
								onclick={() => deleteGift(gift.id)}
								class="rounded-xl bg-rose-50 px-3 py-2 text-rose-600 transition-all hover:bg-rose-600 hover:text-white"
							>
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</main>

<!-- Add/Edit Modal -->
{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		transition:fade={{ duration: 200 }}
	>
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
			onclick={() => (showModal = false)}
			aria-label="Close modal"
		></button>

		<div
			class="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
			transition:scale={{ start: 0.95, duration: 200 }}
		>
			<div class="bg-indigo-600 px-6 py-4 text-white">
				<h3 class="text-xl font-bold">{modalMode === 'add' ? 'Add New Gift' : 'Edit Gift'}</h3>
			</div>

			<form onsubmit={handleSubmit} class="p-6">
				<div class="grid grid-cols-2 gap-4">
					<div class="col-span-1">
						<label class="mb-1 block text-xs font-bold text-slate-500" for="gift-code"
							>Gift Code</label
						>
						<input
							id="gift-code"
							type="text"
							bind:value={formData.gift_code}
							placeholder="GIFT-XXXX"
							class="w-full rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							required
						/>
					</div>
					<div class="col-span-1">
						<label class="mb-1 block text-xs font-bold text-slate-500" for="gift-name"
							>Gift Name</label
						>
						<input
							id="gift-name"
							type="text"
							bind:value={formData.gift_name}
							placeholder="Enter name"
							class="w-full rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							required
						/>
					</div>

					<div class="col-span-1">
						<label class="mb-1 block text-xs font-bold text-slate-500" for="points-cost"
							>Points Cost</label
						>
						<input
							id="points-cost"
							type="number"
							bind:value={formData.points_cost}
							class="w-full rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							required
						/>
					</div>
					<div class="col-span-1">
						<label class="mb-1 block text-xs font-bold text-slate-500" for="stock">Stock</label>
						<input
							id="stock"
							type="number"
							bind:value={formData.remaining_qty}
							class="w-full rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							required
						/>
					</div>

					<div class="col-span-2">
						<label class="mb-1 block text-xs font-bold text-slate-500" for="desc"
							>Description (Optional)</label
						>
						<textarea
							id="desc"
							bind:value={formData.description}
							class="w-full rounded-xl border-slate-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							rows="2"
						></textarea>
					</div>

					<div class="col-span-2">
						<label class="mb-1 block text-xs font-bold text-slate-500" for="gift-img">Image</label>
						<div class="flex items-center gap-4">
							{#if formData.image_url}
								<img
									src={formData.image_url}
									alt="Preview"
									class="h-16 w-16 rounded-xl object-cover ring-2 ring-indigo-100"
								/>
							{/if}
							<input
								id="gift-img"
								type="file"
								accept="image/*"
								onchange={handleFileChange}
								class="block w-full text-xs text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-xs file:font-bold file:text-indigo-600 hover:file:bg-indigo-100"
							/>
						</div>
					</div>
				</div>

				<div class="mt-8 flex gap-3">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="flex-1 rounded-2xl bg-slate-100 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={uploading}
						class="flex-[2] rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
					>
						{uploading ? 'Processing...' : modalMode === 'add' ? 'Create Gift' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	:global(body) {
		@apply bg-slate-50;
	}
</style>
