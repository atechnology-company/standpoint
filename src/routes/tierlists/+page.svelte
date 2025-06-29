<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';
	import Hero from '../../components/hero.svelte';

	let tierLists: any[] = [];
	let loading = true;
	let error = '';
	let heroSlides: any[] = [];

	// Store for like counts by tierlist id
	let likeCounts: Record<number, number> = {};

	onMount(async () => {
		await loadTierLists();
	});

	async function fetchLikeCount(tierlistId: number) {
		try {
			const res = await fetch(`/api/interactions/tierlist/${tierlistId}/likes`);
			if (!res.ok) return 0;
			const data = await res.json();
			return data.likes || 0;
		} catch {
			return 0;
		}
	}

	async function loadTierLists() {
		try {
			loading = true;
			error = '';
			tierLists = await apiClient.getTierLists();

			// Fetch like counts for all tierlists
			const likePromises = tierLists.map(async (tl) => {
				const likes = await fetchLikeCount(tl.id);
				likeCounts[tl.id] = likes;
				return likes;
			});
			await Promise.all(likePromises);

			// Create hero slides from random tierlists, using real like counts
			if (tierLists.length > 0) {
				heroSlides = tierLists.slice(0, 5).map((tierList, index) => ({
					header: tierList.title,
					author: tierList.author || 'Community',
					date: new Date(tierList.created_at).toISOString().split('T')[0],
					revision: 1,
					likes: likeCounts[tierList.id] || 0,
					comments: 0,
					forks: 0,
					backgroundColor: ['#FFD6E0', '#FFEFB5', '#C1E7E3', '#DCEBDD', '#E2D0F9'][index % 5],
					tierlist: tierList
				}));
			}
		} catch (err) {
			error = 'Failed to load tier lists. Make sure the backend server is running.';
			console.error('Error loading tier lists:', err);
		} finally {
			loading = false;
		}
	}

	function navigateToTierList(tierList: any) {
		window.location.href = `/tierlists/${tierList.id}`;
	}
</script>

<svelte:head>
	<title>Tier Lists - Standpoint</title>
</svelte:head>

<div class="min-h-screen bg-black">
	<!-- Hero Carousel -->
	{#if heroSlides.length > 0}
		<Hero slides={heroSlides} />
	{/if}

	<!-- Main Content Area -->
	<div>
		{#if error}
			<div class="container mx-auto mb-4 px-6">
				<div class="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
					{error}
				</div>
			</div>
		{/if}

		{#if loading}
			<div class="py-8 text-center">
				<div
					class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-purple-500"
				></div>
				<p class="mt-2 text-gray-600">Loading tier lists...</p>
			</div>
		{:else if tierLists.length === 0}
			<div class="py-16 text-center">
				<div class="mb-4 text-6xl">📋</div>
				<h3 class="mb-2 text-xl font-bold text-gray-600">No tier lists yet</h3>
				<p class="mb-6 text-gray-500">Be the first to create a tier list!</p>
			</div>
		{:else}
			<!-- Full width Sharp Grid -->
			<div
				class="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
			>
				{#each tierLists as tierList}
					<div
						class="relative h-64 cursor-pointer border-r border-b border-gray-800 transition-all duration-200 hover:brightness-110"
						style="background-color: {[
							'#FFD6E0',
							'#FFEFB5',
							'#C1E7E3',
							'#DCEBDD',
							'#E2D0F9',
							'#FFB5B5',
							'#B5E5FF'
						][Math.floor(Math.random() * 7)]};"
						on:click={() => navigateToTierList(tierList)}
						on:keydown={(e) => e.key === 'Enter' && navigateToTierList(tierList)}
						role="button"
						tabindex="0"
					>
						<!-- Overlay -->
						<div class="bg-opacity-40 absolute inset-0 bg-black"></div>

						<!-- Content -->
						<div class="relative flex h-full flex-col justify-between p-4 text-white">
							<!-- Top metadata -->
							<div class="flex items-start justify-between text-xs">
								<div class="flex gap-2 opacity-80">
									<span>{tierList.author || 'Community'}</span>
									<span>{new Date(tierList.created_at).toLocaleDateString()}</span>
								</div>
								<div class="flex items-center gap-2 opacity-80">
									<span class="flex items-center gap-1">
										<span class="material-symbols-outlined align-middle text-base">favorite</span>
										{likeCounts[tierList.id] || 0}
									</span>
									<span class="flex items-center gap-1">
										<span class="material-symbols-outlined align-middle text-base">chat_bubble</span
										>
										0
									</span>
									<span class="flex items-center gap-1">
										<span class="material-symbols-outlined align-middle text-base">fork_right</span>
										0
									</span>
								</div>
							</div>

							<!-- Title -->
							<div class="flex flex-1 items-center">
								<div class="w-full">
									<div class="mb-1 text-xs tracking-wide uppercase opacity-60">Tier List</div>
									<h3 class="text-xl leading-tight font-bold">{tierList.title}</h3>
								</div>
							</div>

							<!-- Bottom stats -->
							<div class="flex items-center justify-between text-xs opacity-80">
								<span>{tierList.tiers?.length || 4} tiers</span>
								<span>{tierList.items?.length || 0} items</span>
								<span
									class="px-2 py-1 text-white"
									style="
										background-color: {tierList.list_type === 'dynamic' ? '#ff570599' : '#05FFAC99'};
									"
								>
									{tierList.list_type || 'Classic'}
								</span>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Create Button -->
	<a
		href="/tierlists/create"
		class="fixed right-6 bottom-6 z-50 flex h-16 w-16 items-center justify-center bg-[#ff5705] text-white shadow-lg transition-colors duration-300 hover:bg-white hover:text-[#ff5705]"
		aria-label="Create new tier list"
	>
		<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
			></path>
		</svg>
	</a>
</div>
