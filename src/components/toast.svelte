<script lang="ts">
	import { toasts, removeToast, type Toast } from '$lib/toast';
	import { fly } from 'svelte/transition';

	$: currentToasts = $toasts;

	function getToastColors(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'bg-green-600 border-green-500';
			case 'error':
				return 'bg-red-600 border-red-500';
			case 'warning':
				return 'bg-yellow-600 border-yellow-500';
			case 'info':
			default:
				return 'bg-blue-600 border-blue-500';
		}
	}

	function getToastIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return 'check_circle';
			case 'error':
				return 'error';
			case 'warning':
				return 'warning';
			case 'info':
			default:
				return 'info';
		}
	}
</script>

<div class="fixed top-4 right-4 z-50 space-y-2">
	{#each currentToasts as toast (toast.id)}
		<div
			class="flex items-center gap-3 border px-4 py-3 text-white shadow-lg {getToastColors(
				toast.type
			)}"
			transition:fly={{ x: 300, duration: 300 }}
		>
			<span class="material-symbols-outlined text-lg">
				{getToastIcon(toast.type)}
			</span>
			<span class="flex-1">{toast.message}</span>
			<button
				class="text-white/70 hover:text-white"
				on:click={() => removeToast(toast.id)}
				aria-label="Dismiss"
			>
				<span class="material-symbols-outlined text-lg">close</span>
			</button>
		</div>
	{/each}
</div>
