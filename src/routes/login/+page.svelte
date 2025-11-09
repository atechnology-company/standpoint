<script lang="ts">
	import Modal from '../../components/login-modal.svelte';
	let loginModalShown = true;

	function closeLoginModal() {
		loginModalShown = false;
	}

	function showLoginModal() {
		loginModalShown = true;
	}
</script>

{#if loginModalShown}
	<Modal on:close={closeLoginModal} />
{/if}

<div class="flex h-screen flex-col items-center justify-center">
	<h1 class="mb-4 text-2xl font-bold">Login Required</h1>
	<p class="mb-8">
		Please <button
			class="text-accent font-inherit cursor-pointer border-0 bg-transparent p-0 underline hover:no-underline"
			on:click={showLoginModal}>sign in</button
		> to access this page.
	</p>
</div>
