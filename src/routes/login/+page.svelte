<script lang="ts">
	import Modal from '../../components/login-modal.svelte';
	let loginModalShown = true;

	function closeLoginModal() {
		loginModalShown = false;
	}

    function showLoginModal() {loginModalShown = true;}
</script>

{#if loginModalShown}
	<Modal on:close={closeLoginModal} />
{/if}

<div class="flex flex-col items-center justify-center h-screen">
	<h1 class="text-2xl font-bold mb-4">Login Required</h1>
	<p class="mb-8">
      Please <a href="#" role="button" tabindex="0" on:click|preventDefault={showLoginModal}>sign in</a> to access this page.
    </p>
</div>
