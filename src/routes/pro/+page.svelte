<script lang="ts">
	import { onMount } from 'svelte';
	import { getUserGroup, setUserGroup } from '$lib/user-groups';
	import { getAuth, onAuthStateChanged } from 'firebase/auth';
	import LoadingIndicator from '../../components/loading-indicator.svelte';

	let user: any = null;
	let loading = true;
	let error = '';
	let purchased = false;

	onMount(() => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, async (u) => {
			user = u;
			loading = false;
		});
		return unsubscribe;
	});

	async function handlePurchase() {
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
			if (res.ok) {
				const data = await res.json();
				if (data.url) {
					window.location.href = data.url;
					return;
				}
				if (data.error) {
					throw new Error(data.error);
				}
			}
			throw new Error('Backend unavailable');
		} catch (e) {
			error = 'Checkout service unavailable. Please try again later.';
		}
	}

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('session_id') && user) {
			try {
				const res = await fetch('/api/verify-stripe-session', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						session_id: params.get('session_id'),
						uid: user.uid
					})
				});
				if (res.ok) {
					const data = await res.json();
					if (data.success) {
						await setUserGroup(user.uid, 'pro');
						purchased = true;
						return;
					}
				}
				error = 'Purchase verification failed.';
			} catch (e) {
				error = 'Verification service unavailable.';
			}
		}
	});
</script>

<div
	class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden"
	style="background-color: var(--bg); color: var(--text);"
>
	<div class="absolute inset-0 -z-10">
		<svg
			width="100%"
			height="100%"
			class="h-full w-full"
			style="position:absolute;top:0;left:0;"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="20%" cy="30%" r="180" fill="#6366f1" fill-opacity="0.08">
				<animate attributeName="cx" values="20%;80%;20%" dur="18s" repeatCount="indefinite" />
			</circle>
			<circle cx="80%" cy="70%" r="140" fill="#f472b6" fill-opacity="0.07">
				<animate attributeName="cy" values="70%;30%;70%" dur="22s" repeatCount="indefinite" />
			</circle>
			<circle cx="50%" cy="50%" r="220" fill="#fff" fill-opacity="0.04">
				<animate attributeName="r" values="220;260;220" dur="30s" repeatCount="indefinite" />
			</circle>
		</svg>
	</div>
	<div class="flex w-full max-w-3xl flex-col items-center px-6 py-20">
		<h1 class="mb-6 text-5xl font-extrabold tracking-tight md:text-6xl" style="color: var(--text);">
			Standpoint Pro
		</h1>
		<div class="mx-auto mb-8 max-w-2xl text-xl font-medium text-neutral-200 md:text-2xl">
			<span class="inline-block border border-neutral-800 bg-neutral-900/80 px-4 py-2"
				>One-time purchase: <span class="font-bold text-indigo-400">$40</span></span
			>
		</div>
		<ul class="mb-12 grid w-full grid-cols-1 gap-6 text-lg md:grid-cols-2">
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined" style="color: rgb(var(--primary))">palette</span> Customise
				accent color, backgrounds, and fonts
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined" style="color: rgb(var(--primary))">poll</span> Create
				unlimited polls with advanced analytics
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined text-pink-400">auto_awesome</span> AI-powered tierlist
				suggestions
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined text-yellow-400">star</span> Priority support & early
				access to new features
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined text-green-400">favorite</span> Support the development
				of Standpoint
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined text-purple-400">edit</span> Custom banners for your tierlists
				and profile
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined text-blue-400">insights</span> Detailed analytics on your
				content performance
			</li>
			<li class="flex items-center gap-3 border border-neutral-800 bg-neutral-900/80 px-6 py-5">
				<span class="material-symbols-outlined" style="color: rgb(var(--primary))">verified</span> Verified
				Pro badge on your profile
			</li>
		</ul>
		{#if loading}
			<LoadingIndicator size="lg" />
		{:else if purchased}
			<div class="text-2xl font-semibold text-green-400">
				Thank you for purchasing Pro! Your account has been upgraded.
			</div>
		{:else}
			{#if error}
				<div class="mb-2 text-red-400">{error}</div>
			{/if}
			<button
				class="animated-buy-btn w-full px-10 py-4 text-xl font-bold text-white shadow-lg transition-all duration-200 md:w-auto"
				style="background-color: rgb(var(--primary));"
				on:click={handlePurchase}
				disabled={!user}
			>
				{user ? 'Buy Pro – $40' : 'Sign in to buy'}
			</button>
			<style>
				.animated-buy-btn {
					position: relative;
					overflow: hidden;
				}
				.animated-buy-btn::after {
					content: '';
					position: absolute;
					left: 50%;
					top: 50%;
					width: 0;
					height: 0;
					background: rgba(255, 255, 255, 0.15);
					border-radius: 100%;
					transform: translate(-50%, -50%);
					transition:
						width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
						height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
					pointer-events: none;
				}
				.animated-buy-btn:hover::after {
					width: 300px;
					height: 300px;
				}
			</style>
			<div class="mt-4 text-sm text-neutral-500">
				Secured by Stripe. Instant upgrade after purchase.
			</div>
		{/if}
	</div>
</div>
