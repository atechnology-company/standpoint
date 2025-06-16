<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { apiClient } from '$lib/api';

	let tierList: any = null;
	let loading = true;
	let error = '';

	onMount(async () => {
		const urlParams = new URLSearchParams(window.location.search);
		const id = urlParams.get('id');
		if (id) {
			await loadTierList(parseInt(id));
		} else {
			error = 'No tier list ID provided';
			loading = false;
		}
	});

	async function loadTierList(id: number) {
		try {
			loading = true;
			error = '';
			tierList = await apiClient.getTierList(id);
		} catch (err) {
			error = 'Failed to load tier list';
			console.error('Error loading tier list:', err);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>{tierList ? tierList.title : 'Tier List'} - Standpoint</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="mb-8 flex items-center">
		<a
			href="/tierlists"
			class="mr-4 rounded bg-gray-500 px-4 py-2 font-bold text-white hover:bg-gray-700"
		>
			← Back
		</a>
		{#if tierList}
			<h1 class="text-3xl font-bold">{tierList.title}</h1>
		{/if}
	</div>

	{#if error}
		<div class="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
			{error}
		</div>
	{/if}

	{#if loading}
		<div class="py-8 text-center">
			<div class="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500"></div>
			<p class="mt-2">Loading tier list...</p>
		</div>
	{:else if tierList}
		<div class="rounded-lg bg-white p-6 shadow-md">
			{#if tierList.description}
				<p class="mb-6 text-gray-600">{tierList.description}</p>
			{/if}

			<div class="space-y-4">
				{#each tierList.tiers as tier, tierIndex}
					<div class="overflow-hidden rounded-lg border">
						<div class="bg-gradient-to-r from-blue-500 to-purple-600 p-4 font-bold text-white">
							<h3 class="text-lg">{tier}</h3>
						</div>
						<div class="min-h-[100px] bg-gray-50 p-4">
							<div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
								{#each tierList.items as item}
									<div
										class="cursor-pointer rounded-lg border-2 border-gray-200 bg-white p-3 text-center transition-colors hover:border-blue-300"
									>
										<span class="text-sm font-medium">{item}</span>
									</div>
								{/each}
							</div>
							{#if tierList.items.length === 0}
								<p class="py-8 text-center text-gray-400">No items in this tier yet</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-6 text-sm text-gray-500">
				Created: {new Date(tierList.created_at).toLocaleDateString()}
			</div>
		</div>
	{/if}
</div>
