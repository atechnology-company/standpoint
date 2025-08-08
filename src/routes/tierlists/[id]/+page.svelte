<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import TierlistSidebar from '../../../components/tierlist-sidebar.svelte';
	import Toast from '../../../components/toast.svelte';
	import LoadingIndicator from '../../../components/loading-indicator.svelte';
	import { apiClient } from '$lib/api';
	import type { TierListResponse, TierItem, TierCreate } from '$lib/types';
	import { currentUser, userGroup } from '$lib/stores';
	import { addToast } from '$lib/toast';
	import {
		likeTierlist,
		unlikeTierlist,
		hasUserLikedTierlist
	} from '$lib/firestore-polls-tierlists.js';

	interface DisplayTier {
		id: string;
		name: string;
		color: string;
		position: number;
		items: TierItem[];
	}

	interface DisplayTierList {
		id: string;
		title: string;
		list_type: string;
		tiers: DisplayTier[];
		unassignedItems: TierItem[];
		created_at?: string;
		owner_displayName?: string;
		banner_image?: string;
		author?: string;
		owner?: string;
		description?: string;
	}

	let tierList: DisplayTierList | null = null;
	let loading = true;
	let error = '';
	let selectedItem: TierItem | null = null;

	let likes = 0;
	let liked = false;
	let comments = 0;
	let forks = 0;
	let interacting = false;
	let showComments = false;
	let commentText = '';
	let commentsList: any[] = [];

	// Responsive layout state
	let windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	let windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

	$: tierListId = $page.params.id;

	$: if (tierListId) {
		loadTierList();
	}

	onMount(() => {
		const handleResize = () => {
			if (typeof window !== 'undefined') {
				windowWidth = window.innerWidth;
				windowHeight = window.innerHeight;
			}
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);
		}

		return () => {
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', handleResize);
			}
		};
	});

	async function loadTierList() {
		if (!tierListId) {
			console.log('No tierListId provided');
			return;
		}

		try {
			loading = true;
			error = '';
			console.log('Loading tier list with ID:', tierListId);
			const response = await apiClient.getTierList(String(tierListId));
			console.log('Tier list response:', response);

			const defaultColors = [
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

			const transformedTiers: DisplayTier[] = response.tiers.map((tier, index) => ({
				...tier,
				id: tier.name || `tier-${index}`,
				color: tier.color || defaultColors[index % defaultColors.length],
				items: []
			}));

			const allItems: TierItem[] = response.items.map((item) => {
				if (typeof item === 'string') {
					return {
						id: item,
						text: item,
						type: 'text' as const
					};
				} else {
					return {
						id: item.id,
						text: item.text,
						image: item.image,
						type: item.type,
						position: item.position,
						size: item.size,
						naturalSize: item.naturalSize
					};
				}
			});

			if (response.item_placements && response.item_placements.length > 0) {
				response.item_placements.forEach((placement, index) => {
					const item = allItems.find((item) => item.id === placement.item_id);
					const tierByPosition = response.tiers[placement.tier_position];
					const tier = transformedTiers.find((tier) => tier.name === tierByPosition?.name);

					if (item && tier) {
						if (response.list_type === 'dynamic') {
							if (placement.position) {
								item.position = placement.position;
							}
							if (placement.size) {
								item.size = placement.size;
							}
						}

						tier.items.push(item);
						console.log(`✅ Successfully placed item "${item.text}" in tier "${tier.name}"`);
					} else {
						console.warn(
							`❌ Failed to place item: item=${!!item}, tier=${!!tier}, tierByPosition=${tierByPosition?.name}`
						);
					}
				});
			} else {
				console.log('No item placements found - processing items directly');
				allItems.forEach((item, index) => {
					if (response.list_type === 'dynamic') {
						console.log(`✅ Using existing position for item "${item.text}":`, item.position);
					} else {
						const tierIndex = index % transformedTiers.length;
						const tier = transformedTiers[tierIndex];
						if (tier) {
							tier.items.push(item);
							console.log(`✅ Auto-placed item "${item.text}" in tier "${tier.name}"`);
						}
					}
				});
			}

			const assignedItemIds = new Set();
			transformedTiers.forEach((tier) => {
				tier.items.forEach((item) => assignedItemIds.add(item.id));
			});

			let unassignedItems;
			if (response.list_type === 'dynamic') {
				unassignedItems = allItems.filter((item) => !assignedItemIds.has(item.id));
			} else {
				unassignedItems = allItems.filter((item) => !assignedItemIds.has(item.id));
			}

			tierList = {
				id: response.id,
				title: response.title,
				list_type: response.list_type === 'dynamic' ? 'dynamic' : 'classic',
				tiers: transformedTiers,
				unassignedItems: unassignedItems,
				author: response.owner_displayName || 'Anonymous',
				created_at: response.created_at
			};

			console.log('Transformed tier list:', tierList);

			if ($currentUser) {
				liked = await hasUserLikedTierlist(tierList.id, $currentUser.uid);
			}
		} catch (err) {
			error = 'Failed to load tier list';
			console.error('Error loading tier list:', err);
		} finally {
			loading = false;
		}
	}

	async function toggleLike() {
		if (!$currentUser || !tierList) {
			addToast('Please sign in to like tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			if (liked) {
				await unlikeTierlist(tierList.id, $currentUser.uid);
				likes--;
				liked = false;
				addToast('Removed like', 'success');
			} else {
				await likeTierlist(tierList.id, $currentUser.uid);
				likes++;
				liked = true;
				addToast('Added like!', 'success');
			}
		} catch (error: unknown) {
			console.error('Error toggling like:', error);
			addToast(error instanceof Error ? error.message : 'Failed to update like', 'error');
		} finally {
			interacting = false;
		}
	}

	async function addComment() {
		if (!$currentUser || !tierList || !commentText.trim()) {
			if (!$currentUser) addToast('Please sign in to comment', 'error');
			return;
		}

		try {
			interacting = true;

			const newComment = {
				id: Date.now().toString(),
				text: commentText.trim(),
				author: $currentUser.displayName || 'Anonymous',
				timestamp: Date.now()
			};

			commentsList = [newComment, ...commentsList];
			comments++;
			commentText = '';
			addToast('Comment added!', 'success');
		} catch (error) {
			console.error('Error adding comment:', error);
			addToast('Failed to add comment', 'error');
		} finally {
			interacting = false;
		}
	}

	async function forkTierlist() {
		if (!$currentUser || !tierList) {
			addToast('Please sign in to fork tierlists', 'error');
			return;
		}

		try {
			interacting = true;
			
			// Prepare complete tierlist data for forking
			const forkData = {
				title: `${tierList.title} (Fork)`,
				description: tierList.description || '',
				list_type: tierList.list_type,
				tiers: tierList.tiers.map(tier => ({
					name: tier.name,
					color: tier.color,
					position: tier.position
				})),
				// Combine all items from tiers and unassigned items
				items: [
					...(tierList.unassignedItems || []),
					...tierList.tiers.flatMap(tier => tier.items || [])
				].map(item => ({
					id: item.id,
					text: item.text,
					type: item.type,
					image: item.image,
					position: item.position,
					size: item.size,
					naturalSize: item.naturalSize
				})),
				owner: $currentUser.uid,
				item_placements: []
			};

			console.log('Fork data being passed:', forkData);
			
			forks++;
			addToast('Tierlist forked! Redirecting to editor...', 'success');

			// Store fork data in sessionStorage for the create page
			sessionStorage.setItem('forkData', JSON.stringify(forkData));
			
			// Navigate to create page with fork parameter
			setTimeout(() => {
				if (tierList) {
					goto(`/tierlists/create?fork=${tierList.id}`);
				}
			}, 1000);
		} catch (error) {
			console.error('Error forking tierlist:', error);
			addToast('Failed to fork tierlist', 'error');
		} finally {
			interacting = false;
		}
	}

	async function editTierlist() {
		if (!$currentUser || !tierList) {
			addToast('Please sign in to edit tierlists', 'error');
			return;
		}

		// Check if user owns this tierlist (including redirect UIDs)
		const isOriginalOwner = tierList.owner === $currentUser.uid;
		const redirectUids = (tierList as any).redirectUids || [];
		const hasRedirectAccess = redirectUids.includes($currentUser.uid);
		const isDevUser = $userGroup === 'dev';
		const displayNameMatch = tierList.author === $currentUser.displayName;

		if (!isOriginalOwner && !hasRedirectAccess && !isDevUser && !displayNameMatch) {
			addToast('You can only edit your own tierlists', 'error');
			return;
		}

		try {
			// Prepare complete tierlist data for editing
			const editData = {
				id: tierList.id,
				title: tierList.title,
				description: tierList.description || '',
				list_type: tierList.list_type,
				tiers: tierList.tiers.map(tier => ({
					name: tier.name,
					color: tier.color,
					position: tier.position || 0
				})),
				items: [
					...(tierList.unassignedItems || []),
					...tierList.tiers.flatMap(tier => tier.items || [])
				].map(item => ({
					id: item.id,
					text: item.text,
					type: item.type,
					image: item.image,
					position: item.position,
					size: item.size,
					naturalSize: item.naturalSize
				})),
				owner: tierList.owner
			};

			console.log('Edit data being prepared:', editData);
			
			// Store edit data in sessionStorage for the create page
			sessionStorage.setItem('editData', JSON.stringify(editData));
			
			addToast('Redirecting to editor...', 'success');
			
			// Navigate to create page with edit parameter
			setTimeout(() => {
				if (tierList) {
					goto(`/tierlists/create?edit=${tierList.id}`);
				}
			}, 500);
		} catch (error) {
			console.error('Error preparing edit:', error);
			addToast('Failed to prepare edit', 'error');
		}
	}

	function selectItem(item: TierItem) {
		selectedItem = selectedItem?.id === item.id ? null : item;
	}

	function dimColor(color: string, factor: number = 0.7): string {
		const hex = color.replace('#', '');
		const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
		const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
		const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	// Calculates optimal grid layout for tier items in viewer mode
	function getTierItemsStyle(itemCount: number): {
		gridStyle: string;
		itemHeight: string;
		itemWidth: string;
		margin: string;
	} {
		if (itemCount === 0)
			return { gridStyle: '', itemHeight: '8rem', itemWidth: '8rem', margin: '0' };

		// Calculate available height per tier dynamically
		const totalTiers = tierList?.tiers.length || 4;
		const topBarHeight = 80;
		const availableScreenHeight = windowHeight;
		const tierContainerHeight = Math.max(
			120,
			Math.floor((availableScreenHeight - topBarHeight) / totalTiers) - 32
		);

		const gap = 16;
		const margin = 8;

		// Available width (accounting for tier label area - 320px and sidebar - 320px and padding)
		const availableWidth = windowWidth - 320 - 320 - 64;

		// Try full height first
		let itemHeight = Math.max(80, tierContainerHeight - gap * 2);
		let itemWidth = itemHeight;

		// Calculate how many full-height square items can fit in one row
		const itemsPerRowFullHeight = Math.floor((availableWidth + gap) / (itemWidth + gap));

		// Check if all items fit in one row at full height
		if (itemCount <= itemsPerRowFullHeight) {
			// All items fit at full height as squares
			return {
				gridStyle: `grid-template-columns: repeat(${itemCount}, ${itemWidth}px); height: ${tierContainerHeight}px;`,
				itemHeight: `${itemHeight}px`,
				itemWidth: `${itemWidth}px`,
				margin: '0'
			};
		} else {
			// Half size to fit more items in multiple rows
			const maxRows = 2;
			const halfHeight = Math.max(
				40,
				Math.floor((tierContainerHeight - gap * (maxRows - 1)) / maxRows) - margin
			);
			const halfItemWidth = halfHeight;

			const itemsPerRowHalfHeight = Math.floor((availableWidth + gap) / (halfItemWidth + gap));

			return {
				gridStyle: `grid-template-columns: repeat(${itemsPerRowHalfHeight}, ${halfItemWidth}px); height: ${tierContainerHeight}px;`,
				itemHeight: `${halfHeight}px`,
				itemWidth: `${halfItemWidth}px`,
				margin: `${margin}px`
			};
		}
	}

	function getDynamicGradient(): string {
		if (!tierList?.tiers) return 'background: linear-gradient(to bottom, #222, #333)';

		// Convert hex color to rgba with opacity for darkening
		function hexToRgba(hex: string, alpha: number = 0.65) {
			let c = hex.replace('#', '');
			if (c.length === 3)
				c = c
					.split('')
					.map((x) => x + x)
					.join('');
			const num = parseInt(c, 16);
			const r = (num >> 16) & 255;
			const g = (num >> 8) & 255;
			const b = num & 255;
			return `rgba(${r},${g},${b},${alpha})`;
		}

		const colors = tierList.tiers.map((tier) => hexToRgba(tier.color || '#666666', 0.65));
		return `background: linear-gradient(to bottom, ${colors.join(', ')});`;
	}

	// Gets item size for dynamic mode
	function getItemSize(item: TierItem): { width: number; height: number } {
		if (item.size) return item.size;

		// Default size for items without specified size
		return { width: 120, height: 120 };
	}

	function handleSidebarDelete(event: CustomEvent) {
		const { id, type } = event.detail;
		if (type === 'tierlist') {
			deleteTierList(id);
		}
	}

	async function deleteTierList(tierListId: number) {
		try {
			console.log('Attempting to delete tier list with ID:', tierListId);
			await apiClient.deleteTierList(String(tierListId));
			console.log('Tier list deleted successfully');
			window.location.href = '/tierlists';
		} catch (err) {
			console.error('Error deleting tier list:', err);
			if (err instanceof Error) {
				error = `Failed to delete tier list: ${err.message}`;
			} else {
				error = 'Failed to delete tier list. The server may be unavailable.';
			}
			setTimeout(() => {
				error = '';
			}, 5000);
		}
	}
</script>

<svelte:head>
	<title>{tierList?.title || 'Tier List'} - Standpoint</title>
</svelte:head>

<!-- Fullscreen Tier List Viewer -->
<div class="fixed inset-0 flex bg-black text-white">
	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<LoadingIndicator size="lg" />
		</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<div class="mb-4 text-xl text-red-400">{error}</div>
				<a href="/tierlists" class="bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700">
					Back to Tier Lists
				</a>
			</div>
		</div>
	{:else if tierList}
		<!-- Main Tier List Display -->
		<div class="flex flex-1 flex-col">
			{#if tierList.list_type === 'classic'}
				<!-- Classic Mode -->
				<div class="flex flex-1 flex-col">
					{#each tierList.tiers as tier, index (tier.id)}
						<div
							class="relative flex flex-1 transition-all duration-300"
							style="background-color: {dimColor(tier.color || '#666666', 0.6)};"
							in:fade={{ duration: 350 }}
						>
							<!-- Tier Items Area -->
							<div class="relative flex-1 p-6">
								<!-- Tier Controls -->
								<div class="absolute top-0 right-0 flex h-full w-64 items-center justify-end pr-8">
									<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
										<!-- Tier Title -->
										<div class="text-right text-4xl font-bold" style="color: {tier.color};">
											{tier.name}
										</div>
									</div>
								</div>

								{#if tier.items && tier.items.length > 0}
									{@const itemsStyle = getTierItemsStyle(tier.items.length)}
									<div class="grid items-center gap-4 pr-80" style={itemsStyle.gridStyle}>
										{#each tier.items as item, itemIndex (item.id)}
											<!-- svelte-ignore a11y-no-static-element-interactions -->
											<div
												class="group/item relative cursor-pointer overflow-hidden shadow-sm transition-shadow hover:shadow-lg {selectedItem?.id ===
												item.id
													? 'ring-2 ring-orange-400'
													: ''}"
												style="{item.image
													? `background-image: url('${item.image}'); background-size: cover; background-position: center;`
													: 'background: linear-gradient(135deg, #1f2937, #374151);'} height: {itemsStyle.itemHeight}; width: {itemsStyle.itemWidth}; margin: {itemsStyle.margin};"
												on:click|stopPropagation={() => selectItem(item)}
												on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectItem(item)}
												role="button"
												tabindex="0"
												aria-label="View item {item.text}"
												in:fade={{ duration: 250 }}
											>
												<!-- Gradient overlay -->
												{#if item.image}
													<div
														class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
													></div>
												{/if}

												<!-- Text positioning -->
												{#if item.type === 'text' && !item.image}
													<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
														<span class="text-center text-sm leading-tight font-medium text-white"
															>{item.text}</span
														>
													</div>
												{:else}
													<div class="absolute bottom-2 left-2 z-10">
														<span class="text-sm font-medium text-white drop-shadow-lg"
															>{item.text}</span
														>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div class="flex h-full items-center justify-center pr-80 text-center">
										<div class="text-white opacity-60">
											<div class="text-lg">No items in this tier</div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<!-- Dynamic Tier List -->
				<div class="flex flex-1 flex-col">
					<!-- Dynamic Canvas -->
					<div class="dynamic-canvas relative flex-1 overflow-hidden" style={getDynamicGradient()}>
						<!-- Tier Zones -->
						{#each tierList.tiers as tier, index (tier.id)}
							{@const tierHeight = 100 / tierList.tiers.length}
							{@const tierTop = (index / tierList.tiers.length) * 100}
							<div
								class="pointer-events-none absolute right-0 left-0 transition-all"
								style="top: {tierTop}%; height: {tierHeight}%;"
							>
								<!-- Tier Controls -->
								<div
									class="pointer-events-auto absolute top-0 right-0 flex h-full w-64 items-center justify-end pr-8"
								>
									<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
										<div class="text-right text-4xl font-bold" style="color: {tier.color};">
											{tier.name}
										</div>
									</div>
								</div>
							</div>
						{/each}

						<!-- All Dynamic Items -->
						{#if tierList && tierList.tiers}
							{#each [...(tierList.unassignedItems || []), ...tierList.tiers.flatMap( (tier, tierIndex) => (tier.items || []).map( (item) => ({ ...item, _tierIndex: tierIndex }) ) )] as item, i (item.id)}
								{@const x = item.position?.x ?? 0.1 + (i % 8) * 0.1}
								{@const y = item.position?.y ?? 0.5}
								{@const itemSize = getItemSize(item)}

								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div
									class="group/item absolute -translate-x-1/2 -translate-y-1/2 transform cursor-pointer overflow-hidden shadow-lg transition-all hover:shadow-xl {selectedItem?.id ===
									item.id
										? 'ring-2 ring-orange-400'
										: ''}"
									style="left: {x * 100}%; top: {y *
										100}%; width: {itemSize.width}px; height: {itemSize.height}px; {item.image
										? `background-image: url('${item.image}'); background-size: cover; background-position: center;`
										: item.type === 'text'
											? 'background: linear-gradient(135deg, #374151, #4b5563); display: flex; align-items: center; justify-content: center;'
											: 'background: linear-gradient(135deg, #1f2937, #374151);'}"
									on:click|stopPropagation={() => selectItem(item)}
									on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectItem(item)}
									role="button"
									tabindex="0"
									aria-label="View item {item.text}"
									in:fade={{ duration: 250 }}
								>
									<!-- Gradient overlay for images -->
									{#if item.image}
										<div
											class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
										></div>
									{/if}

									{#if item.type === 'text' && !item.image}
										<!-- Text items -->
										<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
											<div class="text-center text-sm leading-tight font-medium text-white">
												{item.text}
											</div>
										</div>
									{:else}
										<!-- Image items -->
										<div class="absolute right-1 bottom-1 z-10">
											<div
												class="text-right text-xs leading-tight font-medium text-white drop-shadow-lg"
											>
												{item.text}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="w-80 border-l border-gray-600 bg-gray-900">
			   <TierlistSidebar
				   title={tierList.title}
				   shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tierlists/${tierList.id}`}
				   id={tierList.id}
				   tierListData={{
					   ...tierList,
					   items: tierList.tiers
						   .flatMap((tier) => tier.items || [])
						   .concat(tierList.unassignedItems || []),
					   item_placements: []
				   } as any}
				   on:delete={handleSidebarDelete}
				   on:fork={forkTierlist}
				   on:edit={editTierlist}
			   />
		</div>
	{:else}
		<!-- Debug: No tierList data -->
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<div class="mb-4 text-xl text-yellow-400">Debug: No tier list data available</div>
				<div class="text-sm text-gray-400">
					Loading: {loading}, Error: {error}, TierListId: {tierListId}
				</div>
				<a
					href="/tierlists"
					class="mt-4 inline-block bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
				>
					Back to Tier Lists
				</a>
			</div>
		</div>
	{/if}
</div>

<Toast />
<Toast />
