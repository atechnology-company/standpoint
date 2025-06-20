<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import TierlistSidebar from '../../../components/tierlist-sidebar.svelte';
	import { apiClient } from '$lib/api';

	// Types
	interface TierItem {
		id: string;
		text: string;
		image?: string;
		type: 'text' | 'image' | 'search';
		position?: { x: number; y: number }; 
		size?: { width: number; height: number };
		naturalSize?: { width: number; height: number };
	}

	interface Tier {
		id: string;
		name: string;
		color: string;
		items: TierItem[];
	}

	interface TierList {
		id: number;
		title: string;
		type: 'classic' | 'dynamic';
		tiers: Tier[];
		unassignedItems: TierItem[];
		author?: string;
		created_at?: string;
	}

	let tierList: TierList | null = null;
	let loading = true;
	let error = '';
	let selectedItem: TierItem | null = null;

	// Responsive layout state
	let windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	let windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

	$: tierListId = $page.params.id;

	onMount(() => {
		loadTierList();
		
		// Add window resize listener for responsive layout
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
		try {
			loading = true;
			error = '';
			const response = await apiClient.getTierList(Number(tierListId));
			console.log('Raw API response:', response);
			
			// Transform the API response to match our expected structure
			const defaultColors = ['#ff7f7f', '#ffbf7f', '#ffff7f', '#bfff7f', '#7fff7f', '#7fffff', '#7fbfff', '#7f7fff', '#bf7fff', '#ff7fff'];
			
			// Create tier structure with items properly placed
			const transformedTiers: Tier[] = response.tiers.map((tier, index) => ({
				id: tier.name,
				name: tier.name,
				color: defaultColors[index % defaultColors.length],
				items: []
			}));

			// Create items and place them in tiers based on item_placements
			const allItems: TierItem[] = response.items.map(item => {
				// Handle both old format (strings) and new format (objects)
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

			console.log('All items:', allItems);
			console.log('Item placements:', response.item_placements);
			console.log('Tiers:', response.tiers);
			console.log('Transformed tiers:', transformedTiers);

			// Place items in appropriate tiers
			if (response.item_placements && response.item_placements.length > 0) {
				response.item_placements.forEach((placement, index) => {
					console.log(`Processing placement ${index}:`, placement);
					
					const item = allItems.find(item => item.id === placement.item_id);
					const tierByPosition = response.tiers[placement.tier_position];
					const tier = transformedTiers.find(tier => tier.name === tierByPosition?.name);
					
					console.log(`Placing item "${placement.item_id}" in tier position ${placement.tier_position}`);
					console.log(`- Found item:`, item);
					console.log(`- Tier by position:`, tierByPosition);
					console.log(`- Found tier:`, tier);
					
					if (item && tier) {
						// For dynamic mode, preserve the position and size from placement
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
						console.warn(`❌ Failed to place item: item=${!!item}, tier=${!!tier}, tierByPosition=${tierByPosition?.name}`);
					}
				});
			} else {
				console.log('No item placements found or empty array');
			}

			// Find unassigned items
			const assignedItemIds = new Set();
			transformedTiers.forEach(tier => {
				tier.items.forEach(item => assignedItemIds.add(item.id));
			});
			const unassignedItems = allItems.filter(item => !assignedItemIds.has(item.id));
			
			tierList = {
				id: response.id,
				title: response.title,
				type: response.list_type === 'dynamic' ? 'dynamic' : 'classic',
				tiers: transformedTiers,
				unassignedItems: unassignedItems,
				author: 'Anonymous',
				created_at: response.created_at
			};

			console.log('Transformed tier list:', tierList);
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

	/** Dims a hex color by a given factor for better background contrast */
	function dimColor(color: string, factor: number = 0.7): string {
		const hex = color.replace('#', '');
		const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
		const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
		const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	/** Calculates optimal grid layout for tier items in viewer mode */
	function getTierItemsStyle(itemCount: number): { gridStyle: string; itemHeight: string; itemWidth: string; margin: string } {
		if (itemCount === 0) return { gridStyle: '', itemHeight: '8rem', itemWidth: '8rem', margin: '0' };
		
		// Calculate available height per tier dynamically
		const totalTiers = tierList?.tiers.length || 4;
		const topBarHeight = 80;
		const availableScreenHeight = windowHeight;
		const tierContainerHeight = Math.max(120, Math.floor((availableScreenHeight - topBarHeight) / totalTiers) - 32);
		
		const gap = 16; 
		const margin = 8;
		
		// Available width (accounting for tier label area - 320px and sidebar - 320px and padding)
		const availableWidth = windowWidth - 320 - 320 - 64; 
		
		// Try full height first - all items are squares (width = height)
		let itemHeight = Math.max(80, tierContainerHeight - (gap * 2));
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
			// Need to use half size to fit more items in multiple rows
			const maxRows = 2;
			const halfHeight = Math.max(40, Math.floor((tierContainerHeight - gap * (maxRows - 1)) / maxRows) - margin);
			const halfItemWidth = halfHeight; 
			
			// Calculate items per row at half height
			const itemsPerRowHalfHeight = Math.floor((availableWidth + gap) / (halfItemWidth + gap));
			
			return {
				gridStyle: `grid-template-columns: repeat(${itemsPerRowHalfHeight}, ${halfItemWidth}px); height: ${tierContainerHeight}px;`,
				itemHeight: `${halfHeight}px`,
				itemWidth: `${halfItemWidth}px`,
				margin: `${margin}px`
			};
		}
	}

	/** Gets the dynamic gradient background for dynamic mode */
	function getDynamicGradient(): string {
		if (!tierList?.tiers) return 'background: linear-gradient(to bottom, #000, #333);';
		
		const colors = tierList.tiers.map(tier => tier.color);
		return `background: linear-gradient(to bottom, ${colors.join(', ')});`;
	}

	/** Gets item size for dynamic mode */
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
			await apiClient.deleteTierList(tierListId);
			console.log('Tier list deleted successfully');
			// Navigate back to tier lists page after deletion
			window.location.href = '/tierlists';
		} catch (err) {
			console.error('Error deleting tier list:', err);
			// Show a more user-friendly error message
			if (err instanceof Error) {
				error = `Failed to delete tier list: ${err.message}`;
			} else {
				error = 'Failed to delete tier list. The server may be unavailable.';
			}
			// Clear error after 5 seconds
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
			<div class="text-xl text-gray-400">Loading tier list...</div>
		</div>
	{:else if error}
		<div class="flex flex-1 items-center justify-center">
			<div class="text-center">
				<div class="mb-4 text-xl text-red-400">{error}</div>
				<a
					href="/tierlists"
					class="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
				>
					Back to Tier Lists
				</a>
			</div>
		</div>
	{:else if tierList}
		<!-- Main Tier List Display -->
		<div class="flex-1 flex flex-col">
			{#if tierList.type === 'classic'}
				<!-- Classic Mode -->
				<div class="flex-1 flex flex-col">
					{#each tierList.tiers as tier, index (tier.id)}
						<div 
							class="relative flex flex-1 transition-all duration-300"
							style="background-color: {dimColor(tier.color, 0.6)};"
						>
							<!-- Tier Items Area -->
							<div class="flex-1 p-6 relative">
								<!-- Tier Controls -->
								<div class="absolute top-0 right-0 w-64 h-full flex items-center justify-end pr-8">
									<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
										<!-- Tier Title -->
										<div 
											class="text-4xl font-bold text-right"
											style="color: {tier.color};"
										>
											{tier.name}
										</div>
									</div>
								</div>

								{#if tier.items.length > 0}
									{@const itemsStyle = getTierItemsStyle(tier.items.length)}
									<div 
										class="grid gap-4 pr-80 items-center"
										style="{itemsStyle.gridStyle}"
									>
										{#each tier.items as item, itemIndex (item.id)}
											<!-- svelte-ignore a11y-no-static-element-interactions -->
											<div 
												class="group/item rounded-lg shadow-sm hover:shadow-lg transition-shadow relative cursor-pointer overflow-hidden {selectedItem?.id === item.id ? 'ring-2 ring-orange-400' : ''}"
												style="{item.image ? `background-image: url('${item.image}'); background-size: cover; background-position: center;` : 'background: linear-gradient(135deg, #1f2937, #374151);'} height: {itemsStyle.itemHeight}; width: {itemsStyle.itemWidth}; margin: {itemsStyle.margin};"
												on:click|stopPropagation={() => selectItem(item)}
												on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectItem(item)}
												role="button"
												tabindex="0"
												aria-label="View item {item.text}"
											>
												<!-- Gradient overlay -->
												{#if item.image}
													<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
												{/if}
												
												<!-- Text positioning - center for text-only items, bottom-left for image items -->
												{#if item.type === 'text' && !item.image}
													<div class="absolute inset-0 flex items-center justify-center p-2 z-10">
														<span class="text-sm font-medium text-white text-center leading-tight">{item.text}</span>
													</div>
												{:else}
													<div class="absolute bottom-2 left-2 z-10">
														<span class="text-sm font-medium text-white drop-shadow-lg">{item.text}</span>
													</div>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div class="flex items-center justify-center h-full text-center pr-80">
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
				<div class="flex-1 flex flex-col">
					<!-- Dynamic Canvas -->
					<div 
						class="flex-1 relative overflow-hidden dynamic-canvas"
						style="{getDynamicGradient()}"
					>
						<!-- Tier Zones -->
						{#each tierList.tiers as tier, index (tier.id)}
							{@const tierHeight = 100 / tierList.tiers.length}
							{@const tierTop = (index / tierList.tiers.length) * 100}
							<div 
								class="absolute left-0 right-0 transition-all pointer-events-none"
								style="top: {tierTop}%; height: {tierHeight}%;"
							>
								<!-- Tier Controls -->
								<div class="absolute top-0 right-0 w-64 h-full flex items-center justify-end pr-8 pointer-events-auto">
									<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
										<div 
											class="text-4xl font-bold text-right"
											style="color: {tier.color};"
										>
											{tier.name}
										</div>
									</div>
								</div>
							</div>
						{/each}
						
						<!-- All Dynamic Items -->
						{#if tierList && tierList.tiers}
							{#each [...tierList.unassignedItems, ...tierList.tiers.flatMap((tier, tierIndex) => 
								tier.items.map(item => ({ 
									...item, 
									_defaultY: (tierIndex + 0.5) / tierList!.tiers.length 
								}))
							)] as item, i (item.id)}
							{@const x = item.position?.x ?? (0.1 + (i % 8) * 0.1)}
							{@const y = item.position?.y ?? (item as any)._defaultY ?? 0.5}
							{@const itemSize = getItemSize(item)}
							
							<!-- svelte-ignore a11y-no-static-element-interactions -->
							<div 
								class="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg shadow-lg transition-all hover:shadow-xl group/item overflow-hidden {selectedItem?.id === item.id ? 'ring-2 ring-orange-400' : ''}"
								style="left: {x * 100}%; top: {y * 100}%; width: {itemSize.width}px; height: {itemSize.height}px; {item.image ? `background-image: url('${item.image}'); background-size: cover; background-position: center;` : item.type === 'text' ? 'background: linear-gradient(135deg, #374151, #4b5563); display: flex; align-items: center; justify-content: center;' : 'background: linear-gradient(135deg, #1f2937, #374151);'}"
								on:click|stopPropagation={() => selectItem(item)}
								on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectItem(item)}
								role="button"
								tabindex="0"
								aria-label="View item {item.text}"
							>
								<!-- Gradient overlay for images -->
								{#if item.image}
									<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
								{/if}
								
								{#if item.type === 'text' && !item.image}
									<!-- Text items - centered text -->
									<div class="absolute inset-0 flex items-center justify-center p-2 z-10">
										<div class="text-sm font-medium text-white text-center leading-tight">{item.text}</div>
									</div>
								{:else}
									<!-- Image items - text in bottom right -->
									<div class="absolute bottom-1 right-1 z-10">
										<div class="text-xs font-medium text-white drop-shadow-lg text-right leading-tight">{item.text}</div>
									</div>
								{/if}
							</div>
							{/each}
						{/if}
					</div>
				</div>
			{/if}

			<!-- Unassigned Items (for classic mode) -->
			{#if tierList.type === 'classic' && tierList.unassignedItems.length > 0}
				<div class="bg-gray-800 border-t border-gray-600">
					<div class="p-6">
						<div class="text-lg font-bold text-gray-300 mb-4">Unranked Items</div>
						<div class="flex flex-wrap gap-3">
							{#each tierList.unassignedItems as item (item.id)}
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div 
									class="rounded-lg shadow-sm hover:shadow-lg transition-shadow relative cursor-pointer overflow-hidden bg-gradient-to-br from-gray-700 to-gray-800 {selectedItem?.id === item.id ? 'ring-2 ring-orange-400' : ''}"
									style="width: 120px; height: 120px; {item.image ? `background-image: url('${item.image}'); background-size: cover; background-position: center;` : ''}"
									on:click|stopPropagation={() => selectItem(item)}
									on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && selectItem(item)}
									role="button"
									tabindex="0"
									aria-label="View item {item.text}"
								>
									<!-- Gradient overlay -->
									{#if item.image}
										<div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
									{/if}
									
									<!-- Text positioning -->
									{#if item.type === 'text' && !item.image}
										<div class="absolute inset-0 flex items-center justify-center p-2 z-10">
											<span class="text-sm font-medium text-white text-center leading-tight">{item.text}</span>
										</div>
									{:else}
										<div class="absolute bottom-2 left-2 z-10">
											<span class="text-sm font-medium text-white drop-shadow-lg">{item.text}</span>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Sidebar -->
		<div class="w-80 border-l border-gray-600 bg-gray-900">
			<TierlistSidebar
				title={tierList.title}
				author={tierList.author || 'Anonymous'}
				date={tierList.created_at || new Date().toISOString()}
				revision={1}
				shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/tierlists/${tierList.id}`}
				id={tierList.id}
				tierListData={tierList}
				on:delete={handleSidebarDelete}
			/>
		</div>
	{/if}
</div>
