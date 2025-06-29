<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { scale } from 'svelte/transition';
	import confetti from 'canvas-confetti';
	let likeBtn: HTMLButtonElement | null = null;

	export let title: string = '';
	export let date: string = '';
	export let author: string = 'Anonymous';
	export let revision: number = 1;
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let tierListData: any = null;
	export let likes: number = 0;
	export let liked: boolean = false;

	let isLiking = false;
	let likeAnim = false;
	let likeHover = false;
	let likeActive = false;

	// Fetch initial like count and liked state on mount
	import { onMount } from 'svelte';

	onMount(async () => {
		try {
			const res = await fetch(`/api/interactions/tierlist/${id}/likes`);
			if (res.ok) {
				const data = await res.json();
				likes = data.likes ?? 0;
				// Optionally, you could check if the user has liked before if you store that info
				// liked = data.liked ?? false;
			}
		} catch {
			likes = 0;
		}
	});

	async function handleLike() {
		if (isLiking) return;
		isLiking = true;
		try {
			const endpoint = liked ? '/api/interactions/unlike' : '/api/interactions/like';
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					item_id: id,
					item_type: 'tierlist'
				})
			});
			if (res.ok) {
				const data = await res.json();
				likes = data.likes;
				// Only animate on like (not unlike)
				if (!liked) {
					likeAnim = false;
					await tick();
					likeAnim = true;
					if (likeBtn) {
						const rect = likeBtn.getBoundingClientRect();
						const x = (rect.left + rect.width / 2) / window.innerWidth;
						const y = (rect.top + rect.height / 2) / window.innerHeight;
						confetti({
							particleCount: 40,
							spread: 360,
							angle: Math.random() * 359,
							origin: { x, y }
						});
					} else {
						confetti({
							particleCount: 40,
							spread: 120,
							angle: Math.random() * 359,
							origin: { y: 0.7 }
						});
					}
				}
				liked = !liked;
			}
		} catch (e) {
			// Optionally handle error
		} finally {
			isLiking = false;
		}
	}

	$: if (likeAnim) {
		setTimeout(() => {
			likeAnim = false;
		}, 350);
	}

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
				(total: number, tier: any) => total + (tier.items?.length || 0),
				0
			) + (tierListData.unassignedItems?.length || 0)
		);
	}

	function getItemsInTier(tierName: string): number {
		if (!tierListData?.tiers) return 0;
		const tier = tierListData.tiers.find((t: any) => t.name === tierName);
		return tier?.items?.length || 0;
	}

	function getMostPopulatedTier(): string {
		if (!tierListData?.tiers) return 'None';
		let maxItems = 0;
		let mostPopulated = 'None';

		tierListData.tiers.forEach((tier: any) => {
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
		tierListData.tiers.forEach((tier: any) => {
			tier.items?.forEach((item: any) => {
				if (item.image) imageCount++;
				else textCount++;
			});
		});

		// Count unassigned items
		tierListData.unassignedItems?.forEach((item: any) => {
			if (item.image) imageCount++;
			else textCount++;
		});

		return { text: textCount, image: imageCount };
	}

	$: totalItems = getTotalItems();
	$: itemBreakdown = getItemTypeBreakdown();
	$: mostPopulated = getMostPopulatedTier();
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto bg-orange-900 p-6 text-white">
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm text-orange-300">{author}</span>
			<div class="flex items-center space-x-2 text-sm text-orange-300">
				<!-- Like Button -->
				<button
					class="group flex items-center space-x-1 focus:outline-none"
					aria-label="Like"
					on:click={handleLike}
					disabled={isLiking}
					type="button"
					bind:this={likeBtn}
					on:mouseenter={() => (likeHover = true)}
					on:mouseleave={() => {
						likeHover = false;
						likeActive = false;
					}}
					on:mousedown={() => (likeActive = true)}
					on:mouseup={() => (likeActive = false)}
				>
					{#if likeAnim}
						<span
							class="material-symbols-outlined text-lg transition-colors select-none"
							style="
								color: #ff5705;
								font-family: 'Material Symbols Outlined' !important;
								font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important;
								transition: transform 0.12s cubic-bezier(.4,2,.6,1);
								transform: scale({likeActive ? 0.96 : likeHover ? 1.08 : 1});
							"
							in:scale={{ duration: 200, start: 0.7 }}
						>
							favorite
						</span>
					{:else}
						<span
							class="material-symbols-outlined text-lg transition-colors select-none"
							style="
								color: {liked ? '#ff5705' : ''};
								font-family: 'Material Symbols Outlined' !important;
								font-variation-settings: 'FILL' {liked ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important;
								transition: transform 0.12s cubic-bezier(.4,2,.6,1);
								transform: scale({likeActive ? 0.96 : likeHover ? 1.08 : 1});
							"
						>
							favorite
						</span>
					{/if}
					<span class="text-xs">{likes}</span>
					<style>
						.material-symbols-outlined:hover,
						.group:hover .material-symbols-outlined {
							color: #ff5705 !important;
						}
					</style>
				</button>
				<!-- Comments Icon -->
				<button class="group flex items-center" aria-label="Comments" disabled>
					<span
						class="material-symbols-outlined text-lg transition-colors select-none group-hover:text-orange-200"
					>
						chat_bubble
					</span>
				</button>
				<!-- Forks Icon -->
				<button class="group flex items-center" aria-label="Forks" disabled>
					<span
						class="material-symbols-outlined text-lg transition-colors select-none group-hover:text-orange-200"
					>
						fork_right
					</span>
				</button>
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

				<!-- Tier Breakdown (hide for dynamic tierlists) -->
				{#if tierListData.type !== 'dynamic'}
					<div class="mb-4">
						<div class="mb-2 text-sm text-orange-200">Tier Breakdown</div>
						<div class="space-y-2">
							{#if tierListData.tiers}
								{#each tierListData.tiers as tier}
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

							{#if tierListData.unassignedItems?.length > 0}
								<div class="flex items-center justify-between rounded bg-orange-800/30 p-2">
									<div class="flex items-center space-x-2">
										<div
											class="h-3 w-3 flex-shrink-0 rounded border border-orange-300 bg-gray-500"
										></div>
										<span class="text-sm text-orange-100">Unranked</span>
									</div>
									<span class="text-sm font-bold text-white"
										>{tierListData.unassignedItems.length}</span
									>
								</div>
							{/if}
						</div>
					</div>
				{/if}

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
								{#each tierListData.tiers as tier}
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

		<!-- Bottom Bar: Share Link (left) and Delete Icon (right) -->
		<div class="mt-auto flex items-center justify-between pt-4">
			<!-- Share Link (copies to clipboard on click) -->
			{#if shareUrl}
				<div
					class="flex cursor-pointer items-center space-x-2 text-orange-200 transition-colors hover:text-orange-100"
					title="Click to copy link"
					on:click={() => {
						navigator.clipboard.writeText(shareUrl);
						// Optionally, trigger a toast here
					}}
				>
					<span class="material-symbols-outlined align-middle text-base">link</span>
					<span class="text-xs break-all">{shareUrl}</span>
				</div>
			{/if}

			<!-- Delete Icon (right) -->
			<div
				class="group flex cursor-pointer items-center"
				title="Delete Tier List"
				on:click={handleDelete}
			>
				<span
					class="material-symbols-outlined text-2xl text-orange-300 transition-colors select-none group-hover:text-red-600"
				>
					delete
				</span>
			</div>
		</div>
	</div>
</div>
