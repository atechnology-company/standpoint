<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import type { TierlistData, PollData } from '$lib/firestore-re-export';

	export let data: {
		query: string;
		tierlists: TierlistData[];
		polls: PollData[];
		users: any[];
	};

	let searchQuery = data.query || '';
	let searchType = 'all';
	let isSearching = false;

	$: filteredResults = {
		tierlists: searchType === 'all' || searchType === 'tierlists' ? data.tierlists : [],
		polls: searchType === 'all' || searchType === 'polls' ? data.polls : [],
		users: searchType === 'all' || searchType === 'users' ? data.users : []
	};

	$: totalResults =
		filteredResults.tierlists.length + filteredResults.polls.length + filteredResults.users.length;

	async function handleSearch() {
		if (!searchQuery.trim()) return;

		isSearching = true;
		await goto(`/search?q=${encodeURIComponent(searchQuery.trim())}&type=${searchType}`);
		isSearching = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}

	onMount(() => {
		// Focus search input on mount
		const searchInput = document.getElementById('search-input');
		if (searchInput && !data.query) {
			searchInput.focus();
		}
	});
</script>

<svelte:head>
	<title>Search{data.query ? ` - ${data.query}` : ''} - Standpoint</title>
</svelte:head>

<div class="min-h-screen bg-black text-white">
	<!-- Search Header -->
	<div class="sticky top-0 z-10 border-b border-gray-700 bg-gray-900/90 backdrop-blur-md">
		<div class="container mx-auto px-6 py-4">
			<div class="flex items-center gap-4">
				<!-- Search Input -->
				<div class="relative flex-1">
					<input
						id="search-input"
						type="text"
						bind:value={searchQuery}
						on:keydown={handleKeydown}
						placeholder="Search tierlists, polls, and users..."
						class="w-full border border-gray-600 bg-gray-800 px-4 py-3 text-white placeholder-gray-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
					/>
					<div class="absolute top-1/2 right-3 -translate-y-1/2 transform">
						<button
							on:click={handleSearch}
							disabled={isSearching || !searchQuery.trim()}
							class="p-1 text-gray-400 transition-colors hover:text-white disabled:opacity-50"
						>
							{#if isSearching}
								<div
									class="h-5 w-5 animate-spin border-2 border-orange-500 border-t-transparent"
								></div>
							{:else}
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
									/>
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<!-- Search Type Filter -->
				<div class="flex bg-gray-800 p-1">
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'all'
							? 'bg-orange-500 text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => (searchType = 'all')}
					>
						All
					</button>
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'tierlists'
							? 'bg-orange-500 text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => (searchType = 'tierlists')}
					>
						Tierlists
					</button>
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'polls'
							? 'bg-orange-500 text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => (searchType = 'polls')}
					>
						Polls
					</button>
					<button
						class="px-4 py-2 text-sm transition-all {searchType === 'users'
							? 'bg-orange-500 text-white'
							: 'text-gray-400 hover:text-white'}"
						on:click={() => (searchType = 'users')}
					>
						Users
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Search Results -->
	<div class="container mx-auto px-6 py-8">
		{#if data.query}
			<!-- Results Header -->
			<div class="mb-8">
				<h1 class="mb-2 text-3xl font-bold">Search Results</h1>
				<p class="text-gray-400">
					Found {totalResults} results for "<span class="font-medium text-white">{data.query}</span
					>"
				</p>
			</div>

			<!-- Results -->
			{#if totalResults === 0}
				<div class="py-16 text-center">
					<div class="mb-4 text-6xl">🔍</div>
					<h3 class="mb-2 text-xl font-semibold text-white">No results found</h3>
					<p class="mb-6 text-gray-400">Try adjusting your search terms or browse our content</p>
					<div class="flex justify-center gap-4">
						<a
							href="/tierlists"
							class="bg-orange-500 px-6 py-3 text-white transition-colors hover:bg-orange-600"
						>
							Browse Tierlists
						</a>
						<a
							href="/polls"
							class="bg-gray-700 px-6 py-3 text-white transition-colors hover:bg-gray-600"
						>
							Browse Polls
						</a>
					</div>
				</div>
			{:else}
				<!-- Tierlists -->
				{#if filteredResults.tierlists.length > 0}
					<section class="mb-12">
						<h2 class="mb-6 flex items-center gap-2 text-2xl font-bold">
							<span>📊</span>
							Tierlists ({filteredResults.tierlists.length})
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each filteredResults.tierlists as tierlist}
								<a href="/tierlists/{tierlist.id}" class="group block">
									<div
										class="border border-white/10 bg-gray-800/50 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-700/50"
									>
										{#if tierlist.thumbnail}
											<img
												src={tierlist.thumbnail}
												alt={tierlist.title}
												class="mb-3 h-32 w-full object-cover"
											/>
										{:else}
											<div
												class="mb-3 flex h-32 w-full items-center justify-center bg-gradient-to-br from-orange-500/20 to-pink-500/20"
											>
												<span class="text-4xl">📊</span>
											</div>
										{/if}
										<h3 class="mb-2 line-clamp-2 font-semibold text-white">{tierlist.title}</h3>
										{#if tierlist.description}
											<p class="mb-3 line-clamp-2 text-sm text-white/60">{tierlist.description}</p>
										{/if}
										<div class="flex items-center justify-between text-xs text-white/40">
											<span>{tierlist.likes || 0} likes</span>
											<span>{tierlist.comments || 0} comments</span>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Polls -->
				{#if filteredResults.polls.length > 0}
					<section class="mb-12">
						<h2 class="mb-6 flex items-center gap-2 text-2xl font-bold">
							<span>📊</span>
							Polls ({filteredResults.polls.length})
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each filteredResults.polls as poll}
								<a href="/polls/{poll.id}" class="group block">
									<div
										class="border border-white/10 bg-gray-800/50 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-700/50"
									>
										<h3 class="mb-2 line-clamp-2 font-semibold text-white">{poll.title}</h3>
										{#if poll.description}
											<p class="mb-3 line-clamp-2 text-sm text-white/60">{poll.description}</p>
										{/if}
										<div class="flex items-center justify-between text-xs text-white/40">
											<span>{poll.likes || 0} likes</span>
											<span>{poll.comments || 0} comments</span>
											<span>{poll.totalVotes || 0} votes</span>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Users -->
				{#if filteredResults.users.length > 0}
					<section class="mb-12">
						<h2 class="mb-6 flex items-center gap-2 text-2xl font-bold">
							<span>👥</span>
							Users ({filteredResults.users.length})
						</h2>
						<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
							{#each filteredResults.users as user}
								<a href="/user/{user.uid}" class="group block">
									<div
										class="border border-white/10 bg-gray-800/50 p-6 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-gray-700/50"
									>
										<div class="flex items-center gap-4">
											<img
												src={user.photoURL ||
													`https://api.dicebear.com/7.x/initials/svg?seed=${user.displayName || 'User'}`}
												alt={user.displayName}
												class="h-12 w-12 object-cover"
											/>
											<div class="flex-1">
												<h3 class="mb-1 font-semibold text-white">
													{user.displayName || 'Anonymous User'}
												</h3>
												{#if user.bio}
													<p class="line-clamp-2 text-sm text-white/60">{user.bio}</p>
												{/if}
												<div class="mt-2 flex items-center gap-4 text-xs text-white/40">
													<span>{user.aura || 0} aura</span>
													<span>{user.tierlistsCreated || 0} tierlists</span>
													<span>{user.pollsCreated || 0} polls</span>
												</div>
											</div>
										</div>
									</div>
								</a>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		{:else}
			<!-- Empty Search State -->
			<div class="py-16 text-center">
				<div class="mb-4 text-6xl">🔍</div>
				<h1 class="mb-4 text-3xl font-bold">Search Standpoint</h1>
				<p class="mx-auto mb-8 max-w-md text-gray-400">
					Discover amazing tierlists, polls, and creators in our community
				</p>

				<!-- Popular Searches -->
				<div class="mb-8">
					<h3 class="mb-4 text-lg font-semibold">Popular Searches</h3>
					<div class="flex flex-wrap justify-center gap-2">
						{#each ['movies', 'anime', 'games', 'music', 'food', 'sports'] as tag}
							<button
								class="bg-gray-800 px-4 py-2 text-white transition-colors hover:bg-orange-500"
								on:click={() => {
									searchQuery = tag;
									handleSearch();
								}}
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="flex justify-center gap-4">
					<a
						href="/tierlists"
						class="bg-orange-500 px-6 py-3 text-white transition-colors hover:bg-orange-600"
					>
						Browse Tierlists
					</a>
					<a
						href="/polls"
						class="bg-gray-700 px-6 py-3 text-white transition-colors hover:bg-gray-600"
					>
						Browse Polls
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
