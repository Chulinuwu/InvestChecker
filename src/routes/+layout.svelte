<script lang="ts">
	import '../app.css';
	import { browser } from '$app/environment';
	import ReloadPrompt from '$lib/components/ReloadPrompt.svelte';
	let { children } = $props();
</script>

{@render children()}

{#if browser}
	<ReloadPrompt />
{/if}

