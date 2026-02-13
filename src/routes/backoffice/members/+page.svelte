<script lang="ts">
	import { onMount } from 'svelte';
	import { lineUserService } from '$lib/supabase';
	import { fade, slide } from 'svelte/transition';
	import { goto } from '$app/navigation';

	interface LineUser {
		user_line_id: string;
		display_name: string | null;
		picture_url: string | null;
		birth_date_text: string | null;
		verification_status: 'unregistered' | 'pending' | 'approved' | 'rejected';
		created_at: string;
	}

	let members: LineUser[] = $state([]);
	let loading = $state(true);
	let searchTerm = $state('');

	async function fetchMembers() {
		loading = true;
		try {
			members = await lineUserService.getLineUsers();
		} catch (error) {
			console.error('Error fetching members:', error);
		} finally {
			loading = false;
		}
	}

	async function updateStatus(userLineId: string, status: 'approved' | 'rejected') {
		try {
			await lineUserService.updateVerificationStatus(userLineId, status);
			members = members.map((m) =>
				m.user_line_id === userLineId ? { ...m, verification_status: status } : m
			);

			// ส่งข้อความแจ้งเตือนผ่านบอท
			try {
				const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
				console.log('Notifying verification status...', { userLineId, status, backendUrl });

				const response = await fetch(`${backendUrl}/api/notify-verification`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ userLineId, status })
				});

				const result = await response.json();
				console.log('Verification notification result:', result);
			} catch (notifyError) {
				console.error('Failed to send notification:', notifyError);
			}
		} catch (error) {
			console.error('Error updating status:', error);
			alert('Failed to update status');
		}
	}

	async function deleteMember(userLineId: string) {
		if (!confirm('Are you sure you want to remove this member?')) return;
		try {
			await lineUserService.deleteLineUser(userLineId);
			members = members.filter((m) => m.user_line_id !== userLineId);
		} catch (error) {
			console.error('Error deleting member:', error);
		}
	}

	onMount(fetchMembers);

	let filteredMembers = $derived(
		members.filter(
			(m) =>
				m.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
				m.user_line_id.toLowerCase().includes(searchTerm.toLowerCase())
		)
	);
</script>

<main class="mx-auto max-w-7xl px-4 py-8 md:px-8">
	<div class="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<div class="relative w-full md:w-96">
			<input
				type="text"
				placeholder="Search members..."
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
		<div class="flex items-center gap-2">
			<div class="rounded-lg bg-indigo-50 px-4 py-2 text-xs font-medium text-indigo-600 sm:text-sm">
				Total: {members.length}
			</div>
			<div class="rounded-lg bg-amber-50 px-4 py-2 text-xs font-medium text-amber-600 sm:text-sm">
				Pending: {members.filter((m) => m.verification_status === 'pending').length}
			</div>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-20">
			<div
				class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"
			></div>
		</div>
	{:else if filteredMembers.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center">
			<div class="mb-4 rounded-full bg-slate-100 p-4">
				<svg class="h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
					/>
				</svg>
			</div>
			<h3 class="text-lg font-bold text-slate-700">No members found</h3>
			<p class="text-sm text-slate-500">Wait for users to register via LINE bot</p>
		</div>
	{:else}
		<!-- Desktop View -->
		<div
			class="hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block"
		>
			<table class="w-full text-left">
				<thead class="border-b border-slate-100 bg-slate-50/50">
					<tr>
						<th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400"
							>Member</th
						>
						<th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400"
							>Birth Date</th
						>
						<th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400"
							>Status</th
						>
						<th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400"
							>Joined</th
						>
						<th
							class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400"
							>Actions</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each filteredMembers as member (member.user_line_id)}
						<tr class="transition-colors hover:bg-slate-50/50" transition:fade>
							<td class="px-6 py-4">
								<div class="flex items-center gap-3">
									{#if member.picture_url}
										<img
											src={member.picture_url}
											alt=""
											class="h-10 w-10 rounded-full bg-slate-100 object-cover"
										/>
									{:else}
										<div
											class="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
										>
											<span class="text-sm font-bold">{member.display_name?.[0] || '?'}</span>
										</div>
									{/if}
									<div>
										<p class="font-bold text-slate-800">{member.display_name || 'Guest User'}</p>
										<p class="font-mono text-[10px] text-slate-400">{member.user_line_id}</p>
									</div>
								</div>
							</td>
							<td class="px-6 py-4">
								<p class="text-sm text-slate-600">{member.birth_date_text || '-'}</p>
							</td>
							<td class="px-6 py-4">
								<span
									class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider
										{member.verification_status === 'approved'
										? 'bg-emerald-100 text-emerald-700'
										: member.verification_status === 'rejected'
											? 'bg-rose-100 text-rose-700'
											: member.verification_status === 'pending'
												? 'bg-amber-100 text-amber-700'
												: 'bg-slate-100 text-slate-600'}"
								>
									{member.verification_status}
								</span>
							</td>
							<td class="px-6 py-4 text-sm text-slate-500">
								{new Date(member.created_at).toLocaleDateString('th-TH')}
							</td>
							<td class="px-6 py-4 text-right">
								<div class="flex justify-end gap-2">
									{#if member.verification_status === 'pending' || member.verification_status === 'unregistered' || member.verification_status === 'rejected'}
										<button
											onclick={() => updateStatus(member.user_line_id, 'approved')}
											class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-600 active:scale-95"
										>
											Approve
										</button>
									{/if}
									{#if member.verification_status === 'pending' || member.verification_status === 'approved'}
										<button
											onclick={() => updateStatus(member.user_line_id, 'rejected')}
											class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-rose-100 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
										>
											Reject
										</button>
									{/if}
									<button
										onclick={() => deleteMember(member.user_line_id)}
										class="rounded-lg p-1.5 text-slate-400 transition-colors hover:text-rose-500"
										title="Delete Member"
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
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Mobile View (Cards) -->
		<div class="space-y-4 md:hidden">
			{#each filteredMembers as member (member.user_line_id)}
				<div class="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200" transition:fade>
					<div class="mb-4 flex items-start justify-between">
						<div class="flex items-center gap-3">
							{#if member.picture_url}
								<img
									src={member.picture_url}
									alt=""
									class="h-12 w-12 rounded-full bg-slate-100 object-cover"
								/>
							{:else}
								<div
									class="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
								>
									<span class="text-sm font-bold">{member.display_name?.[0] || '?'}</span>
								</div>
							{/if}
							<div>
								<h3 class="font-bold text-slate-800">{member.display_name || 'Guest User'}</h3>
								<p class="font-mono text-[10px] text-slate-400">{member.user_line_id}</p>
							</div>
						</div>
						<span
							class="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider
								{member.verification_status === 'approved'
								? 'bg-emerald-100 text-emerald-700'
								: member.verification_status === 'rejected'
									? 'bg-rose-100 text-rose-700'
									: member.verification_status === 'pending'
										? 'bg-amber-100 text-amber-700'
										: 'bg-slate-100 text-slate-600'}"
						>
							{member.verification_status}
						</span>
					</div>

					<div class="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-center">
						<div>
							<p class="mb-0.5 text-[9px] font-bold uppercase text-slate-400">Birth Date</p>
							<p class="text-xs font-bold text-slate-700">{member.birth_date_text || '-'}</p>
						</div>
						<div>
							<p class="mb-0.5 text-[9px] font-bold uppercase text-slate-400">Joined</p>
							<p class="text-xs font-bold text-slate-700">
								{new Date(member.created_at).toLocaleDateString('th-TH')}
							</p>
						</div>
					</div>

					<div class="flex items-center gap-2">
						{#if member.verification_status === 'pending' || member.verification_status === 'unregistered' || member.verification_status === 'rejected'}
							<button
								onclick={() => updateStatus(member.user_line_id, 'approved')}
								class="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-sm active:scale-95"
							>
								Approve
							</button>
						{/if}
						{#if member.verification_status === 'pending' || member.verification_status === 'approved'}
							<button
								onclick={() => updateStatus(member.user_line_id, 'rejected')}
								class="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 active:scale-95"
							>
								Reject
							</button>
						{/if}
						<button
							onclick={() => deleteMember(member.user_line_id)}
							class="rounded-xl border border-slate-200 p-2.5 text-slate-400 hover:text-rose-500"
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
			{/each}
		</div>
	{/if}
</main>
