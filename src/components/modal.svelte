<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	export let open: boolean = false;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	function closeModal() {
		dispatch('close');
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			closeModal();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<div
		class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black backdrop-blur-sm"
		transition:fade={{ duration: 300 }}
		on:click={handleBackdropClick}
		on:keydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="relative max-h-[90vh] w-full max-w-md transform overflow-auto border border-gray-700 bg-gray-800 p-6 shadow-2xl transition-all duration-300"
			transition:fly={{ y: -30, duration: 300, opacity: 0 }}
			role="document"
			style="box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1);"
		>
			<button
				class="absolute top-4 right-4 p-1 text-gray-400 transition-all duration-200 hover:scale-110 hover:bg-gray-700 hover:text-white"
				on:click={closeModal}
				aria-label="Close modal"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
			<slot />
		</div>
	</div>
{/if}
