<script lang="ts">
	import { onMount } from 'svelte';
	import { getAuth, onAuthStateChanged } from 'firebase/auth';
	import LoadingIndicator from '../../../components/loading-indicator.svelte';

	let user: any = null;
	let loading = true;
	let error = '';

	onMount(() => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, async (u) => {
			user = u;
			loading = false;
		});
		return unsubscribe;
	});

	async function startCheckout() {
		if (!user) {
			error = 'You must be signed in to purchase the Pro plan.';
			return;
		}
		try {
			const res = await fetch('/api/create-stripe-session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ uid: user.uid })
			});
			const data = await res.json();
			if (data.url) {
				window.location.href = data.url;
			} else {
				error = data.error || 'Failed to start checkout.';
			}
		} catch (e) {
			error = 'An error occurred while starting checkout.';
		}
	}
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
	<h1 class="mb-4 text-3xl font-bold">Checkout for Standpoint Pro</h1>
	{#if loading}
		<LoadingIndicator size="lg" />
	{:else}
		{#if error}
			<div class="mb-2 text-red-500">{error}</div>
		{/if}
		<button
			class="bg-gradient-to-r from-indigo-500 to-pink-500 px-8 py-3 font-semibold text-white shadow-lg transition hover:scale-105"
			on:click={startCheckout}
			disabled={!user}
		>
			{user ? 'Proceed to Stripe Checkout' : 'Sign in to continue'}
		</button>
	{/if}
</div>
