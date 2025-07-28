<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	const dispatch = createEventDispatcher();

	function close() {
		dispatch('close');
	}
</script>

{#if open}
	<div class="bg-opacity-80 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="relative w-full max-w-sm min-w-[320px] border border-white bg-black p-8 shadow-lg">
			<button
				class="absolute top-3 right-3 m-0 border-0 bg-transparent p-0 text-2xl font-bold text-white hover:text-[#ff5705] focus:outline-none"
				on:click={close}
				aria-label="Close">&times;</button
			>
			<div class="flex flex-col items-center gap-6">
				<h2 class="mb-2 text-xl font-bold text-white">Sign in to Standpoint</h2>
				<button
					class="flex w-full items-center justify-center gap-2 border-0 bg-[#ff5705] px-4 py-2 font-semibold text-white transition-colors hover:bg-white hover:text-black focus:outline-none"
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

<style>
	/* Remove border radius and set black/white theme */
	.modal-btn {
		border-radius: 0 !important;
	}
</style>
