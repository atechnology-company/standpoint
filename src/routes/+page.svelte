<script lang="ts">
	import { goto } from '$app/navigation';
	import { currentUser } from '$lib/stores';
	import Toast from '../components/toast.svelte';

	function navigateToCreate() {
		goto('/tierlists/create');
	}

	function navigateToPolls() {
		goto('/polls');
	}

	function navigateToFeed() {
		goto('/feed');
	}
</script>

<svelte:head>
	<title>Standpoint - The Ultimate Platform for Sharing Standpoints</title>
	<meta
		name="description"
		content="Create tier lists and polls, share your opinions, discover what others think."
	/>
</svelte:head>

<div class="theme-transition min-h-screen" style="background-color: var(--bg); color: var(--text);">
	<!-- Hero Section -->
	<div class="flex min-h-screen flex-col items-center justify-center px-6">
		<div class="mx-auto max-w-4xl text-center">
			<!-- Logo/Title -->
			<h1 class="mb-6 text-6xl font-bold tracking-tight md:text-8xl">Standpoint</h1>

			<!-- Subtitle -->
			<p class="mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-gray-400 md:text-2xl">
				Create tier lists and polls. Share your opinions. Discover what others think.
			</p>

			<!-- Action Buttons -->
			<div class="flex flex-col items-center justify-center gap-4 sm:flex-row">
				<button
					on:click={navigateToCreate}
					class="w-full bg-white px-8 py-4 text-lg font-semibold text-black transition-colors hover:bg-gray-100 sm:w-auto"
				>
					Create Tier List
				</button>

				<button
					on:click={navigateToPolls}
					class="w-full border border-gray-600 px-8 py-4 text-lg font-semibold text-white transition-colors hover:border-gray-400 hover:bg-gray-900 sm:w-auto"
				>
					Browse Polls
				</button>
			</div>

			<!-- Secondary Action -->
			<div class="mt-8">
				<button
					on:click={navigateToFeed}
					class="text-lg text-gray-400 underline transition-colors hover:text-white"
				>
					Explore the feed
				</button>
			</div>
		</div>

		<!-- Scroll Indicator -->
		<div class="absolute bottom-8 left-1/2 -translate-x-1/2 transform">
			<div class="flex h-10 w-6 justify-center border-2 border-gray-600">
				<div class="mt-2 h-3 w-1 animate-bounce bg-gray-600"></div>
			</div>
		</div>
	</div>

	<!-- Features Section -->
	<div class="px-6 py-24">
		<div class="mx-auto max-w-6xl">
			<div class="grid gap-12 md:grid-cols-3">
				<!-- Feature 1 -->
				<div class="text-center">
					<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-gray-900">
						<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
					</div>
					<h3 class="mb-4 text-xl font-semibold">Create</h3>
					<p class="text-gray-400">
						Build tier lists and polls with an intuitive drag-and-drop interface
					</p>
				</div>

				<!-- Feature 2 -->
				<div class="text-center">
					<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-gray-900">
						<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
							/>
						</svg>
					</div>
					<h3 class="mb-4 text-xl font-semibold">Share</h3>
					<p class="text-gray-400">
						Share your creations with the community and get instant feedback
					</p>
				</div>

				<!-- Feature 3 -->
				<div class="text-center">
					<div class="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-gray-900">
						<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</div>
					<h3 class="mb-4 text-xl font-semibold">Discover</h3>
					<p class="text-gray-400">Explore trending topics and see what the community is ranking</p>
				</div>
			</div>
		</div>
	</div>

	<!-- CTA Section -->
	<div class="border-t border-gray-900 px-6 py-24">
		<div class="mx-auto max-w-2xl text-center">
			<h2 class="mb-6 text-3xl font-bold md:text-4xl">Ready to share your standpoint?</h2>
			<p class="mb-8 text-lg text-gray-400">
				Join thousands of users creating and sharing their opinions
			</p>
			<button
				on:click={navigateToCreate}
				class="bg-white px-8 py-4 text-lg font-semibold text-black transition-colors hover:bg-gray-100"
			>
				Get Started
			</button>
		</div>
	</div>
</div>

<Toast />
