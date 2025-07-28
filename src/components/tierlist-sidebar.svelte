<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TierListResponse, TierCreate, TierItem } from '../lib/api';

	export let title: string = '';
	export let date: string = '';
	export let author: string = 'Anonymous';
	export let revision: number = 1;
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let tierListData: TierListResponse | null = null;

	const dispatch = createEventDispatcher();

	function handleShare() {
		if (navigator.share && shareUrl) {
			navigator.share({
				title: title,
				url: shareUrl
			});
		} else if (shareUrl) {
			navigator.clipboard.writeText(shareUrl);
			// Could add a toast notification here
		}
	}

	function handleDelete() {
		if (confirm(`Are you sure you want to delete this tier list? This action cannot be undone.`)) {
			dispatch('delete', { id, type: 'tierlist' });
		}
	}

	function formatDate(dateStr: string) {
		try {
			return new Date(dateStr).toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	function getTierListTypeName(type: string) {
		const names: Record<string, string> = {
			classic: 'Classic Grid',
			dynamic: 'Dynamic Canvas'
		};
		return names[type] || 'Classic Grid';
	}

	function getTotalItems(): number {
		if (!tierListData?.tiers) return 0;
		return (
			tierListData.tiers.reduce(
				(total: number, tier: TierCreate & { items?: TierItem[] }) =>
					total + (tier.items?.length || 0),
				0
			) + (tierListData.unassignedItems?.length || 0)
		);
	}

	function getItemsInTier(tierName: string): number {
		if (!tierListData?.tiers) return 0;
		const tier = tierListData.tiers.find(
			(t: TierCreate & { items?: TierItem[] }) => t.name === tierName
		);
		return tier?.items?.length || 0;
	}

	function getMostPopulatedTier(): string {
		if (!tierListData?.tiers) return 'None';
		let maxItems = 0;
		let mostPopulated = 'None';

		tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
			const itemCount = tier.items?.length || 0;
			if (itemCount > maxItems) {
				maxItems = itemCount;
				mostPopulated = tier.name;
			}
		});

		return maxItems > 0 ? mostPopulated : 'None';
	}

	function getItemTypeBreakdown(): { text: number; image: number } {
		if (!tierListData?.tiers) return { text: 0, image: 0 };

		let textCount = 0;
		let imageCount = 0;

		// Count items in tiers
		tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
			tier.items?.forEach((item: TierItem) => {
				if (item.image) imageCount++;
				else textCount++;
			});
		});

		// Count unassigned items
		tierListData.unassignedItems?.forEach((item: TierItem) => {
			if (item.image) imageCount++;
			else textCount++;
		});

		return { text: textCount, image: imageCount };
	}

	const totalItems = getTotalItems();
	const itemBreakdown = getItemTypeBreakdown();
	const mostPopulated = getMostPopulatedTier();
</script>

<div class="flex h-full flex-col overflow-y-auto bg-orange-900 p-6 text-white">
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm text-orange-300">{tierListData?.owner_displayName || author}</span>
			<div class="flex items-center space-x-2 text-sm text-orange-300">
				<span>🏆</span>
				<span>📊</span>
				<span>🔗</span>
			</div>
		</div>
		<h1 class="mb-4 text-2xl font-bold break-words">{title || 'UNTITLED TIER LIST'}</h1>

		<div class="mb-6 text-sm text-orange-300">
			{formatDate(date)} | REVISION {revision}
		</div>

		<!-- Tier List Statistics Section -->
		{#if tierListData}
			<div class="mb-6 rounded-lg bg-orange-800/50 p-4">
				<h3 class="mb-4 text-lg font-semibold text-orange-200">Tier List Statistics</h3>

				<!-- Basic Stats Grid -->
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div class="rounded-lg bg-orange-800/30 p-3 text-center">
						<div class="text-2xl font-bold text-white">{totalItems}</div>
						<div class="text-xs text-orange-300">Total Items</div>
					</div>
					<div class="rounded-lg bg-orange-800/30 p-3 text-center">
						<div class="text-lg font-bold text-white">
							{getTierListTypeName(tierListData.type || 'classic')}
						</div>
						<div class="text-xs text-orange-300">List Type</div>
					</div>
				</div>

				<!-- Item Type Breakdown -->
				<div class="mb-4 grid grid-cols-2 gap-3">
					<div class="rounded bg-orange-800/30 p-2 text-center">
						<div class="text-sm font-bold text-white">{itemBreakdown.text}</div>
						<div class="text-xs text-orange-300">Text Items</div>
					</div>
					<div class="rounded bg-orange-800/30 p-2 text-center">
						<div class="text-sm font-bold text-white">{itemBreakdown.image}</div>
						<div class="text-xs text-orange-300">Image Items</div>
					</div>
				</div>

				<!-- Tier Breakdown -->
				<div class="mb-4">
					<div class="mb-2 text-sm text-orange-200">Tier Breakdown</div>
					<div class="space-y-2">
						{#if tierListData.tiers}
							{#each tierListData.tiers as tier (tier.name)}
								<div class="flex items-center justify-between rounded bg-orange-800/30 p-2">
									<div class="flex items-center space-x-2">
										<div
											class="h-3 w-3 flex-shrink-0 rounded border border-orange-300"
											style="background-color: {tier.color || '#ff7f7f'}"
										></div>
										<span class="text-sm text-orange-100">{tier.name}</span>
									</div>
									<span class="text-sm font-bold text-white">{getItemsInTier(tier.name)}</span>
								</div>
							{/each}
						{/if}

						{#if tierListData.unassignedItems && tierListData.unassignedItems.length > 0}
							<div class="flex items-center justify-between rounded bg-orange-800/30 p-2">
								<div class="flex items-center space-x-2">
									<div
										class="h-3 w-3 flex-shrink-0 rounded border border-orange-300 bg-gray-500"
									></div>
									<span class="text-sm text-orange-100">Unranked</span>
								</div>
								<span class="text-sm font-bold text-white"
									>{tierListData.unassignedItems ? tierListData.unassignedItems.length : 0}</span
								>
							</div>
						{/if}
					</div>
				</div>

				<!-- Most Populated Tier -->
				<div class="mb-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-sm text-orange-200">Most Populated Tier</span>
						<span class="text-sm font-bold text-white">{mostPopulated}</span>
					</div>
				</div>

				<!-- Distribution Analysis -->
				{#if totalItems > 0}
					<div class="mb-4">
						<div class="mb-2 text-sm text-orange-200">Distribution</div>
						<div class="space-y-1">
							{#if tierListData.tiers}
								{#each tierListData.tiers as tier (tier.name)}
									{@const percentage = ((getItemsInTier(tier.name) / totalItems) * 100).toFixed(1)}
									<div class="flex items-center space-x-2">
										<span class="w-8 text-xs text-orange-300">{tier.name}:</span>
										<div class="h-2 flex-1 overflow-hidden rounded-full bg-orange-900">
											<div
												class="h-full bg-orange-300 transition-all duration-300"
												style="width: {percentage}%"
											></div>
										</div>
										<span class="w-10 text-xs text-orange-300">{percentage}%</span>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Share Button -->
		<button
			class="mb-3 flex w-full items-center justify-center space-x-2 rounded-lg bg-orange-600 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-700"
			on:click={handleShare}
		>
			<svg
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
				></path>
			</svg>
			<span>Share Tier List</span>
		</button>

		<!-- Delete Button -->
		<button
			class="flex w-full items-center justify-center space-x-2 rounded-lg bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
			on:click={handleDelete}
		>
			<svg
				class="h-4 w-4"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
				></path>
			</svg>
			<span>Delete Tier List</span>
		</button>
	</div>
</div>
