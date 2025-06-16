<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Sidebar from '../../../components/sidebar.svelte';
	import { apiClient } from '$lib/api';

	interface TierItem {
		id: string;
		text: string;
		position?: number;
	}

	interface Tier {
		name: string;
		items: TierItem[];
	}

	let tierList: any = null;
	let loading = true;
	let error = '';
	let selectedItem: TierItem | null = null;

	import { get } from 'svelte/store';

	$: tierListId = (get(page) as { params: { id: string } }).params.id;

	onMount(async () => {
		await loadTierList();
	});

	async function loadTierList() {
		try {
			loading = true;
			error = '';
			tierList = await apiClient.getTierList(Number(tierListId));
		} catch (err) {
			error = 'Failed to load tier list';
			console.error('Error loading tier list:', err);
		} finally {
			loading = false;
		}
	}

	function selectItem(item: TierItem) {
		selectedItem = selectedItem?.id === item.id ? null : item;
	}

	function getItemsForTier(tierName: string): TierItem[] {
		if (!tierList?.placements) return [];

		return tierList.placements
			.filter((p: any) => p.tier === tierName)
			.map((p: any) => ({
				id: p.item_id,
				text: tierList.items.find((item: any) => item.id === p.item_id)?.text || 'Unknown',
				position: p.position
			}))
			.sort((a: TierItem, b: TierItem) => (a.position || 0) - (b.position || 0));
	}

	function getUnplacedItems(): TierItem[] {
		if (!tierList?.items || !tierList?.placements) return [];

		const placedItemIds = new Set(tierList.placements.map((p: any) => p.item_id));
		return tierList.items
			.filter((item: any) => !placedItemIds.has(item.id))
			.map((item: any) => ({
				id: item.id,
				text: item.text
			}));
	}

	const tierColors = [
		'#ff7f7f',
		'#ffbf7f',
		'#ffff7f',
		'#bfff7f',
		'#7fff7f',
		'#7fffff',
		'#7fbfff',
		'#7f7fff',
		'#bf7fff',
		'#ff7fff'
	];
</script>

<svelte:head>
	<title>{tierList?.title || 'Tier List'} - Standpoint</title>
</svelte:head>

{#if loading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-xl text-gray-600">Loading tier list...</div>
	</div>
{:else if error}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<div class="mb-4 text-xl text-red-600">{error}</div>
			<a
				href="/tierlists"
				class="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
			>
				Back to Tier Lists
			</a>
		</div>
	</div>
{:else if tierList}
	<div class="flex min-h-screen bg-gray-50">
		<!-- Main Content -->
		<div class="flex-1 p-6">
			<!-- Header -->
			<div class="mb-6">
				<div class="mb-4 flex items-center space-x-4">
					<a
						href="/tierlists"
						class="rounded bg-gray-500 px-4 py-2 font-bold text-white transition-colors hover:bg-gray-700"
					>
						← Back
					</a>
					<h1 class="text-3xl font-bold text-gray-800">{tierList.title}</h1>
				</div>
				<div class="text-gray-500 italic">AI-generated description will appear here</div>
			</div>

			<!-- Tier List Display -->
			<div class="space-y-4">
				{#each tierList.tiers as tier, index (tier)}
					{@const tierItems = getItemsForTier(tier)}
					<div class="overflow-hidden rounded-lg border bg-white shadow-sm">
						<!-- Tier Header -->
						<div
							class="p-4 text-lg font-bold text-gray-800"
							style="background-color: {tierColors[index % tierColors.length]};"
						>
							{tier}
						</div>

						<!-- Tier Items -->
						<div class="min-h-[100px] p-4">
							{#if tierItems.length > 0}
								<div class="flex flex-wrap gap-3">
									{#each tierItems as item (item.id)}
										<div
											class="cursor-pointer rounded-lg bg-gray-100 p-3 transition-colors hover:bg-gray-200 {selectedItem?.id ===
											item.id
												? 'bg-blue-50 ring-2 ring-blue-500'
												: ''}"
											on:click={() => selectItem(item)}
										>
											<span class="text-sm font-medium">{item.text}</span>
											{#if item.position !== undefined}
												<div class="mt-1 text-xs text-gray-500">
													Position: {item.position.toFixed(2)}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<div class="py-8 text-center text-gray-400 italic">No items in this tier</div>
							{/if}
						</div>
					</div>
				{/each}

				<!-- Unplaced Items -->
				{#if getUnplacedItems().length > 0}
					{@const unplacedItems = getUnplacedItems()}
					<div class="overflow-hidden rounded-lg border bg-white shadow-sm">
						<div class="bg-gray-200 p-4 text-lg font-bold text-gray-800">Unranked Items</div>
						<div class="p-4">
							<div class="flex flex-wrap gap-3">
								{#each unplacedItems as item (item.id)}
									<div
										class="cursor-pointer rounded-lg bg-gray-100 p-3 transition-colors hover:bg-gray-200 {selectedItem?.id ===
										item.id
											? 'bg-blue-50 ring-2 ring-blue-500'
											: ''}"
										on:click={() => selectItem(item)}
									>
										<span class="text-sm font-medium">{item.text}</span>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- Sidebar -->
		<div class="w-80 border-l border-gray-200 bg-white">
			<Sidebar
				title={tierList.title}
				author={tierList.author}
				date={tierList.created_at}
				revision={1}
				shareUrl={`/tierlists/${tierList.id}`}
				type="tierlist"
			/>
		</div>
	</div>
{/if}
