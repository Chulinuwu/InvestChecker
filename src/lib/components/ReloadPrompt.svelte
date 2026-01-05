<script lang="ts">
	import { onMount } from 'svelte';
	import { useRegisterSW } from 'virtual:pwa-register/svelte';

	let offlineReady = $state(false);
	let needRefresh = $state(false);
	let swRegistration: ServiceWorkerRegistration | undefined = $state(undefined);

	const { updateServiceWorker } = useRegisterSW({
		onRegistered(r) {
			swRegistration = r;
		},
		onRegisterError(error) {
			console.error('SW registration error', error);
		},
		onOfflineReady() {
			offlineReady = true;
		},
		onNeedRefresh() {
			needRefresh = true;
		}
	});

	function close() {
		offlineReady = false;
		needRefresh = false;
	}

	onMount(() => {
		// Check for updates periodically
		const intervalMS = 60 * 60 * 1000; // 1 hour
		setInterval(() => {
			swRegistration?.update();
		}, intervalMS);
	});
</script>

{#if needRefresh}
	<div class="pwa-toast" role="alert">
		<div class="pwa-message">
			<span>🔄 มีเวอร์ชันใหม่พร้อมใช้งาน</span>
		</div>
		<div class="pwa-buttons">
			<button class="pwa-refresh" onclick={() => updateServiceWorker(true)}>
				อัปเดต
			</button>
			<button class="pwa-close" onclick={close}>
				ปิด
			</button>
		</div>
	</div>
{/if}

<style>
	.pwa-toast {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.75rem;
		background: linear-gradient(135deg, rgba(99, 102, 241, 0.95), rgba(139, 92, 246, 0.95));
		backdrop-filter: blur(10px);
		box-shadow:
			0 10px 40px rgba(99, 102, 241, 0.3),
			0 0 0 1px rgba(255, 255, 255, 0.1);
		color: white;
		font-size: 0.875rem;
		animation: slideIn 0.3s ease-out;
	}

	@keyframes slideIn {
		from {
			transform: translateY(100%);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.pwa-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.pwa-buttons {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.pwa-refresh {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.5rem;
		background: white;
		color: #6366f1;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pwa-refresh:hover {
		background: #f0f0ff;
		transform: scale(1.05);
	}

	.pwa-close {
		padding: 0.5rem 1rem;
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 0.5rem;
		background: transparent;
		color: white;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.pwa-close:hover {
		background: rgba(255, 255, 255, 0.1);
	}

	@media (max-width: 640px) {
		.pwa-toast {
			left: 1rem;
			right: 1rem;
		}
	}
</style>
