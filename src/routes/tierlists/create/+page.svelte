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
		size?: { width: number; height: number };
		naturalSize?: { width: number; height: number };
	}

	interface Tier {
		id: string;
		name: string;
		color: string;
		items: TierItem[];
	}

	interface itemPlacement {
		item_id: string;
		tier_position: number;
		position?: { x: number; y: number };
		size?: { width: number; height: number };
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
	let searchPage = 1;
	let hasMoreResults = true;
	let loadingMore = false;
	let scrollLoadTimeout: any;

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

	// Responsive layout state
	let windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
	let windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

	// Dynamic mode resize state
	let isResizing = false;
	let resizingItemId: string | null = null;

	/** Converts a dynamic tier list to classic */
	function convertDynamicToClassic() {
		// Gather all items from unassigned and all tiers
		const allItems: TierItem[] = [
			...tierList.unassignedItems,
			...tierList.tiers.flatMap((tier) => tier.items)
		];

		// Clear all items from tiers and unassigned
		tierList.tiers = tierList.tiers.map((tier) => ({ ...tier, items: [] }));
		tierList.unassignedItems = [];

		// Assign items to tiers based on y position
		const nTiers = tierList.tiers.length;
		for (const item of allItems) {
			let assigned = false;
			if (item.position && typeof item.position.y === 'number' && nTiers > 0) {
				const tierIndex = Math.floor(item.position.y * nTiers);
				if (tierIndex >= 0 && tierIndex < nTiers) {
					// Remove position/size for classic mode
					const { position, size, ...rest } = item;
					tierList.tiers[tierIndex].items.push(rest);
					assigned = true;
				}
			}
			if (!assigned) {
				const { position, size, ...rest } = item;
				tierList.unassignedItems.push(rest);
			}
		}
		tierList.type = 'classic';
	}

	let resizeStartX = 0;
	let resizeStartY = 0;
	let resizeStartWidth = 0;
	let resizeStartHeight = 0;

	// Color definitions for tiers
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

	// Utility Functions

	// Dims a hex color by a given factor for better background contrast
	function dimColor(color: string, factor: number = 0.7): string {
		const hex = color.replace('#', '');
		const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
		const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
		const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	// Calculates optimal grid layout for tier items based on height and wrapping
	function getTierItemsStyle(itemCount: number): {
		gridStyle: string;
		itemHeight: string;
		itemWidth: string;
		margin: string;
	} {
		if (itemCount === 0)
			return { gridStyle: '', itemHeight: '8rem', itemWidth: '8rem', margin: '0' };

		// Calculate available height per tier dynamically
		const totalTiers = tierList.tiers.length;
		const topBarHeight = 80;
		const availableScreenHeight = windowHeight;
		const tierContainerHeight = Math.max(
			120,
			Math.floor((availableScreenHeight - topBarHeight) / totalTiers) - 32
		);

		const gap = 16;
		const margin = 8;

		// Available width
		const availableWidth = windowWidth - 320 - 64;

		// Try full height first
		let itemHeight = Math.max(80, tierContainerHeight - gap * 2);
		let itemWidth = itemHeight; // square □

		// Calculate how many full-height square items can fit in one row
		const itemsPerRowFullHeight = Math.floor((availableWidth + gap) / (itemWidth + gap));

		// Check if all items fit in one row at full height
		if (itemCount <= itemsPerRowFullHeight) {
			return {
				gridStyle: `grid-template-columns: repeat(${itemCount}, ${itemWidth}px); height: ${tierContainerHeight}px;`,
				itemHeight: `${itemHeight}px`,
				itemWidth: `${itemWidth}px`,
				margin: '0'
			};
		} else {
			const maxRows = 2;
			const halfHeight = Math.max(
				40,
				Math.floor((tierContainerHeight - gap * (maxRows - 1)) / maxRows) - margin
			);
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
		const unassignedItem = tierList.unassignedItems.find((i) => i.id === itemId);
		if (unassignedItem) return { item: unassignedItem, tier: null };

		// Check in tiers
		for (const tier of tierList.tiers) {
			const item = tier.items.find((i) => i.id === itemId);
			if (item) return { item, tier };
		}

		return null;
	}

	// Updates item properties across all tiers and unassigned items
	function updateItemEverywhere(itemId: string, updates: Partial<TierItem>) {
		tierList.tiers = tierList.tiers.map((tier) => ({
			...tier,
			items: tier.items.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
		}));

		tierList.unassignedItems = tierList.unassignedItems.map((item) =>
			item.id === itemId ? { ...item, ...updates } : item
		);
	}

	// Removes item from all locations
	function removeItemEverywhere(itemId: string) {
		tierList.tiers = tierList.tiers.map((tier) => ({
			...tier,
			items: tier.items.filter((item) => item.id !== itemId)
		}));
		tierList.unassignedItems = tierList.unassignedItems.filter((item) => item.id !== itemId);
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
			const tierToRemove = tierList.tiers.find((t) => t.id === tierId);
			if (tierToRemove) {
				tierList.unassignedItems = [...tierList.unassignedItems, ...tierToRemove.items];
				tierList.tiers = tierList.tiers.filter((t) => t.id !== tierId);
			}
		}
	}

	function updateTierColor(tierId: string, color: string) {
		tierList.tiers = tierList.tiers.map((tier) => (tier.id === tierId ? { ...tier, color } : tier));
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

	function openAddItemModal(
		tierId: string | null = null,
		position: number | null = null,
		event?: MouseEvent
	) {
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
		clearTimeout(scrollLoadTimeout);
		searchQuery = '';
		searchResults = [];
		searchPage = 1;
		hasMoreResults = true;
		loadingMore = false;
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
			tierList.tiers = tierList.tiers.map((tier) =>
				tier.id === targetTierId ? { ...tier, items: [...tier.items, found.item] } : tier
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
			tierList.tiers = tierList.tiers.map((tier) => {
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

		const tierWithItem = tierList.tiers.find((tier) => tier.items.some((i) => i.id === item.id));
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

	// Creates initial position for dynamic mode items
	function createItemPosition(tierId?: string): { x: number; y: number } | undefined {
		if (tierList.type !== 'dynamic') return undefined;

		if (tierId) {
			const tierIndex = tierList.tiers.findIndex((t) => t.id === tierId);
			if (tierIndex !== -1) {
				return {
					x: 0.1 + Math.random() * 0.8,
					y: (tierIndex + 0.2 + Math.random() * 0.6) / tierList.tiers.length
				};
			}
		}

		return {
			x: 0.1 + Math.random() * 0.8,
			y: targetPosition ?? 0.3 + Math.random() * 0.4
		};
	}

	// Adds item to appropriate location (tier or unassigned)
	function addItemToLocation(item: TierItem) {
		if (targetTierId) {
			tierList.tiers = tierList.tiers.map((tier) =>
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

		// Load natural image size for dynamic mode
		if (tierList.type === 'dynamic') {
			loadImageNaturalSize(newItem);
		}

		addItemToLocation(newItem);
		closeAddItemModal();
	}

	// Search Functionality

	async function searchImages(reset = true) {
		if (!searchQuery.trim()) return;

		console.log('searchImages called', {
			reset,
			searchQuery,
			searchPage,
			hasMoreResults,
			loadingMore,
			searching
		});

		if (reset) {
			searching = true;
			searchResults = [];
			searchPage = 1;
			hasMoreResults = true;
		} else {
			loadingMore = true;
		}

		try {
			// Calculate proper start index for pagination
			const startIndex = reset ? 1 : searchPage * 10 + 1;
			console.log('Searching with startIndex:', startIndex);

			const results = await searchGoogleImages(searchQuery, 10, startIndex);
			console.log('Search results received:', results.length);

			const newResults = results.map((result) => ({
				url: result.image?.thumbnailLink || result.link,
				fullUrl: result.link,
				title: result.title,
				snippet: result.snippet,
				id: `${searchQuery}-${startIndex}-${result.title}` // Unique ID to prevent duplicates
			}));

			if (reset) {
				searchResults = newResults;
				searchPage = 1;
			} else {
				// Filter out any potential duplicates based on URL
				const existingUrls = new Set(searchResults.map((r) => r.url));
				const uniqueNewResults = newResults.filter((r) => !existingUrls.has(r.url));
				console.log('Adding unique results:', uniqueNewResults.length, 'out of', newResults.length);
				searchResults = [...searchResults, ...uniqueNewResults];
				searchPage++;
			}

			// With proper API pagination, we have more results if we got the full amount requested
			hasMoreResults = newResults.length === 10;
			console.log(
				'hasMoreResults:',
				hasMoreResults,
				'newResults.length:',
				newResults.length,
				'searchResults.length:',
				searchResults.length
			);
		} catch (err) {
			console.error('Search error:', err);
			// Fallback results for development with pagination simulation
			const fallbackStartIndex = reset ? 0 : searchResults.length;
			const fallbackResults = Array.from({ length: 6 }, (_, i) => ({
				url: `https://picsum.photos/seed/fallback-${searchQuery}-${fallbackStartIndex + i + 1}/150/100`,
				fullUrl: `https://picsum.photos/seed/fallback-${searchQuery}-${fallbackStartIndex + i + 1}/300/200`,
				title: `${searchQuery} ${fallbackStartIndex + i + 1}`,
				snippet: 'Fallback result',
				id: `fallback-${searchQuery}-${fallbackStartIndex + i + 1}`
			}));

			if (reset) {
				searchResults = fallbackResults;
				searchPage = 1;
			} else {
				searchResults = [...searchResults, ...fallbackResults];
				searchPage++;
			}

			hasMoreResults = true; // Keep fallback working
		} finally {
			searching = false;
			loadingMore = false;
		}
	}

	async function loadMoreImages() {
		console.log('loadMoreImages called', {
			loadingMore,
			hasMoreResults,
			searchQuery: searchQuery.trim(),
			searchResultsLength: searchResults.length
		});
		if (!loadingMore && hasMoreResults && searchQuery.trim()) {
			console.log('Loading more images...');
			await searchImages(false);
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
				...tierList.tiers.flatMap((tier) => tier.items)
			];

			if (allItems.length === 0) {
				error = 'Please add at least 1 item';
				return;
			}

			const tierListData = {
				title: tierList.title,
				list_type: tierList.type, // Use actual type instead of hardcoded 'classic'
				tiers: tierList.tiers.map((tier, index) => ({
					name: tier.name,
					position: index / tierList.tiers.length
				})),
				items: allItems // Send full item objects instead of just text
			};

			const createdTierList = await apiClient.createTierList(tierListData);

			// After creating the tier list, save item placements
			const itemPlacements: itemPlacement[] = [];

			tierList.tiers.forEach((tier, tierIndex) => {
				tier.items.forEach((item) => {
					const placement: any = {
						item_id: item.id,
						tier_position: tierIndex
					};

					// For dynamic mode, include position and size
					if (tierList.type === 'dynamic') {
						if (item.position) {
							placement.position = item.position;
						}
						if (item.size) {
							placement.size = item.size;
						}
					}

					itemPlacements.push(placement);
				});
			});

			// Save placements if there are any
			if (itemPlacements.length > 0) {
				await apiClient.updateTierListPlacements(createdTierList.id, {
					item_placements: itemPlacements
				});
			}

			window.location.href = '/tierlists';
		} catch (err) {
			error = 'Failed to create tier list';
			console.error('Error creating tier list:', err);
		} finally {
			creating = false;
		}
	}

	/** Generates dynamic gradient background based on tier colors */
	function getDynamicGradient(): string {
		if (tierList.tiers.length <= 1)
			return 'background: linear-gradient(to bottom, #2d7a2d, #7a2d2d);';

		const colors = tierList.tiers.map((tier) => dimColor(tier.color, 0.6));
		const gradientStops = colors
			.map((color, index) => `${color} ${(index / (colors.length - 1)) * 100}%`)
			.join(', ');

		return `background: linear-gradient(to bottom, ${gradientStops});`;
	}

	function startResize(
		event: MouseEvent,
		itemId: string,
		currentWidth: number,
		currentHeight: number
	) {
		if (tierList.type !== 'dynamic') return;

		event.stopPropagation();
		event.preventDefault();

		isResizing = true;
		resizingItemId = itemId;
		resizeStartX = event.clientX;
		resizeStartY = event.clientY;
		resizeStartWidth = currentWidth;
		resizeStartHeight = currentHeight;

		document.addEventListener('mousemove', handleResize);
		document.addEventListener('mouseup', stopResize);
	}

	function handleResize(event: MouseEvent) {
		if (!isResizing || !resizingItemId) return;

		const deltaX = event.clientX - resizeStartX;
		const deltaY = event.clientY - resizeStartY;

		// Calculate new size (maintaining minimum size)
		const newWidth = Math.max(50, resizeStartWidth + deltaX);
		const newHeight = Math.max(50, resizeStartHeight + deltaY);

		// Update item size
		updateItemEverywhere(resizingItemId, {
			size: { width: newWidth, height: newHeight }
		});
	}

	function stopResize() {
		isResizing = false;
		resizingItemId = null;
		document.removeEventListener('mousemove', handleResize);
		document.removeEventListener('mouseup', stopResize);
	}

	function getItemSize(item: TierItem): { width: number; height: number } {
		if (item.size) {
			return item.size;
		}

		// Default sizes based on content type
		if (item.image && item.naturalSize) {
			// Use natural image size, scaled to reasonable default
			const scale = Math.min(200 / item.naturalSize.width, 200 / item.naturalSize.height, 1);
			return {
				width: item.naturalSize.width * scale,
				height: item.naturalSize.height * scale
			};
		} else if (item.image) {
			// Default square for images without natural size
			return { width: 128, height: 128 };
		} else {
			// Text items - calculate based on content length
			const textLength = item.text.length;
			const minWidth = 80;
			const charWidth = 8;
			const padding = 24;
			return {
				width: Math.max(minWidth, Math.min(textLength * charWidth + padding, 300)),
				height: 40
			};
		}
	}

	function getTextStyle(item: TierItem): string {
		if (!item.size || item.image) return '';

		// Calculate font size based on container size for text items
		const { width, height } = item.size;
		const minFontSize = 10;
		const maxFontSize = 32;

		// More responsive font size calculation
		// Base size on the smaller dimension to ensure text fits well
		const textLength = item.text.length;
		const avgCharWidth = 0.6; // Average character width ratio to font size

		// Calculate font size that would fit the text width-wise
		const maxFontForWidth = (width * 0.9) / (textLength * avgCharWidth);
		// Calculate font size that would fit height-wise (allow for some padding)
		const maxFontForHeight = height * 0.4;

		// Use the smaller of the two, bounded by min/max
		const optimalFontSize = Math.min(maxFontForWidth, maxFontForHeight);
		const fontSize = Math.max(minFontSize, Math.min(maxFontSize, optimalFontSize));

		return `font-size: ${Math.round(fontSize)}px; line-height: ${Math.round(fontSize * 1.2)}px;`;
	}

	function loadImageNaturalSize(item: TierItem) {
		if (!item.image) return;

		const img = new Image();
		img.onload = () => {
			updateItemEverywhere(item.id, {
				naturalSize: { width: img.naturalWidth, height: img.naturalHeight }
			});
		};
		img.src = item.image;
	}

	// Lifecycle

	onMount(() => {
		// Prevent page scrolling when editing
		document.body.style.overflow = 'hidden';

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
			document.body.style.overflow = 'auto';
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', handleResize);
			}
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
			<div class="items-center space-x-2 pl-10">
				{#if editingTitle}
					<input
						class="border-b-2 border-orange-500 bg-transparent px-2 py-1 text-2xl font-bold text-white outline-none"
						bind:value={tierList.title}
						on:blur={toggleTitleEdit}
						on:keydown={(e) => e.key === 'Enter' && toggleTitleEdit()}
					/>
				{:else}
					<button
						class="cursor-pointer border-none bg-transparent p-0 text-2xl font-bold transition-colors hover:text-orange-400"
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
					on:click={() => {
						if (tierList.type === 'dynamic') {
							convertDynamicToClassic();
						} else {
							tierList.type = 'classic';
						}
					}}
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
	<div class="flex flex-1 flex-col">
		{#if tierList.type === 'classic'}
			<!-- Classic Mode -->
			<div class="flex flex-1 flex-col">
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				{#each tierList.tiers as tier, index (tier.id)}
					<div
						class="relative flex flex-1 transition-all duration-300"
						style="background-color: {dimColor(tier.color, 0.6)};"
					>
						<!-- Tier Items Area -->
						<div
							class="relative flex-1 cursor-pointer p-6 transition-colors"
							on:click={(e) => openAddItemModal(tier.id, null, e)}
							on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openAddItemModal(tier.id)}
							role="button"
							tabindex="0"
						>
							<!-- Tier Controls -->
							<div
								class="group absolute top-0 right-0 flex h-full w-64 items-center justify-end pr-8"
							>
								<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
									<!-- Tier Title -->
									<input
										class="cursor-text border-none bg-transparent text-right text-4xl font-bold placeholder-gray-300 outline-none"
										style="color: {tier.color};"
										bind:value={tier.name}
										placeholder="Tier"
										on:click|stopPropagation
									/>

									<!-- Hover Controls -->
									<div
										class="flex flex-row justify-end space-x-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
									>
										{#each [{ icon: 'add', action: () => openAddItemModal(tier.id), title: 'Add item' }, { icon: 'settings', action: () => openColorPicker(tier.id), title: 'Settings' }, { icon: 'keyboard_arrow_down', action: () => addTierAtPosition(index + 1), title: 'Add tier below' }, { icon: 'keyboard_arrow_up', action: () => addTierAtPosition(index), title: 'Add tier above' }] as control}
											<button
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-black"
												style="color: {tier.color};"
												on:click|stopPropagation={control.action}
												title={control.title}
											>
												<span class="material-symbols-outlined text-lg">{control.icon}</span>
											</button>
										{/each}
										{#if tierList.tiers.length > 1}
											<button
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-black"
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
								{@const itemsStyle = getTierItemsStyle(tier.items.length)}
								<div class="grid items-center gap-4 pr-80" style={itemsStyle.gridStyle}>
									{#each tier.items as item, itemIndex (item.id)}
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div
											class="group/item relative cursor-pointer overflow-hidden rounded-lg shadow-sm transition-shadow hover:shadow-lg {isDragging &&
											draggedItem?.id === item.id
												? 'opacity-50'
												: ''}"
											style="{item.image
												? `background-image: url('${item.image}'); background-size: cover; background-position: center;`
												: 'background: linear-gradient(135deg, #1f2937, #374151);'} height: {itemsStyle.itemHeight}; width: {itemsStyle.itemWidth}; margin: {itemsStyle.margin};"
											draggable="true"
											on:dragstart={(e) => handleDragStart(e, item)}
											on:dragend={handleDragEnd}
											on:dragover={(e) => handleDragOver(e, tier.id, itemIndex)}
											on:drop={(e) => handleDrop(e, tier.id, itemIndex)}
											on:click|stopPropagation={() => startInlineEdit(item)}
											on:keydown={(e) =>
												(e.key === 'Enter' || e.key === ' ') && startInlineEdit(item)}
											on:contextmenu={(e) => showItemContextMenu(item, e)}
											role="button"
											tabindex="0"
											aria-label="Edit item {item.text}"
										>
											<!-- Gradient overlay -->
											{#if item.image}
												<div
													class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
												></div>
											{/if}

											<!-- Delete button -->
											<button
												class="absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-red-600"
												on:click|stopPropagation={() => deleteItem(item.id)}
												title="Delete item"
											>
												<span class="material-symbols-outlined text-sm">close</span>
											</button>

											{#if editingItemId === item.id}
												<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
													<input
														id="inline-edit-{item.id}"
														class="w-full rounded border border-white/30 bg-black/50 px-2 py-1 text-center text-sm font-medium text-white outline-none"
														bind:value={inlineEditText}
														on:blur={finishInlineEdit}
														on:keydown={(e) => {
															if (e.key === 'Enter') finishInlineEdit();
															if (e.key === 'Escape') cancelInlineEdit();
														}}
													/>
												</div>
											{:else}
												<!-- Text positioning - center for text-only items, bottom-left for image items -->
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
											{/if}

											<!-- Drop zone indicator -->
											{#if isDragging && dragOverTier === tier.id && dragOverPosition === itemIndex}
												<div
													class="absolute top-0 bottom-0 -left-1 w-1 rounded bg-orange-500"
												></div>
											{/if}
										</div>
									{/each}

									<!-- Drop zone at end of tier -->
									{#if isDragging}
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div
											class="flex min-h-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-400 opacity-50 transition-colors hover:border-orange-400"
											on:dragover={(e) => handleDragOver(e, tier.id, tier.items.length)}
											on:drop={(e) => handleDrop(e, tier.id, tier.items.length)}
										>
											<span class="text-sm text-gray-400">Drop here</span>
										</div>
									{/if}
								</div>
							{:else}
								<!-- svelte-ignore a11y-no-static-element-interactions -->
								<div
									class="flex h-full items-center justify-center pr-80 text-center {isDragging
										? 'rounded-lg border-2 border-dashed border-gray-400'
										: ''}"
									on:dragover={(e) => handleDragOver(e, tier.id, 0)}
									on:drop={(e) => handleDrop(e, tier.id, 0)}
								>
									<div class="text-white">
										<div class="mb-2 text-3xl opacity-40">+</div>
										<div class="text-lg opacity-60">
											{isDragging ? 'Drop item here' : 'Click to add items'}
										</div>
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
				<div
					class="dynamic-canvas relative flex-1 cursor-crosshair overflow-hidden"
					style={getDynamicGradient()}
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
							class="pointer-events-none absolute right-0 left-0 transition-all"
							style="top: {tierTop}%; height: {tierHeight}%;"
						>
							<!-- Tier Controls -->
							<div
								class="group pointer-events-auto absolute top-0 right-0 flex h-full w-64 items-center justify-end pr-8"
							>
								<div class="flex flex-col items-end space-y-3" style="color: {tier.color};">
									<input
										class="cursor-text border-none bg-transparent text-right text-4xl font-bold placeholder-gray-300 outline-none"
										style="color: {tier.color};"
										bind:value={tier.name}
										placeholder="Tier"
										on:click|stopPropagation
									/>

									<div
										class="flex flex-row justify-end space-x-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
									>
										{#each [{ icon: 'add', action: () => openAddItemModal(tier.id), title: 'Add item' }, { icon: 'settings', action: () => openColorPicker(tier.id), title: 'Settings' }, { icon: 'keyboard_arrow_down', action: () => addTierAtPosition(index + 1), title: 'Add tier below' }, { icon: 'keyboard_arrow_up', action: () => addTierAtPosition(index), title: 'Add tier above' }] as control}
											<button
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-black"
												style="color: {tier.color};"
												on:click|stopPropagation={control.action}
												title={control.title}
											>
												<span class="material-symbols-outlined text-lg">{control.icon}</span>
											</button>
										{/each}
										{#if tierList.tiers.length > 1}
											<button
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-black"
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
					{#each [...tierList.unassignedItems, ...tierList.tiers.flatMap( (tier, tierIndex) => tier.items.map( (item) => ({ ...item, _defaultY: (tierIndex + 0.5) / tierList.tiers.length }) ) )] as item, i (item.id)}
						{@const x = item.position?.x ?? 0.1 + (i % 8) * 0.1}
						{@const y = item.position?.y ?? (item as any)._defaultY ?? 0.5}
						{@const isEditing = editingItemId === item.id}
						{@const isDragged = isDragging && draggedItem?.id === item.id}
						{@const itemSize = getItemSize(item)}

						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div
							class="group/item absolute -translate-x-1/2 -translate-y-1/2 transform cursor-pointer overflow-hidden rounded-lg shadow-lg transition-all hover:shadow-xl {isDragged
								? 'opacity-50'
								: ''}"
							style="left: {x * 100}%; top: {y *
								100}%; width: {itemSize.width}px; height: {itemSize.height}px; {item.image
								? `background-image: url('${item.image}'); background-size: cover; background-position: center;`
								: item.type === 'text'
									? 'background: linear-gradient(135deg, #374151, #4b5563); display: flex; align-items: center; justify-content: center;'
									: 'background: linear-gradient(135deg, #1f2937, #374151);'}"
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
							<!-- Gradient overlay for images -->
							{#if item.image}
								<div
									class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
								></div>
							{/if}

							<!-- Delete button -->
							<button
								class="absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-red-600"
								on:click|stopPropagation={() => deleteItem(item.id)}
								title="Delete item"
							>
								<span class="material-symbols-outlined text-sm">close</span>
							</button>

							<!-- Resize handle -->
							<div
								class="absolute right-0 bottom-0 z-20 h-4 w-4 cursor-se-resize bg-white/20 opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-white/40"
								style="clip-path: polygon(100% 0%, 0% 100%, 100% 100%);"
								on:mousedown={(e) => startResize(e, item.id, itemSize.width, itemSize.height)}
								title="Resize"
							></div>

							{#if isEditing}
								<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
									<input
										id="inline-edit-{item.id}"
										class="w-full rounded border border-white/30 bg-black/50 px-2 py-1 text-center text-sm font-medium text-white outline-none"
										bind:value={inlineEditText}
										on:blur={finishInlineEdit}
										on:keydown={(e) => {
											if (e.key === 'Enter') finishInlineEdit();
											if (e.key === 'Escape') cancelInlineEdit();
										}}
									/>
								</div>
							{:else if item.type === 'text' && !item.image}
								<!-- Text items - centered text with responsive sizing -->
								<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
									<div
										class="text-center text-sm leading-tight font-medium text-white"
										style={getTextStyle(item)}
									>
										{item.text}
									</div>
								</div>
							{:else}
								<!-- Image items - text in bottom right -->
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

					{#if tierList.unassignedItems.length === 0 && tierList.tiers.every((t) => t.items.length === 0)}
						<div
							class="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
						>
							<div class="bg-opacity-30 rounded-lg bg-black p-6 text-center">
								<div class="mb-2 text-3xl opacity-60">+</div>
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
			class="fixed z-50 min-w-48 rounded-lg border border-gray-600 bg-gray-800 py-2 shadow-lg"
			style="left: {contextMenuX}px; top: {contextMenuY}px;"
		>
			<!-- Main Actions -->
			{#each [{ icon: 'edit', text: 'Edit Text', action: () => contextMenuItem && startInlineEdit(contextMenuItem) }, { icon: 'image', text: contextMenuItem?.image ? 'Change Image' : 'Add Image', action: () => {
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
						} }] as menuItem}
				<button
					class="flex w-full items-center space-x-2 px-4 py-2 text-left text-white transition-colors hover:bg-gray-700"
					on:click={menuItem.action}
				>
					<span class="material-symbols-outlined text-sm">{menuItem.icon}</span>
					<span>{menuItem.text}</span>
				</button>
			{/each}

			<div class="my-1 border-t border-gray-600"></div>

			<!-- Move to Tier -->
			<div class="px-4 py-1 text-xs text-gray-400">Move to:</div>
			{#each [{ id: null, name: 'Unassigned', color: '#fff' }, ...tierList.tiers] as tier}
				<button
					class="w-full px-4 py-2 text-left text-white transition-colors hover:bg-gray-700"
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

			<div class="my-1 border-t border-gray-600"></div>

			<!-- Delete -->
			<button
				class="flex w-full items-center space-x-2 px-4 py-2 text-left text-red-400 transition-colors hover:bg-gray-700"
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
		class="fixed z-50 w-80 rounded-lg border border-gray-600 bg-gray-800 shadow-2xl"
		style="left: {addItemModalX}px; top: {addItemModalY}px;"
	>
		<!-- Main search/text input area -->
		<div class="p-4">
			<div class="relative">
				{#if addItemType === 'search'}
					<input
						id="quick-add-input"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 pr-12 text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none {searching
							? 'border-blue-500/50 bg-blue-900/20'
							: ''}"
						type="text"
						bind:value={searchQuery}
						placeholder={searching ? 'Searching...' : 'Search images...'}
						disabled={searching}
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								searchImages(true);
							}
						}}
						on:input={() => {
							// Auto-search as user types when in search mode
							if (searchQuery.trim().length > 2) {
								// Debounce search
								clearTimeout(searchTimeout);
								searchTimeout = setTimeout(() => {
									console.log('Auto-searching for:', searchQuery); // Debug log
									searchImages(true);
								}, 300); // Reduced delay for better responsiveness
							} else if (searchQuery.trim().length === 0) {
								// Clear results when search is cleared
								searchResults = [];
								hasMoreResults = true;
								searchPage = 1;
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
					class="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 transform items-center justify-center rounded-md transition-colors {addItemType ===
					'search'
						? 'hover:bg-opacity-20 text-blue-400 hover:bg-blue-500'
						: 'hover:bg-opacity-20 text-orange-400 hover:bg-orange-500'}"
					on:click={() => {
						if (addItemType === 'search') {
							searchImages(true);
						} else {
							addTextItem();
						}
					}}
					title={addItemType === 'search' ? 'Search' : 'Add Item'}
					disabled={searching}
				>
					{#if searching && addItemType === 'search'}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
						></div>
					{:else}
						<span class="material-symbols-outlined text-lg">
							{addItemType === 'search' ? 'search' : 'add'}
						</span>
					{/if}
				</button>
			</div>

			<!-- Quick add button for text -->
			{#if addItemType === 'text' && newItemText.trim()}
				<button
					class="mt-3 w-full rounded-lg bg-orange-500 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-600"
					on:click={addTextItem}
				>
					Add "{newItemText.trim()}"
				</button>
			{/if}
		</div>

		<!-- Search Results -->
		{#if addItemType === 'search' && (searchResults.length > 0 || searching)}
			<div class="border-t border-gray-600 p-4">
				<div class="mb-3 flex items-center justify-between">
					<div class="text-sm text-gray-400">Search Results</div>
					{#if searching}
						<div class="flex items-center space-x-2 text-blue-400">
							<div
								class="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
							></div>
							<span class="text-xs">Searching...</span>
						</div>
					{:else if loadingMore}
						<div class="flex items-center space-x-2 text-blue-400">
							<div
								class="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"
							></div>
							<span class="text-xs">Loading more...</span>
						</div>
					{:else if searchResults.length > 0}
						<div class="text-xs text-gray-500">{searchResults.length} results</div>
					{/if}
				</div>
				<div
					class="max-h-80 overflow-y-auto"
					on:scroll={(e) => {
						const target = e.currentTarget as HTMLElement;
						if (
							target &&
							!loadingMore &&
							hasMoreResults &&
							searchResults.length > 0 &&
							searchQuery.trim()
						) {
							// More sensitive scroll detection - trigger when 100px from bottom
							const scrollThreshold = 100;
							const isNearBottom =
								target.scrollTop + target.clientHeight >= target.scrollHeight - scrollThreshold;

							console.log('Scroll event:', {
								scrollTop: target.scrollTop,
								clientHeight: target.clientHeight,
								scrollHeight: target.scrollHeight,
								isNearBottom,
								loadingMore,
								hasMoreResults,
								searchResultsLength: searchResults.length
							});

							if (isNearBottom) {
								console.log('Triggering load more images...');
								loadMoreImages();
							}
						}
					}}
				>
					<div
						class="grid gap-2"
						style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));"
					>
						{#each searchResults as result}
							<button
								class="group overflow-hidden rounded-lg border border-gray-600 transition-colors hover:border-orange-400 hover:bg-gray-700"
								on:click={() => addSearchResult(result)}
								title={result.title}
							>
								<div class="relative aspect-square">
									<img
										src={result.url}
										alt={result.title}
										class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
										loading="lazy"
									/>
									<div
										class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
									></div>
								</div>
								<div class="p-2">
									<div class="truncate text-xs leading-tight text-gray-300">{result.title}</div>
								</div>
							</button>
						{/each}

						<!-- Skeleton loading for initial search -->
						{#if searching && searchResults.length === 0}
							{#each Array(10) as _, i}
								<div
									class="animate-pulse overflow-hidden rounded-lg border border-gray-600"
									style="animation-delay: {i * 0.1}s"
								>
									<div class="aspect-square bg-gray-700"></div>
									<div class="p-2">
										<div
											class="mb-1 h-3 rounded bg-gray-700"
											style="width: {60 + Math.random() * 30}%"
										></div>
										<div
											class="h-2 rounded bg-gray-600"
											style="width: {40 + Math.random() * 40}%"
										></div>
									</div>
								</div>
							{/each}
						{/if}

						<!-- Load more skeleton loading -->
						{#if loadingMore && searchResults.length > 0}
							{#each Array(6) as _, i}
								<div
									class="animate-pulse overflow-hidden rounded-lg border border-gray-600"
									style="animation-delay: {i * 0.1}s"
								>
									<div class="aspect-square bg-gray-700"></div>
									<div class="p-2">
										<div
											class="mb-1 h-3 rounded bg-gray-700"
											style="width: {60 + Math.random() * 30}%"
										></div>
										<div
											class="h-2 rounded bg-gray-600"
											style="width: {40 + Math.random() * 40}%"
										></div>
									</div>
								</div>
							{/each}
						{/if}
					</div>

					<!-- Load more button (fallback) -->
					{#if searchResults.length > 0 && hasMoreResults && !loadingMore}
						<div class="mt-4 text-center">
							<button
								class="rounded-lg bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
								on:click={loadMoreImages}
							>
								Load More Images
							</button>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Loading indicator for search -->
		{#if addItemType === 'search' && searching}
			<div class="border-t border-gray-600 p-4 text-center">
				<div class="inline-flex items-center space-x-2 text-gray-400">
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-orange-500"
					></div>
					<span class="text-sm">Searching...</span>
				</div>
			</div>
		{/if}

		<!-- Footer with mode toggle and upload -->
		<div class="flex items-center justify-between border-t border-gray-600 p-3">
			<!-- Mode toggles -->
			<div class="flex items-center space-x-2">
				{#each [{ type: 'text' as const, icon: 'text_fields', title: 'Text Mode' }, { type: 'search' as const, icon: 'search', title: 'Search Mode' }] as mode}
					<button
						class="flex h-8 w-8 items-center justify-center rounded-md transition-colors {addItemType ===
						mode.type
							? 'bg-orange-500 text-white'
							: 'text-gray-400 hover:bg-gray-700 hover:text-white'}"
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
					class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
					title="Upload Image"
				>
					<span class="material-symbols-outlined text-sm">upload</span>
					<input type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
				</label>
			</div>

			<!-- Close button -->
			<button
				class="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
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
	{@const currentTier = tierList.tiers.find((t) => t.id === colorPickerTierId)}
	{#if currentTier}
		<div class="bg-opacity-75 fixed inset-0 z-50 flex items-center justify-center bg-black">
			<div class="w-full max-w-md rounded-lg border border-gray-600 bg-gray-800 p-6">
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-xl font-bold text-white">Tier Settings</h2>
					<button
						class="text-2xl text-gray-400 hover:text-white"
						on:click={closeColorPicker}
						aria-label="Close settings"
					>
						×
					</button>
				</div>

				<!-- Tier Name -->
				<div class="mb-6">
					<label for="tier-name-input" class="mb-2 block text-sm font-medium text-gray-300"
						>Tier Name</label
					>
					<input
						id="tier-name-input"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
						type="text"
						bind:value={currentTier.name}
						placeholder="Enter tier name..."
					/>
				</div>

				<!-- Color Grid -->
				<div class="mb-6">
					<div class="mb-3 block text-sm font-medium text-gray-300">Choose Color</div>
					<div class="mb-4 grid grid-cols-5 gap-3">
						{#each tierColors as color}
							<button
								class="h-12 w-12 rounded-lg border-2 transition-colors {currentTier.color === color
									? 'border-white'
									: 'border-gray-600 hover:border-white'}"
								style="background-color: {color};"
								on:click={() => colorPickerTierId && updateTierColor(colorPickerTierId, color)}
								aria-label="Select color {color}"
							></button>
						{/each}
					</div>

					<!-- Custom Color Input -->
					<div class="space-y-3">
						<label for="custom-color-input" class="block text-sm font-medium text-gray-300"
							>Custom Color</label
						>
						<input
							id="custom-color-input"
							type="color"
							class="h-12 w-full rounded-lg border border-gray-600 bg-gray-700"
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
							class="w-full rounded bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
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
						class="w-full rounded bg-orange-500 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-600"
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
	<div class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6 shadow-xl">
			<!-- Header -->
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-xl font-bold text-white">Edit Item</h3>
				<button
					class="text-2xl text-gray-400 transition-colors hover:text-white"
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
					<label for="item-text-input" class="mb-2 block text-sm font-medium text-gray-300"
						>Item Text</label
					>
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
						<div class="mb-2 block text-sm font-medium text-gray-300">Current Image</div>
						<div class="flex items-center space-x-4">
							<img
								src={editingItem.image}
								alt={editingItem.text}
								class="h-16 w-16 rounded object-cover"
							/>
							<button
								class="rounded bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700"
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
					<div class="mb-2 block text-sm font-medium text-gray-300">
						{editingItem.image ? 'Replace Image' : 'Add Image'}
					</div>
					<label
						class="flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-gray-600 p-4 transition-colors hover:border-orange-400"
					>
						<span class="material-symbols-outlined mb-2 text-2xl text-gray-400">upload</span>
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
					<label for="tier-select" class="mb-2 block text-sm font-medium text-gray-300"
						>Move to Tier</label
					>
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
			<div class="mt-6 flex space-x-3">
				<button
					class="flex-1 rounded bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
					on:click={() => {
						if (editingItem) {
							deleteItem(editingItem.id);
						}
					}}
				>
					Delete Item
				</button>
				<button
					class="flex-1 rounded bg-orange-500 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-600"
					on:click={updateItem}
				>
					Save Changes
				</button>
			</div>
		</div>
	</div>
{/if}
