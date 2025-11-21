<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center"
		style="background-color: rgba(0, 0, 0, 0.5);"
		on:click={close}
		on:keydown={(e) => e.key === 'Escape' && close()}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	>
		<div
			class="theme-transition relative w-full max-w-sm min-w-[320px] border p-8 shadow-lg"
			style="border-color: var(--text); background-color: var(--bg);"
		>
			<button
				class="absolute top-3 right-3 m-0 border-0 bg-transparent p-0 text-2xl font-bold text-white hover:text-[rgb(var(--primary))] focus:outline-none"
				on:click={close}
				aria-label="Close">&times;</button
			>
			<div class="flex flex-col items-center gap-6">
				<h2 class="mb-2 text-xl font-bold text-white">Sign in to Standpoint</h2>
				<button
					class="flex w-full items-center justify-center gap-2 border-0 bg-[rgb(var(--primary))] px-4 py-2 font-semibold text-white transition-colors hover:bg-white hover:text-black focus:outline-none"
					style="border-radius: 0;"
					on:click={() => dispatch('login')}
				>
					<img
						src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
						alt="Google"
						class="h-5 w-5"
					/>
					<span>Sign in with Google</span>
				</button>
			</div>
		</div>
	</div>
{/if}
