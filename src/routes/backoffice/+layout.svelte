<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { fade } from 'svelte/transition';

	let { children } = $props();

	function isActive(path: string, tab?: string) {
		const currentPath = page.url.pathname;
		const currentTab = page.url.searchParams.get('tab');

		if (tab) {
			return currentPath === path && currentTab === tab;
		}
		if (path === '/backoffice') {
			// Special case for products tab which is default
			return currentPath === path && !currentTab;
		}
		return currentPath === path;
	}

	function logout() {
		localStorage.removeItem('isAdminAuthenticated');
		goto('/');
	}
</script>

<div class="min-h-screen bg-slate-50 pb-32 text-slate-900 md:pb-10">
	<!-- Top Navbar (Desktop + Mobile Header) -->
	<nav
		class="sticky top-0 z-20 border-b border-slate-100 bg-white/80 px-4 py-2 backdrop-blur-md md:px-8 md:py-3"
	>
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<!-- Logo -->
			<div class="flex items-center gap-2">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-100"
				>
					<span class="text-base font-bold">TT</span>
				</div>
				<h1
					class="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-xl font-bold text-transparent"
				>
					Backoffice
				</h1>
			</div>

			<!-- Desktop Menu -->
			<div class="mx-10 hidden max-w-2xl flex-1 md:block">
				<div class="flex rounded-xl bg-slate-100/80 p-1">
					<button
						class="flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition-all {isActive(
							'/backoffice'
						)
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => goto('/backoffice')}
					>
						Products
					</button>
					<button
						class="flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition-all {isActive(
							'/backoffice/sets'
						)
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => goto('/backoffice/sets')}
					>
						Sets
					</button>
					<button
						class="flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition-all {isActive(
							'/backoffice',
							'preorders'
						)
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => goto('/backoffice?tab=preorders')}
					>
						Pre-orders
					</button>
					<button
						class="flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition-all {isActive(
							'/backoffice/members'
						)
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => goto('/backoffice/members')}
					>
						Members
					</button>
					<button
						class="flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition-all {isActive(
							'/backoffice/settings'
						)
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => goto('/backoffice/settings')}
					>
						Settings
					</button>
					<button
						class="flex-1 rounded-lg px-4 py-1.5 text-sm font-bold transition-all {isActive(
							'/backoffice/gifts'
						)
							? 'bg-white text-indigo-600 shadow-sm'
							: 'text-slate-500 hover:text-slate-700'}"
						onclick={() => goto('/backoffice/gifts')}
					>
						Gifts
					</button>
				</div>
			</div>

			<!-- Logout -->
			<button
				onclick={logout}
				class="flex-shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-red-500 md:px-4 md:py-2 md:text-sm"
			>
				Logout
			</button>
		</div>
	</nav>

	<!-- Mobile Bottom Navigation -->
	<nav class="fixed bottom-6 left-1/2 z-30 w-[90%] -translate-x-1/2 md:hidden">
		<div
			class="flex items-center justify-around rounded-2xl bg-white/90 p-2 shadow-2xl ring-1 ring-slate-200 backdrop-blur-lg"
		>
			<button
				onclick={() => goto('/backoffice')}
				class="flex flex-col items-center gap-1 rounded-xl p-2 px-3 transition-all {isActive(
					'/backoffice'
				)
					? 'bg-indigo-50 text-indigo-600'
					: 'text-slate-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
					/>
				</svg>
				<span class="text-[10px] font-bold">Products</span>
			</button>
			<button
				onclick={() => goto('/backoffice/sets')}
				class="flex flex-col items-center gap-1 rounded-xl p-2 px-3 transition-all {isActive(
					'/backoffice/sets'
				)
					? 'bg-indigo-50 text-indigo-600'
					: 'text-slate-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 10h16M4 14h16M4 18h16"
					/>
				</svg>
				<span class="text-[10px] font-bold">Sets</span>
			</button>
			<button
				onclick={() => goto('/backoffice?tab=preorders')}
				class="flex flex-col items-center gap-1 rounded-xl p-2 px-3 transition-all {isActive(
					'/backoffice',
					'preorders'
				)
					? 'bg-indigo-50 text-indigo-600'
					: 'text-slate-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
				<span class="text-[10px] font-bold">Orders</span>
			</button>
			<button
				onclick={() => goto('/backoffice/members')}
				class="flex flex-col items-center gap-1 rounded-xl p-2 px-3 transition-all {isActive(
					'/backoffice/members'
				)
					? 'bg-indigo-50 text-indigo-600'
					: 'text-slate-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
				<span class="text-[10px] font-bold">Members</span>
			</button>
			<button
				onclick={() => goto('/backoffice/gifts')}
				class="flex flex-col items-center gap-1 rounded-xl p-2 px-3 transition-all {isActive(
					'/backoffice/gifts'
				)
					? 'bg-indigo-50 text-indigo-600'
					: 'text-slate-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
					/>
				</svg>
				<span class="text-[10px] font-bold">Gifts</span>
			</button>
			<button
				onclick={() => goto('/backoffice/settings')}
				class="flex flex-col items-center gap-1 rounded-xl p-2 px-3 transition-all {isActive(
					'/backoffice/settings'
				)
					? 'bg-indigo-50 text-indigo-600'
					: 'text-slate-400'}"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.350a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.350 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
				<span class="text-[10px] font-bold">Settings</span>
			</button>
		</div>
	</nav>

	{@render children()}
</div>
