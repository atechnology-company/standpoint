<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';
	import Hero from '$lib/../components/hero.svelte';

	let tierLists: any[] = [];
	let polls: any[] = [];
	let randomTierLists: any[] = [];
	let tierlistLikes: Record<number, number> = {};

	async function fetchTierlistLikes(lists: any[]): Promise<Record<number, number>> {
		const results: Record<number, number> = {};
		await Promise.all(
			lists.map(async (tl) => {
				try {
					const res = await fetch(`/api/interactions/tierlist/${tl.id}/likes`);
					if (res.ok) {
						const data = await res.json();
						results[tl.id] = data.likes;
					} else {
						results[tl.id] = 0;
					}
				} catch {
					results[tl.id] = 0;
				}
			})
		);
		return results;
	}

	onMount(async () => {
		try {
			await apiClient.healthCheck();
			// Fetch tierlists and their like counts
			tierLists = (await apiClient.getTierLists?.()) ?? [];
			tierlistLikes = await fetchTierlistLikes(tierLists);

			// Optionally, fetch polls and their likes if needed
		} catch (err) {
			console.error('Backend health check failed:', err);
		}
	});
</script>

<svelte:head>
	<title>standpoint</title>
</svelte:head>

<main class="min-h-screen bg-black">
	<!-- Hero Section -->
	{#if randomTierLists.length > 0}
		<Hero slides={randomTierLists} />
	{/if}

	{#if tierLists.length > 0}
		<div class="bg-black text-white">
			<h2 class="m-5 my-6 text-left text-3xl font-bold">Tierlists</h2>
			<div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
				{#each tierLists as tierlist}
					<div
						class="flex h-40 flex-col items-center justify-center border-2 border-transparent bg-black p-4 transition-colors duration-100 hover:border-[#ff5705] hover:bg-[#191919]"
					>
						<a
							href={`/tierlists/${tierlist.id}`}
							class="text-center text-lg font-semibold text-white hover:underline"
						>
							{tierlist.title}
						</a>
						{#if tierlist.author}
							<div class="mt-2 text-sm text-gray-300">By {tierlist.author}</div>
						{/if}
						{#if tierlist.created_at}
							<div class="mt-1 text-xs text-gray-400">
								{new Date(tierlist.created_at).toLocaleDateString()}
							</div>
						{/if}
						<!-- Like/Comment/Fork row -->
						<div class="mt-2 flex items-center gap-4">
							<span class="flex items-center gap-1">
								<span class="material-symbols-outlined align-middle text-base text-pink-400"
									>favorite</span
								>
								<span class="text-xs text-gray-200">{tierlistLikes[tierlist.id] ?? 0}</span>
							</span>
							<span class="flex items-center gap-1">
								<span class="material-symbols-outlined align-middle text-base text-orange-200"
									>chat_bubble</span
								>
								<span class="text-xs text-gray-200">0</span>
							</span>
							<span class="flex items-center gap-1">
								<span class="material-symbols-outlined align-middle text-base text-blue-200"
									>fork_right</span
								>
								<span class="text-xs text-gray-200">0</span>
							</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if polls.length > 0}
		<div class="bg-black text-white">
			<h2 class="m-5 my-6 text-left text-3xl font-bold">Polls</h2>
			<div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
				{#each polls as poll}
					<div
						class="flex h-40 flex-col items-center justify-center border-2 border-transparent bg-black p-4 transition-colors duration-100 hover:border-[#ff5705] hover:bg-[#191919]"
					>
						<a
							href={`/polls/${poll.id}`}
							class="text-center text-lg font-semibold text-white hover:underline"
						>
							{poll.title}
						</a>
						{#if poll.author}
							<div class="mt-2 text-sm text-gray-300">By {poll.author}</div>
						{/if}
						{#if poll.created_at}
							<div class="mt-1 text-xs text-gray-400">
								{new Date(poll.created_at).toLocaleDateString()}
							</div>
						{/if}
						{#if poll.votes !== undefined}
							<div class="mt-1 text-xs text-gray-400">
								{poll.votes} votes
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</main>
