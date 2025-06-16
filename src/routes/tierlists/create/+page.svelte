<script lang="ts">
	import { apiClient } from '$lib/api';
	import { searchGoogleImages } from '$lib/google-images';
	import { onMount } from 'svelte';

	// Types
	interface TierItem {
		id: string;
		text: string;
		image?: string;
		type: 'text' | 'image' | 'search';
		position?: { x: number; y: number }; 
	}

	interface Tier {
		id: string;
		name: string;
		color: string;
		items: TierItem[];
	}

	// States
	let tierList = {
		title: 'Untitled Tier List',
		type: 'classic' as 'classic' | 'dynamic',
		tiers: [
			{ id: 's', name: 'S', color: '#ff7f7f', items: [] },
			{ id: 'a', name: 'A', color: '#ffbf7f', items: [] },
			{ id: 'b', name: 'B', color: '#ffff7f', items: [] },
			{ id: 'c', name: 'C', color: '#bfff7f', items: [] }
		] as Tier[],
		unassignedItems: [] as TierItem[]
	};

	// Modal and UI state
	let showAddItemModal = false;
	let addItemModalX = 0;
	let addItemModalY = 0;
	let addItemType: 'text' | 'upload' | 'search' = 'text';
	let error = '';
	let creating = false;
	let editingTitle = false;

	// Item management state
	let targetTierId: string | null = null;
	let targetPosition: number | null = null;
	let newItemText = '';
	let editingItemId: string | null = null;
	let inlineEditText = '';

	// Search state
	let searchQuery = '';
	let searchResults: any[] = [];
	let searching = false;
	let searchTimeout: any;

	// Modal state
	let showColorPicker = false;
	let colorPickerTierId: string | null = null;
	let showItemEditor = false;
	let editingItem: TierItem | null = null;

	// Context menu state
	let showContextMenu = false;
	let contextMenuX = 0;
	let contextMenuY = 0;
	let contextMenuItem: TierItem | null = null;

	// Drag and drop state
	let draggedItem: TierItem | null = null;
	let draggedFromTier: string | null = null;
	let dragOverTier: string | null = null;
	let dragOverPosition: number | null = null;
	let isDragging = false;

	// === CONSTANTS ===
	const tierColors = [
		'#ff7f7f', '#ffbf7f', '#ffff7f', '#bfff7f', '#7fff7f',
		'#7fffff', '#7fbfff', '#7f7fff', '#bf7fff', '#ff7fff'
	];

	// === UTILITY FUNCTIONS ===
	
	/** Dims a hex color by a given factor for better background contrast */
	function dimColor(color: string, factor: number = 0.7): string {
		const hex = color.replace('#', '');
		const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
		const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
		const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	/** Generates dynamic gradient background based on tier colors */
	function getDynamicGradient(): string {
		if (tierList.tiers.length <= 1) return 'background: linear-gradient(to bottom, #2d7a2d, #7a2d2d);';
		
		const colors = tierList.tiers.map(tier => dimColor(tier.color, 0.6));
		const gradientStops = colors
			.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`)
			.join(', ');
		
		return `background: linear-gradient(to bottom, ${gradientStops});`;
	}

	/** Sets focus on input element after DOM update */
	function focusInput(selector: string, delay: number = 10) {
		setTimeout(() => {
			const input = document.querySelector(selector) as HTMLInputElement;
			if (input) {
				input.focus();
				input.select();
			}
		}, delay);
	}

	/** Finds item in tier list and returns its location */
	function findItem(itemId: string): { item: TierItem; tier: Tier | null } | null {
		// Check unassigned items first
		const unassignedItem = tierList.unassignedItems.find(i => i.id === itemId);
		if (unassignedItem) return { item: unassignedItem, tier: null };

		// Check in tiers
		for (const tier of tierList.tiers) {
			const item = tier.items.find(i => i.id === itemId);
			if (item) return { item, tier };
		}
		
		return null;
	}

	/** Updates item properties across all tiers and unassigned items */
	function updateItemEverywhere(itemId: string, updates: Partial<TierItem>) {
		tierList.tiers = tierList.tiers.map(tier => ({
			...tier,
			items: tier.items.map(item => 
				item.id === itemId ? { ...item, ...updates } : item
			)
		}));
		
		tierList.unassignedItems = tierList.unassignedItems.map(item => 
			item.id === itemId ? { ...item, ...updates } : item
		);
	}

	/** Removes item from all locations */
	function removeItemEverywhere(itemId: string) {
		tierList.tiers = tierList.tiers.map(tier => ({
			...tier,
			items: tier.items.filter(item => item.id !== itemId)
		}));
		tierList.unassignedItems = tierList.unassignedItems.filter(item => item.id !== itemId);
	}

	// Tier Management
	
	function toggleTitleEdit() {
		editingTitle = !editingTitle;
	}

	function addTier() {
		const newTier: Tier = {
			id: `tier_${Date.now()}`,
			name: `Tier ${tierList.tiers.length + 1}`,
			color: tierColors[tierList.tiers.length % tierColors.length],
			items: []
		};
		tierList.tiers = [...tierList.tiers, newTier];
	}

	function addTierAtPosition(position: number) {
		const newTier: Tier = {
			id: `tier_${Date.now()}`,
			name: `Tier ${tierList.tiers.length + 1}`,
			color: tierColors[tierList.tiers.length % tierColors.length],
			items: []
		};
		tierList.tiers.splice(position, 0, newTier);
		tierList.tiers = [...tierList.tiers];
	}

	function removeTier(tierId: string) {
		if (tierList.tiers.length > 1) {
			const tierToRemove = tierList.tiers.find(t => t.id === tierId);
			if (tierToRemove) {
				tierList.unassignedItems = [...tierList.unassignedItems, ...tierToRemove.items];
				tierList.tiers = tierList.tiers.filter(t => t.id !== tierId);
			}
		}
	}

	function updateTierColor(tierId: string, color: string) {
		tierList.tiers = tierList.tiers.map(tier => 
			tier.id === tierId ? { ...tier, color } : tier
		);
		closeColorPicker();
	}

	// Modal Management

	function openColorPicker(tierId: string) {
		colorPickerTierId = tierId;
		showColorPicker = true;
	}

	function closeColorPicker() {
		showColorPicker = false;
		colorPickerTierId = null;
	}

	function openItemEditor(item: TierItem) {
		editingItem = { ...item };
		showItemEditor = true;
	}

	function closeItemEditor() {
		showItemEditor = false;
		editingItem = null;
	}

	function openAddItemModal(tierId: string | null = null, position: number | null = null, event?: MouseEvent) {
		targetTierId = tierId;
		targetPosition = position;
		
		// Position modal at cursor or center
		if (event) {
			addItemModalX = Math.min(event.clientX + 10, window.innerWidth - 350);
			addItemModalY = Math.max(event.clientY - 50, 10);
		} else {
			addItemModalX = window.innerWidth / 2 - 175; 
			addItemModalY = window.innerHeight / 2 - 100;
		}
		
		showAddItemModal = true;
		newItemText = '';
		searchQuery = '';
		searchResults = [];
		addItemType = 'text';
		
		focusInput('#quick-add-input');
	}

	function closeAddItemModal() {
		showAddItemModal = false;
		targetTierId = null;
		targetPosition = null;
		addItemType = 'text';
		clearTimeout(searchTimeout);
	}

	// Item Editing
	
	function startInlineEdit(item: TierItem) {
		editingItemId = item.id;
		inlineEditText = item.text;
		closeContextMenu();
		focusInput(`#inline-edit-${item.id}`);
	}

	function finishInlineEdit() {
		if (!editingItemId || !inlineEditText.trim()) {
			cancelInlineEdit();
			return;
		}

		updateItemEverywhere(editingItemId, { text: inlineEditText.trim() });
		editingItemId = null;
		inlineEditText = '';
	}

	function cancelInlineEdit() {
		editingItemId = null;
		inlineEditText = '';
	}

	function updateItem() {
		if (!editingItem) return;
		updateItemEverywhere(editingItem.id, editingItem);
		closeItemEditor();
	}

	function deleteItem(itemId: string) {
		removeItemEverywhere(itemId);
		closeItemEditor();
		closeContextMenu();
	}

	// Context Menu

	function showItemContextMenu(item: TierItem, event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		
		contextMenuItem = item;
		contextMenuX = event.clientX;
		contextMenuY = event.clientY;
		showContextMenu = true;
	}

	function closeContextMenu() {
		showContextMenu = false;
		contextMenuItem = null;
	}

	// Item Movement

	function moveItemToTier(itemId: string, targetTierId: string | null) {
		const found = findItem(itemId);
		if (!found) return;

		// Remove from current location
		removeItemEverywhere(itemId);
		
		// Add to new location
		if (targetTierId) {
			tierList.tiers = tierList.tiers.map(tier => 
				tier.id === targetTierId 
					? { ...tier, items: [...tier.items, found.item] }
					: tier
			);
		} else {
			tierList.unassignedItems = [...tierList.unassignedItems, found.item];
		}
	}

	function moveItemToPosition(itemId: string, targetTierId: string | null, position: number) {
		const found = findItem(itemId);
		if (!found) return;

		// Remove from current location
		removeItemEverywhere(itemId);
		
		// Add to new location at position
		if (targetTierId) {
			tierList.tiers = tierList.tiers.map(tier => {
				if (tier.id === targetTierId) {
					const newItems = [...tier.items];
					newItems.splice(position, 0, found.item);
					return { ...tier, items: newItems };
				}
				return tier;
			});
		} else {
			const newUnassigned = [...tierList.unassignedItems];
			newUnassigned.splice(position, 0, found.item);
			tierList.unassignedItems = newUnassigned;
		}
	}

	// Drag and Drop

	function handleDragStart(event: DragEvent, item: TierItem) {
		if (!event.dataTransfer) return;
		
		draggedItem = item;
		isDragging = true;
		
		const tierWithItem = tierList.tiers.find(tier => tier.items.some(i => i.id === item.id));
		draggedFromTier = tierWithItem ? tierWithItem.id : null;
		
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', item.id);
		
		if (event.target instanceof HTMLElement) {
			event.target.style.opacity = '0.5';
		}
	}

	function handleDragEnd(event: DragEvent) {
		isDragging = false;
		draggedItem = null;
		draggedFromTier = null;
		dragOverTier = null;
		dragOverPosition = null;
		
		if (event.target instanceof HTMLElement) {
			event.target.style.opacity = '1';
		}
	}

	function handleFreeformDrag(event: DragEvent, item: TierItem) {
		if (tierList.type !== 'dynamic') return;
		
		const canvas = (event.currentTarget as HTMLElement)?.closest('.dynamic-canvas') as HTMLElement;
		if (!canvas) return;
		
		const rect = canvas.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
		const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
		
		updateItemEverywhere(item.id, { position: { x, y } });
	}

	function handleDragOver(event: DragEvent, tierId: string | null, position?: number) {
		event.preventDefault();
		if (!event.dataTransfer) return;
		
		event.dataTransfer.dropEffect = 'move';
		dragOverTier = tierId;
		dragOverPosition = position !== undefined ? position : null;
	}

	function handleDrop(event: DragEvent, tierId: string | null, position?: number) {
		event.preventDefault();
		if (!draggedItem) return;
		
		if (position !== undefined) {
			moveItemToPosition(draggedItem.id, tierId, position);
		} else {
			moveItemToTier(draggedItem.id, tierId);
		}
		
		// Reset drag state
		isDragging = false;
		draggedItem = null;
		draggedFromTier = null;
		dragOverTier = null;
		dragOverPosition = null;
	}

	// Item Creation

	/** Creates initial position for dynamic mode items */
	function createItemPosition(tierId?: string): { x: number; y: number } | undefined {
		if (tierList.type !== 'dynamic') return undefined;
		
		if (tierId) {
			const tierIndex = tierList.tiers.findIndex(t => t.id === tierId);
			if (tierIndex !== -1) {
				return {
					x: 0.1 + Math.random() * 0.8,
					y: (tierIndex + 0.2 + Math.random() * 0.6) / tierList.tiers.length
				};
			}
		}
		
		return {
			x: 0.1 + Math.random() * 0.8,
			y: targetPosition ?? (0.3 + Math.random() * 0.4)
		};
	}

	/** Adds item to appropriate location (tier or unassigned) */
	function addItemToLocation(item: TierItem) {
		if (targetTierId) {
			tierList.tiers = tierList.tiers.map(tier =>
				tier.id === targetTierId ? { ...tier, items: [...tier.items, item] } : tier
			);
		} else {
			tierList.unassignedItems = [...tierList.unassignedItems, item];
		}
	}

	function addTextItem() {
		if (!newItemText.trim()) return;
		
		const newItem: TierItem = {
			id: `item_${Date.now()}`,
			text: newItemText.trim(),
			type: 'text',
			position: createItemPosition(targetTierId || undefined)
		};

		addItemToLocation(newItem);
		closeAddItemModal();
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file || !file.type.startsWith('image/')) return;
		
		const newItem: TierItem = {
			id: `item_${Date.now()}`,
			text: file.name,
			image: URL.createObjectURL(file),
			type: 'image',
			position: createItemPosition(targetTierId || undefined)
		};

		addItemToLocation(newItem);
		closeAddItemModal();
	}

	function addSearchResult(result: any) {
		const newItem: TierItem = {
			id: `item_${Date.now()}`,
			text: searchQuery.trim() || result.title,
			image: result.fullUrl || result.url,
			type: 'search',
			position: createItemPosition(targetTierId || undefined)
		};

		addItemToLocation(newItem);
		closeAddItemModal();
	}

	// Search Functionality

	async function searchImages() {
		if (!searchQuery.trim()) return;

		searching = true;
		try {
			const results = await searchGoogleImages(searchQuery, 12);
			searchResults = results.map(result => ({
				url: result.image?.thumbnailLink || result.link,
				fullUrl: result.link,
				title: result.title,
				snippet: result.snippet
			}));
		} catch (err) {
			console.error('Search error:', err);
			// Fallback results for development
			searchResults = Array.from({ length: 6 }, (_, i) => ({
				url: `https://picsum.photos/seed/fallback-${i + 1}/150/100`,
				fullUrl: `https://picsum.photos/seed/fallback-${i + 1}/300/200`,
				title: `${searchQuery} ${i + 1}`,
				snippet: 'Fallback result'
			}));
		} finally {
			searching = false;
		}
	}

	// Save Functionality

	async function saveTierList() {
		try {
			creating = true;
			error = '';

			if (!tierList.title.trim()) {
				error = 'Please provide a title';
				return;
			}

			const allItems = [
				...tierList.unassignedItems,
				...tierList.tiers.flatMap(tier => tier.items)
			];

			if (allItems.length === 0) {
				error = 'Please add at least 1 item';
				return;
			}

			const tierListData = {
				title: tierList.title,
				list_type: 'classic' as const,
				tiers: tierList.tiers.map((tier, index) => ({
					name: tier.name,
					position: index / tierList.tiers.length
				})),
				items: allItems.map(item => item.text)
			};

			await apiClient.createTierList(tierListData);
			window.location.href = '/tierlists';
		} catch (err) {
			error = 'Failed to create tier list';
			console.error('Error creating tier list:', err);
		} finally {
			creating = false;
		}
	}

	// Lifecycle

	onMount(() => {
		// Prevent page scrolling when editing
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = 'auto';
		};
	});
</script>

<svelte:head>
	<title>Create Tier List - Standpoint</title>
</svelte:head>

<!-- Fullscreen Tier List Creator -->
<div class="fixed inset-0 flex flex-col bg-black text-white">
	<!-- Top Bar with Title -->
	<div class="flex items-center justify-between border-b border-gray-700 bg-black px-6 py-4">
		<div class="flex items-center space-x-4">
			<div class="pl-10 items-center space-x-2">
				{#if editingTitle}
					<input
						class="border-b-2 border-orange-500 bg-transparent px-2 py-1 text-2xl font-bold text-white outline-none"
						bind:value={tierList.title}
						on:blur={toggleTitleEdit}
						on:keydown={(e) => e.key === 'Enter' && toggleTitleEdit()}
					/>
				{:else}
					<button
						class="cursor-pointer text-2xl font-bold transition-colors hover:text-orange-400 bg-transparent border-none p-0"
						on:click={toggleTitleEdit}
						aria-label="Edit title"
					>
						{tierList.title}
					</button>
				{/if}
				<span class="text-sm text-gray-500">AUTOMATICALLY SAVED TO DRAFTS</span>
			</div>
		</div>

		<div class="flex items-center space-x-4">
			<!-- Mode Toggle with Animation -->
			<div class="relative flex bg-[#191919] p-1">
				<div
					class="absolute top-1 bottom-1 bg-orange-500 transition-all duration-300 ease-in-out"
					style="left: {tierList.type === 'classic'
						? '4px'
						: 'calc(50% + 2px)'}; width: calc(50% - 6px);"
				></div>
				<button
					class="relative z-10 px-4 py-2 text-sm font-medium transition-colors duration-300 {tierList.type ===
					'classic'
						? 'text-white'
						: 'text-gray-400 hover:text-white'}"
					on:click={() => (tierList.type = 'classic')}
				>
					Classic
				</button>
				<button
					class="relative z-10 px-4 py-2 text-sm font-medium transition-colors duration-300 {tierList.type ===
					'dynamic'
						? 'text-white'
						: 'text-gray-400 hover:text-white'}"
					on:click={() => (tierList.type = 'dynamic')}
				>
					Dynamic
				</button>
			</div>

			<button
				class="bg-orange-500 px-6 py-2 font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
				on:click={saveTierList}
				disabled={creating}
			>
				{creating ? 'POSTING...' : 'POST'}
			</button>
		</div>
	</div>

	{#if error}
		<div class="mx-6 mt-4 rounded border border-red-700 bg-red-900 px-4 py-3 text-red-200">
			{error}
		</div>
	{/if}

	<!-- Main Tier List Display -->
	<div class="flex-1 flex flex-col">
		{#if tierList.type === 'classic'}
			<!-- Classic Mode -->
			<div class="flex-1 flex flex-col">
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				{#each tierList.tiers as tier, index (tier.id)}
					<div 
						class="relative flex flex-1 transition-all duration-300"
						style="background-color: {dimColor(tier.color, 0.6)};"
					>
						<!-- Tier Items Area -->
						<div 
							class="flex-1 p-6 cursor-pointer transition-colors relative"
							on:click={(e) => openAddItemModal(tier.id, null, e)}
							on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openAddItemModal(tier.id)}
							role="button"
							tabindex="0"
						>
							<!-- Tier Controls -->
							<div class="group absolute top-0 right-0 w-64 h-full flex items-center justify-end pr-8">
								<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
									<!-- Tier Title -->
									<input 
										class="text-4xl font-bold bg-transparent border-none outline-none text-right placeholder-gray-300 cursor-text"
										style="color: {tier.color};"
										bind:value={tier.name}
										placeholder="Tier"
										on:click|stopPropagation
									/>
									
									<!-- Hover Controls -->
									<div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-row space-x-2 justify-end">
										{#each [
											{ icon: 'add', action: () => openAddItemModal(tier.id), title: 'Add item' },
											{ icon: 'settings', action: () => openColorPicker(tier.id), title: 'Settings' },
											{ icon: 'keyboard_arrow_down', action: () => addTierAtPosition(index + 1), title: 'Add tier below' },
											{ icon: 'keyboard_arrow_up', action: () => addTierAtPosition(index), title: 'Add tier above' }
										] as control}
											<button 
												class="w-8 h-8 flex items-center justify-center hover:bg-black hover:bg-opacity-20 rounded transition-colors"
												style="color: {tier.color};"
												on:click|stopPropagation={control.action}
												title={control.title}
											>
												<span class="material-symbols-outlined text-lg">{control.icon}</span>
											</button>
										{/each}
										{#if tierList.tiers.length > 1}
											<button 
												class="w-8 h-8 flex items-center justify-center hover:bg-black hover:bg-opacity-20 rounded transition-colors"
												style="color: {tier.color};"
												on:click|stopPropagation={() => removeTier(tier.id)}
												title="Remove tier"
											>
												<span class="material-symbols-outlined text-lg">delete</span>
											</button>
										{/if}
									</div>
								</div>
							</div>

							{#if tier.items.length > 0}
								<div class="grid grid-cols-10 gap-4 pr-80">
									{#each tier.items as item, itemIndex (item.id)}						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div 
							class="group/item bg-black bg-opacity-20 rounded-lg p-3 shadow-sm flex flex-col items-center space-y-2 hover:bg-opacity-30 transition-colors relative cursor-pointer {isDragging && draggedItem?.id === item.id ? 'opacity-50' : ''}"
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, item)}
							on:dragend={handleDragEnd}
							on:dragover={(e) => handleDragOver(e, tier.id, itemIndex)}
							on:drop={(e) => handleDrop(e, tier.id, itemIndex)}
							on:click|stopPropagation={() => startInlineEdit(item)}
							on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && startInlineEdit(item)}
							on:contextmenu={(e) => showItemContextMenu(item, e)}
							role="button"
							tabindex="0"
							aria-label="Edit item {item.text}"
						>
											<!-- Delete button -->
											<button
												class="absolute -top-2 -left-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity z-10"
												on:click|stopPropagation={() => deleteItem(item.id)}
												title="Delete item"
											>
												<span class="material-symbols-outlined text-sm">close</span>
											</button>
											{#if editingItemId === item.id}
												<input
													id="inline-edit-{item.id}"
													class="w-full bg-transparent border-none outline-none text-center text-sm font-medium text-white"
													bind:value={inlineEditText}
													on:blur={finishInlineEdit}
													on:keydown={(e) => {
														if (e.key === 'Enter') finishInlineEdit();
														if (e.key === 'Escape') cancelInlineEdit();
													}}
												/>
											{:else}
												{#if item.image}
													<img src={item.image} alt={item.text} class="w-16 h-16 object-cover rounded" />
												{/if}
												<span class="text-sm text-center font-medium text-white">{item.text}</span>
											{/if}
											
											<!-- Drop zone indicator -->
											{#if isDragging && dragOverTier === tier.id && dragOverPosition === itemIndex}
												<div class="absolute -left-1 top-0 bottom-0 w-1 bg-orange-500 rounded"></div>
											{/if}
										</div>
									{/each}
									
									<!-- Drop zone at end of tier -->
									{#if isDragging}
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div 
											class="min-h-20 border-2 border-dashed border-gray-400 rounded-lg flex items-center justify-center opacity-50 hover:border-orange-400 transition-colors"
											on:dragover={(e) => handleDragOver(e, tier.id, tier.items.length)}
											on:drop={(e) => handleDrop(e, tier.id, tier.items.length)}
										>
											<span class="text-gray-400 text-sm">Drop here</span>
										</div>
									{/if}
								</div>
							{:else}
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div 
									class="flex items-center justify-center h-full text-center pr-80 {isDragging ? 'border-2 border-dashed border-gray-400 rounded-lg' : ''}"
									on:dragover={(e) => handleDragOver(e, tier.id, 0)}
									on:drop={(e) => handleDrop(e, tier.id, 0)}
								>
									<div class="text-white">
										<div class="text-3xl mb-2 opacity-40">+</div>
										<div class="text-lg opacity-60">{isDragging ? 'Drop item here' : 'Click to add items'}</div>
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
					class="flex-1 relative cursor-crosshair overflow-hidden dynamic-canvas"
					style="{getDynamicGradient()}"
					on:click={(e) => {
						const rect = e.currentTarget.getBoundingClientRect();
						const x = (e.clientX - rect.left) / rect.width;
						const y = (e.clientY - rect.top) / rect.height;
						openAddItemModal(null, y);
					}}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openAddItemModal(null, 0.5)}
					on:dragover={(e) => {
						e.preventDefault();
						if (tierList.type === 'dynamic' && draggedItem) {
							handleFreeformDrag(e, draggedItem);
						}
					}}
					on:drop={(e) => {
						e.preventDefault();
						if (tierList.type === 'dynamic' && draggedItem) {
							handleFreeformDrag(e, draggedItem);
						}
					}}
					role="button"
					tabindex="0"
					aria-label="Click to add items to tier list"
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
							<div class="group absolute top-0 right-0 w-64 h-full flex items-center justify-end pr-8 pointer-events-auto">
								<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
									<input 
										class="text-4xl font-bold bg-transparent border-none outline-none text-right placeholder-gray-300 cursor-text"
										style="color: {tier.color};"
										bind:value={tier.name}
										placeholder="Tier"
										on:click|stopPropagation
									/>
									
									<div class="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-row space-x-2 justify-end">
										{#each [
											{ icon: 'add', action: () => openAddItemModal(tier.id), title: 'Add item' },
											{ icon: 'settings', action: () => openColorPicker(tier.id), title: 'Settings' },
											{ icon: 'keyboard_arrow_down', action: () => addTierAtPosition(index + 1), title: 'Add tier below' },
											{ icon: 'keyboard_arrow_up', action: () => addTierAtPosition(index), title: 'Add tier above' }
										] as control}
											<button 
												class="w-8 h-8 flex items-center justify-center hover:bg-black hover:bg-opacity-20 rounded transition-colors"
												style="color: {tier.color};"
												on:click|stopPropagation={control.action}
												title={control.title}
											>
												<span class="material-symbols-outlined text-lg">{control.icon}</span>
											</button>
										{/each}
										{#if tierList.tiers.length > 1}
											<button 
												class="w-8 h-8 flex items-center justify-center hover:bg-black hover:bg-opacity-20 rounded transition-colors"
												style="color: {tier.color};"
												on:click|stopPropagation={() => removeTier(tier.id)}
												title="Remove tier"
											>
												<span class="material-symbols-outlined text-lg">delete</span>
											</button>
										{/if}
									</div>
								</div>
							</div>
						</div>
					{/each}
					
					<!-- All Dynamic Items -->
					{#each [...tierList.unassignedItems, ...tierList.tiers.flatMap((tier, tierIndex) => 
						tier.items.map(item => ({ 
							...item, 
							_defaultY: (tierIndex + 0.5) / tierList.tiers.length 
						}))
					)] as item, i (item.id)}
						{@const x = item.position?.x ?? (0.1 + (i % 8) * 0.1)}
						{@const y = item.position?.y ?? (item as any)._defaultY ?? 0.5}
						{@const isEditing = editingItemId === item.id}
						{@const isDragged = isDragging && draggedItem?.id === item.id}
						
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div 
							class="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg bg-black bg-opacity-30 p-3 shadow-lg transition-all hover:bg-opacity-50 hover:shadow-xl group/item {isDragged ? 'opacity-50' : ''}"
							style="left: {x * 100}%; top: {y * 100}%;"
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, item)}
							on:dragend={handleDragEnd}
							on:click|stopPropagation={() => startInlineEdit(item)}
							on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && startInlineEdit(item)}
							on:contextmenu={(e) => showItemContextMenu(item, e)}
							role="button"
							tabindex="0"
							aria-label="Edit item {item.text}"
						>
							<!-- Delete button -->
							<button
								class="absolute -top-2 -left-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity z-10"
								on:click|stopPropagation={() => deleteItem(item.id)}
								title="Delete item"
							>
								<span class="material-symbols-outlined text-sm">close</span>
							</button>
							
							{#if isEditing}
								<input
									id="inline-edit-{item.id}"
									class="w-full bg-transparent border-none outline-none text-center text-sm font-medium text-white"
									bind:value={inlineEditText}
									on:blur={finishInlineEdit}
									on:keydown={(e) => {
										if (e.key === 'Enter') finishInlineEdit();
										if (e.key === 'Escape') cancelInlineEdit();
									}}
								/>
							{:else}
								{#if item.image}
									<img src={item.image} alt={item.text} class="w-16 h-16 object-cover rounded mb-1" />
								{/if}
								<div class="text-center text-sm font-medium text-white">{item.text}</div>
							{/if}
						</div>
					{/each}
					
					{#if tierList.unassignedItems.length === 0 && tierList.tiers.every(t => t.items.length === 0)}
						<div class="absolute inset-0 flex items-center justify-center text-white pointer-events-none">
							<div class="text-center bg-black bg-opacity-30 rounded-lg p-6">
								<div class="text-3xl mb-2 opacity-60">+</div>
								<div class="opacity-80">Click anywhere to add your first item</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<!-- Context Menu for Items -->
	{#if showContextMenu && contextMenuItem}
		<div 
			class="fixed inset-0 z-40"
			on:click={closeContextMenu}
			on:keydown={(e) => e.key === 'Escape' && closeContextMenu()}
			role="button"
			aria-label="Close context menu"
			tabindex="-1"
		></div>
		<div 
			class="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-48"
			style="left: {contextMenuX}px; top: {contextMenuY}px;"
		>
			<!-- Main Actions -->
			{#each [
				{ icon: 'edit', text: 'Edit Text', action: () => contextMenuItem && startInlineEdit(contextMenuItem) },
				{ icon: 'image', text: contextMenuItem?.image ? 'Change Image' : 'Add Image', action: () => {
					if (!contextMenuItem) return;
					const input = document.createElement('input');
					input.type = 'file';
					input.accept = 'image/*';
					const currentItem = contextMenuItem;
					input.onchange = (e) => {
						const target = e.target as HTMLInputElement;
						const file = target.files?.[0];
						if (file && file.type.startsWith('image/')) {
							updateItemEverywhere(currentItem.id, { image: URL.createObjectURL(file) });
						}
					};
					input.click();
					closeContextMenu();
				} }
			] as menuItem}
				<button
					class="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors flex items-center space-x-2"
					on:click={menuItem.action}
				>
					<span class="material-symbols-outlined text-sm">{menuItem.icon}</span>
					<span>{menuItem.text}</span>
				</button>
			{/each}
			
			<div class="border-t border-gray-600 my-1"></div>
			
			<!-- Move to Tier -->
			<div class="px-4 py-1 text-xs text-gray-400">Move to:</div>
			{#each [{ id: null, name: 'Unassigned', color: '#fff' }, ...tierList.tiers] as tier}
				<button
					class="w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition-colors"
					style="color: {tier.color};"
					on:click={() => {
						if (contextMenuItem) {
							moveItemToTier(contextMenuItem.id, tier.id);
							closeContextMenu();
						}
					}}
				>
					{tier.name}
				</button>
			{/each}
			
			<div class="border-t border-gray-600 my-1"></div>
			
			<!-- Delete -->
			<button
				class="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 transition-colors flex items-center space-x-2"
				on:click={() => {
					if (contextMenuItem) {
						deleteItem(contextMenuItem.id);
					}
				}}
			>
				<span class="material-symbols-outlined text-sm">delete</span>
				<span>Delete Item</span>
			</button>
		</div>
	{/if}
</div>

<!-- Add Item Modal -->
{#if showAddItemModal}
	<!-- Modal positioned at cursor -->
	<div 
		class="fixed z-50 bg-gray-800 rounded-lg shadow-2xl border border-gray-600 w-80"
		style="left: {addItemModalX}px; top: {addItemModalY}px;"
	>
		<!-- Main search/text input area -->
		<div class="p-4">
			<div class="relative">
				{#if addItemType === 'search'}
					<input
						id="quick-add-input"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
						type="text"
						bind:value={searchQuery}
						placeholder="Search images..."
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								searchImages();
							}
						}}
						on:input={() => {
							// Auto-search as user types when in search mode
							if (searchQuery.trim().length > 2) {
								// Debounce search
								clearTimeout(searchTimeout);
								searchTimeout = setTimeout(() => {
									searchImages();
								}, 500);
							}
						}}
					/>
				{:else}
					<input
						id="quick-add-input"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
						type="text"
						bind:value={newItemText}
						placeholder="Type to add item..."
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								addTextItem();
							}
						}}
					/>
				{/if}
				
				<!-- Search/Add button in the input -->
				<button
					class="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-md transition-colors {addItemType === 'search' ? 'text-blue-400 hover:bg-blue-500 hover:bg-opacity-20' : 'text-orange-400 hover:bg-orange-500 hover:bg-opacity-20'}"
					on:click={() => {
						if (addItemType === 'search') {
							searchImages();
						} else {
							addTextItem();
						}
					}}
					title={addItemType === 'search' ? 'Search' : 'Add Item'}
				>
					<span class="material-symbols-outlined text-lg">
						{addItemType === 'search' ? 'search' : 'add'}
					</span>
				</button>
			</div>
			
			<!-- Quick add button for text -->
			{#if addItemType === 'text' && newItemText.trim()}
				<button
					class="mt-3 w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
					on:click={addTextItem}
				>
					Add "{newItemText.trim()}"
				</button>
			{/if}
		</div>

		<!-- Search Results -->
		{#if addItemType === 'search' && searchResults.length > 0}
			<div class="border-t border-gray-600 p-4 max-h-64 overflow-y-auto">
				<div class="text-sm text-gray-400 mb-3">Search Results</div>
				<div class="grid grid-cols-3 gap-2">
					{#each searchResults as result}
						<button
							class="rounded-lg border border-gray-600 p-2 transition-colors hover:bg-gray-700 hover:border-orange-400"
							on:click={() => addSearchResult(result)}
							title={result.title}
						>
							<img
								src={result.url}
								alt={result.title}
								class="w-full h-16 rounded object-cover mb-1"
								loading="lazy"
							/>
							<div class="text-xs text-gray-300 truncate">{result.title}</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Loading indicator for search -->
		{#if addItemType === 'search' && searching}
			<div class="border-t border-gray-600 p-4 text-center">
				<div class="inline-flex items-center space-x-2 text-gray-400">
					<div class="w-4 h-4 border-2 border-gray-400 border-t-orange-500 rounded-full animate-spin"></div>
					<span class="text-sm">Searching...</span>
				</div>
			</div>
		{/if}

		<!-- Footer with mode toggle and upload -->
		<div class="border-t border-gray-600 p-3 flex items-center justify-between">
			<!-- Mode toggles -->
			<div class="flex items-center space-x-2">
				{#each [
					{ type: 'text' as const, icon: 'text_fields', title: 'Text Mode' },
					{ type: 'search' as const, icon: 'search', title: 'Search Mode' }
				] as mode}
					<button
						class="w-8 h-8 flex items-center justify-center rounded-md transition-colors {addItemType === mode.type ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}"
						on:click={() => {
							addItemType = mode.type;
							focusInput('#quick-add-input');
						}}
						title={mode.title}
					>
						<span class="material-symbols-outlined text-sm">{mode.icon}</span>
					</button>
				{/each}
				
				<!-- Upload button -->
				<label
					class="w-8 h-8 flex items-center justify-center rounded-md transition-colors text-gray-400 hover:text-white hover:bg-gray-700 cursor-pointer"
					title="Upload Image"
				>
					<span class="material-symbols-outlined text-sm">upload</span>
					<input type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
				</label>
			</div>
			
			<!-- Close button -->
			<button
				class="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
				on:click={closeAddItemModal}
				title="Close"
			>
				<span class="material-symbols-outlined text-sm">close</span>
			</button>
		</div>
	</div>
{/if}

<!-- Color Picker Modal -->
{#if showColorPicker && colorPickerTierId}
	{@const currentTier = tierList.tiers.find(t => t.id === colorPickerTierId)}
	{#if currentTier}
		<div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
			<div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-600">
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-xl font-bold text-white">Tier Settings</h2>
					<button 
						class="text-gray-400 hover:text-white text-2xl"
						on:click={closeColorPicker}
						aria-label="Close settings"
					>
						×
					</button>
				</div>

				<!-- Tier Name -->
				<div class="mb-6">
					<label for="tier-name-input" class="block text-sm font-medium text-gray-300 mb-2">Tier Name</label>
					<input 
						id="tier-name-input"
						class="w-full border border-gray-600 bg-gray-700 rounded-lg px-4 py-3 text-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
						type="text"
						bind:value={currentTier.name}
						placeholder="Enter tier name..."
					/>
				</div>

				<!-- Color Grid -->
				<div class="mb-6">
					<div class="block text-sm font-medium text-gray-300 mb-3">Choose Color</div>
					<div class="grid grid-cols-5 gap-3 mb-4">
						{#each tierColors as color}
							<button 
								class="w-12 h-12 rounded-lg border-2 transition-colors {currentTier.color === color ? 'border-white' : 'border-gray-600 hover:border-white'}"
								style="background-color: {color};"
								on:click={() => colorPickerTierId && updateTierColor(colorPickerTierId, color)}
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>

					<!-- Custom Color Input -->
					<div class="space-y-3">
						<label for="custom-color-input" class="block text-sm font-medium text-gray-300">Custom Color</label>
						<input 
							id="custom-color-input"
							type="color"
							class="w-full h-12 rounded-lg border border-gray-600 bg-gray-700"
							bind:value={currentTier.color}
							on:change={(e) => {
								const target = e.target as HTMLInputElement;
								if (target && colorPickerTierId) {
									updateTierColor(colorPickerTierId, target.value);
								}
							}}
						/>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="space-y-3">
					{#if tierList.tiers.length > 1}
						<button 
							class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
							on:click={() => {
								if (colorPickerTierId) {
									removeTier(colorPickerTierId);
									closeColorPicker();
								}
							}}
						>
							Delete Tier
						</button>
					{/if}
					<button 
						class="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition-colors"
						on:click={closeColorPicker}
					>
						Done
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

<!-- Item Editor Modal -->
	{#if showItemEditor && editingItem}
		<div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
			<div class="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
				<!-- Header -->
				<div class="flex items-center justify-between mb-6">
					<h3 class="text-xl font-bold text-white">Edit Item</h3>
					<button 
						class="text-2xl text-gray-400 hover:text-white transition-colors"
						on:click={closeItemEditor}
						aria-label="Close item editor"
					>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>

				<!-- Item Content -->
				<div class="space-y-4">
					<!-- Text Input -->
					<div>
						<label for="item-text-input" class="block text-sm font-medium text-gray-300 mb-2">Item Text</label>
						<input
							id="item-text-input"
							class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
							type="text"
							bind:value={editingItem.text}
							placeholder="Enter item text..."
						/>
					</div>

					<!-- Image Preview -->
					{#if editingItem.image}
						<div>
							<div class="block text-sm font-medium text-gray-300 mb-2">Current Image</div>
							<div class="flex items-center space-x-4">
								<img src={editingItem.image} alt={editingItem.text} class="w-16 h-16 object-cover rounded" />
								<button 
									class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
									on:click={() => {
										if (editingItem) {
											editingItem.image = undefined;
											editingItem = editingItem;
										}
									}}
								>
									Remove Image
								</button>
							</div>
						</div>
					{/if}

					<!-- Image Upload -->
					<div>
						<div class="block text-sm font-medium text-gray-300 mb-2">
							{editingItem.image ? 'Replace Image' : 'Add Image'}
						</div>
						<label class="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-600 p-4 transition-colors hover:border-orange-400">
							<span class="material-symbols-outlined text-2xl text-gray-400 mb-2">upload</span>
							<div class="text-sm font-medium text-gray-300">Click to upload image</div>
							<input 
								type="file" 
								accept="image/*" 
								class="hidden" 
								on:change={(e) => {
									const target = e.target as HTMLInputElement;
									const file = target.files?.[0];
									if (file && file.type.startsWith('image/') && editingItem) {
										const imageUrl = URL.createObjectURL(file);
										editingItem.image = imageUrl;
										editingItem = editingItem;
									}
								}}
							/>
						</label>
					</div>

					<!-- Move to Tier -->
					<div>
						<label for="tier-select" class="block text-sm font-medium text-gray-300 mb-2">Move to Tier</label>
						<select 
							id="tier-select"
							class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
							on:change={(e) => {
								const target = e.target as HTMLSelectElement;
								if (editingItem) {
									moveItemToTier(editingItem.id, target.value || null);
								}
							}}
						>
							<option value="">Unassigned</option>
							{#each tierList.tiers as tier (tier.id)}
								<option value={tier.id}>{tier.name}</option>
							{/each}
						</select>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="flex space-x-3 mt-6">
					<button 
						class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
						on:click={() => {
							if (editingItem) {
								deleteItem(editingItem.id);
							}
						}}
					>
						Delete Item
					</button>
					<button 
						class="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition-colors"
						on:click={updateItem}
					>
						Save Changes
					</button>
				</div>
			</div>
		</div>
	{/if}