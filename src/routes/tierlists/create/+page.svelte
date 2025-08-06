<script lang="ts">
	import { apiClient, type TierItem } from '$lib/api';
	import {
		saveTierlistToFirestore,
		getTierlistsFromFirestore,
		getTierlist
	} from '$lib/firestore-polls-tierlists.js';
	import { getAuth } from 'firebase/auth';
	import { searchForImages } from '$lib/google-images';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { fade, scale } from 'svelte/transition';
	import { currentUser, signInWithGoogle, userGroup } from '$lib/stores';
	import { hasProAccessStore } from '$lib';
	import { getUserProfile } from '$lib/user-profile';
	import type { UserProfile } from '$lib/user-profile';
	import { addToast } from '$lib/toast';
	import Toast from '$lib/../components/toast.svelte';
	import { createAutosaver, getDrafts, deleteDraft, type TierListDraft } from '$lib/draft-autosave';

	// Represents a tier/category in the tier list
	interface Tier {
		id: string;
		name: string;
		color: string;
		items: TierItem[];
	}

	// Placement info for saving tier list state
	interface itemPlacement {
		item_id: string;
		tier_position: number;
		position?: { x: number; y: number };
		size?: { width: number; height: number };
	}

	// Key for storing local tier lists in browser storage
	const LOCAL_STORAGE_TIERLISTS_KEY = 'standpoint_local_tierlists';

	// Main tier list state object
	interface TierList {
		title: string;
		type: 'classic' | 'dynamic';
		bannerImage: string;
		isForked: boolean;
		originalId: string;
		unassignedItems: TierItem[];
		tiers: Tier[];
	}

	let tierList: TierList = {
		title: 'Untitled Tier List',
		type: 'classic',
		bannerImage: '',
		isForked: false,
		originalId: '',
		unassignedItems: [],
		tiers: [
			{ id: 's', name: 'S', color: '#ff7f7f', items: [] },
			{ id: 'a', name: 'A', color: '#ffbf7f', items: [] },
			{ id: 'b', name: 'B', color: '#ffff7f', items: [] },
			{ id: 'c', name: 'C', color: '#bfff7f', items: [] }
		]
	};

	// Autosave functionality
	let draftId: string = crypto.randomUUID();
	let autosaveCleanup: (() => void) | null = null;
	let lastSaveIndicator = '';

	// Modal and UI state
	let showAddItemModal = false;
	let addItemModalX = 0;
	let addItemModalY = 0;
	let addItemType: 'text' | 'upload' | 'search' = 'text';
	let error = '';
	let creating = false;
	let editingTitle = false;
	let lastFetchedTitle = '';

	// Animation helpers
	function randomDelay(i: number) {
		return 80 + (i % 5) * 40;
	}

	// Pro user check
	$: isProUser = $hasProAccessStore;

	// User profile and AI settings
	let userProfile: UserProfile | null = null;
	let aiEnabled = true; // Default to enabled until we load the user's preference

	// Gemini suggestion system state
	let suggestedItems: any[] = [];
	let usedSuggestedItems: string[] = [];
	let lastGeminiTitle: string = '';
	let fetchingSuggestions = false;
	let prefetchedImages: Record<string, string> = {};

	// Track highlighted suggestion/image for keyboard nav
	let highlightedAISuggestionIdx = -1;
	let highlightedImageIdx = -1;
	$: if (highlightedAISuggestionIdx >= filteredAISuggestions.length)
		highlightedAISuggestionIdx = filteredAISuggestions.length - 1;
	$: if (highlightedAISuggestionIdx < -1) highlightedAISuggestionIdx = -1;
	$: if (highlightedImageIdx >= searchResults.length)
		highlightedImageIdx = searchResults.length - 1;
	$: if (highlightedImageIdx < -1) highlightedImageIdx = -1;

	// Filtered AI suggestions based on input
	$: filteredAISuggestions = (() => {
		// First filter out items without valid names to prevent undefined key errors
		const validSuggestions = suggestedItems.filter(
			(s) => s && s.name && typeof s.name === 'string' && s.name.trim()
		);
		if (!newItemText.trim()) return validSuggestions;
		return validSuggestions.filter((s) =>
			s.name.toLowerCase().includes(newItemText.trim().toLowerCase())
		);
	})();

	// Gemini debug modal state
	let showGeminiDebugModal = false;
	let lastGeminiPrompt = '';
	let lastGeminiRawResponse = '';

	// Handle item type changes - clean up inconsistent data
	$: if (editingItem) {
		// If changing to text type, remove image
		if (editingItem.type === 'text' && editingItem.image) {
			editingItem.image = undefined;
		}
		// If changing from text to image/search but no image, provide placeholder
		if (editingItem.type !== 'text' && !editingItem.image) {
			// Keep the current state, user can add image separately
		}
	}

	// Item management state
	let targetTierId: string | null = null;
	let targetPosition: number | null = null;
	let newItemText = '';
	let editingItemId: string | null = null;
	let inlineEditText = '';

	// Add item logic (prevents duplicates in dynamic/classic)
	function addItem(text: string) {
		if (!text.trim()) return;
		// Prevent duplicate by text or id
		const exists =
			tierList.unassignedItems.some((i) => i.text === text) ||
			tierList.tiers.some((tier) => tier.items.some((i) => i.text === text));
		if (exists) return;
		const newItem: TierItem = { id: crypto.randomUUID(), text, type: 'text' };
		if (tierList.type === 'dynamic') {
			tierList.unassignedItems.push(newItem);
		} else {
			// Classic: add to first tier by default
			if (tierList.tiers.length > 0) tierList.tiers[0].items.push(newItem);
		}
		newItemText = '';
	}

	// Delete item logic with fallback (no backend)
	function deleteItemEverywhere(itemId: string) {
		// Remove from unassigned
		tierList.unassignedItems = tierList.unassignedItems.filter((i) => i.id !== itemId);
		// Remove from all tiers
		tierList.tiers = tierList.tiers.map((tier) => ({
			...tier,
			items: tier.items.filter((i) => i.id !== itemId)
		}));
		// Fallback: update localStorage if present
		const localTierlists = localStorage.getItem(LOCAL_STORAGE_TIERLISTS_KEY);
		if (localTierlists) {
			const tierlists = JSON.parse(localTierlists);
			for (const t of tierlists) {
				if (t.unassignedItems)
					t.unassignedItems = t.unassignedItems.filter((i: any) => i.id !== itemId);
				if (t.tiers)
					t.tiers = t.tiers.map((tier: any) => ({
						...tier,
						items: (tier.items || []).filter((i: any) => i.id !== itemId)
					}));
			}
			localStorage.setItem(LOCAL_STORAGE_TIERLISTS_KEY, JSON.stringify(tierlists));
		}
	}

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

	function convertDynamicToClassic() {
		const allItems: TierItem[] = [
			...tierList.unassignedItems,
			...tierList.tiers.flatMap((tier: { items: TierItem[] }) => tier.items)
		];

		tierList.tiers = tierList.tiers.map(
			(tier: { items: TierItem[]; id: string; name: string; color: string }) => ({
				...tier,
				items: []
			})
		);
		tierList.unassignedItems = [];

		const nTiers = tierList.tiers.length;
		for (const item of allItems) {
			let assigned = false;
			if (item.position && typeof item.position.y === 'number' && nTiers > 0) {
				const tierIndex = Math.floor(item.position.y * nTiers);
				if (tierIndex >= 0 && tierIndex < nTiers) {
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

	function dimColor(color: string, factor: number = 0.7): string {
		const hex = color.replace('#', '');
		const r = Math.round(parseInt(hex.substr(0, 2), 16) * factor);
		const g = Math.round(parseInt(hex.substr(2, 2), 16) * factor);
		const b = Math.round(parseInt(hex.substr(4, 2), 16) * factor);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	function getTierItemsStyle(itemCount: number): {
		gridStyle: string;
		itemHeight: string;
		itemWidth: string;
		margin: string;
	} {
		if (itemCount === 0)
			return { gridStyle: '', itemHeight: '8rem', itemWidth: '8rem', margin: '0' };

		const totalTiers = tierList.tiers.length;
		const topBarHeight = 80;
		const availableScreenHeight = windowHeight;
		const tierContainerHeight = Math.max(
			120,
			Math.floor((availableScreenHeight - topBarHeight) / totalTiers) - 32
		);

		const gap = 16;
		const margin = 8;

		const availableWidth = windowWidth - 320 - 64;

		let itemHeight = Math.max(80, tierContainerHeight - gap * 2);
		let itemWidth = itemHeight;

		const itemsPerRowFullHeight = Math.floor((availableWidth + gap) / (itemWidth + gap));

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

			const itemsPerRowHalfHeight = Math.floor((availableWidth + gap) / (halfItemWidth + gap));

			return {
				gridStyle: `grid-template-columns: repeat(${itemsPerRowHalfHeight}, ${halfItemWidth}px); height: ${tierContainerHeight}px;`,
				itemHeight: `${halfHeight}px`,
				itemWidth: `${halfItemWidth}px`,
				margin: `${margin}px`
			};
		}
	}

	function focusInput(selector: string, delay: number = 10) {
		setTimeout(() => {
			const input = document.querySelector(selector) as HTMLInputElement;
			if (input) {
				input.focus();
				input.select();
			}
		}, delay);
	}

	function findItem(itemId: string): { item: TierItem; tier: Tier | null } | null {
		const unassignedItem = tierList.unassignedItems.find((i: TierItem) => i.id === itemId);
		if (unassignedItem) return { item: unassignedItem, tier: null };

		for (const tier of tierList.tiers) {
			const item = tier.items.find((i: TierItem) => i.id === itemId);
			if (item) return { item, tier };
		}

		return null;
	}

	function updateItemEverywhere(itemId: string, updates: Partial<TierItem>) {
		tierList.tiers = tierList.tiers.map((tier: Tier) => ({
			...tier,
			items: tier.items.map((item: TierItem) =>
				item.id === itemId ? { ...item, ...updates } : item
			)
		}));

		tierList.unassignedItems = tierList.unassignedItems.map((item: TierItem) =>
			item.id === itemId ? { ...item, ...updates } : item
		);
	}

	async function fetchGeminiSuggestions(title: string, usedItems: string[] = []) {
		// Check if user is pro and has AI enabled before fetching suggestions
		if (!isProUser || !aiEnabled) {
			suggestedItems = [];
			return;
		}

		fetchingSuggestions = true;
		try {
			const prompt = buildGeminiPrompt(title, usedItems, 30);
			lastGeminiPrompt = prompt;
			const res = await fetch('/api/gemini/tierlist-suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title,
					used_items: usedItems,
					n: 30
				})
			});
			const data = await res.json();
			lastGeminiRawResponse = data.raw ?? data.raw_response ?? data.error ?? JSON.stringify(data);
			if (data.items) {
				const usedSet = new Set(usedItems.map((i) => i.toLowerCase()));
				suggestedItems = data.items.filter((item: any) => !usedSet.has(item.name.toLowerCase()));
				await prefetchImagesForSuggestions(suggestedItems);
			} else {
				suggestedItems = [];
			}
			lastGeminiTitle = title;
			lastFetchedTitle = title;
		} catch (err) {
			console.error('Failed to fetch Gemini suggestions:', err);
			lastGeminiRawResponse = String(err);
			suggestedItems = [];
		} finally {
			fetchingSuggestions = false;
		}
	}

	function buildGeminiPrompt(title: string, usedItems: string[], n: number) {
		const used =
			usedItems && usedItems.length > 0
				? `\nAlready suggested/used items (do not repeat): ${usedItems.join(', ')}`
				: '';
		return (
			`I'm creating a tier list titled "${title}".${used}\n` +
			`1. Suggest ${n} items that would be appropriate for this tier list.\n` +
			'2. For each item, indicate if an image would be appropriate (true/false).\n' +
			'3. If images are appropriate, suggest a short search query for finding a representative image.\n' +
			'Respond ONLY in JSON:\n' +
			'{\n' +
			'  "items": [\n' +
			'    { "name": "...", "image": true/false, "image_query": "..." }\n' +
			'  ]\n' +
			'}\n' +
			'You MUST respond with only the JSON object and nothing else. Do not add any explanation, code block, or extra text.'
		);
	}

	async function prefetchImagesForSuggestions(suggestions: any[]) {
		const promises = suggestions
			.filter((s) => s.image && s.image_query && !prefetchedImages[s.name])
			.map(async (s) => {
				try {
					const results = await searchForImages(s.image_query);
					if (Array.isArray(results) && results.length > 0) {
						prefetchedImages[s.name] = results[0].url ?? '';
					}
				} catch (e) {
					console.warn('Image prefetch failed for', s.name, e);
				}
			});
		await Promise.all(promises);
	}

	function addSuggestedItem(suggestion: any) {
		const newItem: TierItem = {
			id: `item_${crypto.randomUUID()}`,
			text: suggestion.name,
			type: suggestion.image ? 'search' : 'text',
			image: prefetchedImages[suggestion.name],
			position: createItemPosition(targetTierId || undefined)
		};
		addItemToLocation(newItem);
		usedSuggestedItems = [...usedSuggestedItems, suggestion.name];
		suggestedItems = suggestedItems.filter((item) => item.name !== suggestion.name);

		const urlParams = new URLSearchParams(window.location.search);
		const isForked = urlParams.get('forked') === 'true' || urlParams.get('fork') !== null;

		if (!isForked && suggestedItems.length < 10) {
			const allUsed = [
				...usedSuggestedItems,
				...tierList.tiers.flatMap((t) => t.items.map((i) => i.text)),
				...tierList.unassignedItems.map((i) => i.text)
			];
			fetchGeminiSuggestions(tierList.title, allUsed);
		}
		closeAddItemModal();
	}

	function handleTitleSet() {
		const urlParams = new URLSearchParams(window.location.search);
		const isForked = urlParams.get('forked') === 'true' || urlParams.get('fork') !== null;

		if (
			!isForked &&
			tierList.title &&
			tierList.title !== lastGeminiTitle &&
			tierList.title !== 'Untitled Tier List'
		) {
			const allUsed = [
				...usedSuggestedItems,
				...tierList.tiers.flatMap((t) => t.items.map((i) => i.text)),
				...tierList.unassignedItems.map((i) => i.text)
			];
			fetchGeminiSuggestions(tierList.title, allUsed);
		}
	}

	function removeItemEverywhere(itemId: string) {
		tierList.tiers = tierList.tiers.map((tier) => ({
			...tier,
			items: tier.items.filter((item) => item.id !== itemId)
		}));
		tierList.unassignedItems = tierList.unassignedItems.filter((item) => item.id !== itemId);
	}

	// Draft Management

	function loadDraftById(id: string) {
		const draft = getDrafts().find((d) => d.id === id);
		if (draft) {
			tierList.title = draft.title;
			tierList.type = draft.type;
			tierList.bannerImage = draft.bannerImage || '';
			tierList.tiers = draft.tiers;
			tierList.unassignedItems = draft.unassignedItems;
			draftId = draft.id; // Use the same draft ID to continue saving
			addToast('Draft loaded successfully', 'success');
		} else {
			addToast('Draft not found', 'error');
		}
	}

	function loadForkedData() {
		try {
			const forkDataString = localStorage.getItem('standpoint_fork_data');
			if (forkDataString) {
				const forkData = JSON.parse(forkDataString);

				// Keep the original title instead of prefixing with "Fork of"
				tierList.title = forkData.sourceTitle;

				// Store original ID for reference
				const originalId = forkData.sourceId;

				// Load all items as AI suggestions instead of directly into tierlist
				suggestedItems = forkData.items
					.filter(
						(item: TierItem) =>
							item && item.text && typeof item.text === 'string' && item.text.trim()
					)
					.map((item: TierItem) => ({
						name: item.text,
						image: item.image,
						category: 'Forked Item'
					}));

				// Clear the fork data from localStorage
				localStorage.removeItem('standpoint_fork_data');

				// Mark this as a fork for when saving
				tierList.isForked = true;
				tierList.originalId = originalId;

				addToast(`Loaded ${suggestedItems.length} items from tierlist`, 'success');
			}
		} catch (error) {
			console.error('Error loading forked data:', error);
			addToast('Failed to load forked data', 'error');
		}
	}

	async function loadTierlistForFork(tierlistId: string) {
		try {
			const tierlist = await getTierlist(tierlistId);
			if (tierlist) {
				// Set title as "Fork of [original title]"
				tierList.title = `Fork of ${tierlist.title}`;

				// Copy banner image if it exists
				if (tierlist.banner_image) {
					tierList.bannerImage = tierlist.banner_image;
				}

				// Load all items as AI suggestions, avoiding duplicates
				const tierItems = tierlist.tiers
					? tierlist.tiers.flatMap((tier: any) => tier.items || [])
					: [];
				const unassignedItems = (tierlist as any).unassignedItems || [];

				// Create a Set to track unique items by text
				const uniqueItems = new Map();

				// Add tier items first
				tierItems.forEach((item: any) => {
					if (item && item.text && typeof item.text === 'string' && item.text.trim()) {
						uniqueItems.set(item.text.trim().toLowerCase(), {
							name: item.text,
							image: item.image,
							category: 'Forked Item'
						});
					}
				});

				// Add unassigned items only if they're not already included
				unassignedItems.forEach((item: any) => {
					if (item && item.text && typeof item.text === 'string' && item.text.trim()) {
						const key = item.text.trim().toLowerCase();
						if (!uniqueItems.has(key)) {
							uniqueItems.set(key, {
								name: item.text,
								image: item.image,
								category: 'Forked Item'
							});
						}
					}
				});

				suggestedItems = Array.from(uniqueItems.values());

				addToast(`Loaded ${suggestedItems.length} items from forked tierlist`, 'success');
			}
		} catch (error) {
			console.error('Error loading tierlist for fork:', error);
			addToast('Failed to load tierlist for forking', 'error');
		}
	}

	// Tier Management

	function toggleTitleEdit() {
		editingTitle = !editingTitle;
	}

	function addTier() {
		const newTier: Tier = {
			id: `tier_${crypto.randomUUID()}`,
			name: `Tier ${tierList.tiers.length + 1}`,
			color: tierColors[tierList.tiers.length % tierColors.length],
			items: []
		};
		tierList.tiers = [...tierList.tiers, newTier];
	}

	function addTierAtPosition(position: number) {
		const newTier: Tier = {
			id: `tier_${crypto.randomUUID()}`,
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
		event?: MouseEvent | KeyboardEvent
	) {
		targetTierId = tierId;
		targetPosition = position;

		const modalWidth = 350;
		const modalHeight = 400; // Approximate modal height
		const margin = 16;

		if (event) {
			// Calculate optimal position based on click location (only for mouse events)
			if ('clientX' in event && 'clientY' in event) {
				let x = event.clientX + 10;
				let y = event.clientY - 50;

				// Check if modal would go off the right edge
				if (x + modalWidth + margin > window.innerWidth) {
					x = event.clientX - modalWidth - 10; // Position to the left of cursor
				}

				// Check if modal would go off the bottom edge
				if (y + modalHeight + margin > window.innerHeight) {
					y = Math.max(window.innerHeight - modalHeight - margin, margin);
				}

				// Ensure modal doesn't go off the top or left edges
				addItemModalX = Math.max(x, margin);
				addItemModalY = Math.max(y, margin);
			} else {
				// For keyboard events, use default center position
				addItemModalX = window.innerWidth / 2 - modalWidth / 2;
				addItemModalY = window.innerHeight / 2 - modalHeight / 2;
			}
		} else {
			// Center the modal when no event is provided
			addItemModalX = Math.max((window.innerWidth - modalWidth) / 2, margin);
			addItemModalY = Math.max((window.innerHeight - modalHeight) / 2, margin);
		}

		showAddItemModal = true;
		addItemType = 'text';
		searchQuery = '';
		newItemText = '';
		highlightedAISuggestionIdx = -1;
		highlightedImageIdx = -1;

		const allUsed = [
			...usedSuggestedItems,
			...tierList.tiers.flatMap((t) => t.items.map((i) => i.text)),
			...tierList.unassignedItems.map((i) => i.text)
		];
		// Only fetch Gemini suggestions if not forking and title has changed
		const urlParams = new URLSearchParams(window.location.search);
		const isForked = urlParams.get('forked') === 'true' || urlParams.get('fork') !== null;
		if (
			!isForked &&
			tierList.title !== lastGeminiTitle &&
			tierList.title !== 'Untitled Tier List'
		) {
			fetchGeminiSuggestions(tierList.title, allUsed);
		}

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

		removeItemEverywhere(itemId);

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

		removeItemEverywhere(itemId);

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

		const tierWithItem = tierList.tiers.find((tier: { items: TierItem[] }) =>
			tier.items.some((i: TierItem) => i.id === item.id)
		);
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

		if (tierList.type === 'classic' && tierId !== null && position !== undefined) {
			moveItemToPosition(draggedItem.id, tierId, position);
		} else if (tierId !== null) {
			moveItemToTier(draggedItem.id, tierId);
		}

		isDragging = false;
		draggedItem = null;
		draggedFromTier = null;
		dragOverTier = null;
		dragOverPosition = null;
	}

	// Item Creation

	function createItemPosition(tierId?: string): { x: number; y: number } | undefined {
		if (tierList.type !== 'dynamic') return undefined;

		if (tierId) {
			const tierIndex = tierList.tiers.findIndex((t: Tier) => t.id === tierId);
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
			id: `item_${crypto.randomUUID()}`,
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
		try {
			const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
			const storage = getStorage();
			const fileRef = ref(storage, `tierlist-items/${Date.now()}_${file.name}`);
			await uploadBytes(fileRef, file);
			const url = await getDownloadURL(fileRef);
			const newItem: TierItem = {
				id: `item_${crypto.randomUUID()}`,
				text: file.name,
				image: url,
				type: 'image',
				position: createItemPosition(targetTierId || undefined)
			};
			addItemToLocation(newItem);
			closeAddItemModal();
		} catch (err) {
			addToast('Image upload failed. Please try again.', 'error');
		}
	}
	async function handlePasteImage(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) {
					try {
						const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
						const storage = getStorage();
						const fileRef = ref(storage, `tierlist-items/${Date.now()}_${file.name}`);
						await uploadBytes(fileRef, file);
						const url = await getDownloadURL(fileRef);
						const newItem: TierItem = {
							id: `item_${crypto.randomUUID()}`,
							text: file.name,
							image: url,
							type: 'image',
							position: createItemPosition(targetTierId || undefined)
						};
						addItemToLocation(newItem);
						closeAddItemModal();
					} catch (err) {
						addToast('Image paste upload failed. Please try again.', 'error');
					}
				}
			}
		}
	}

	function addSearchResult(result: { url: string; title: string; snippet?: string }) {
		const newItem: TierItem = {
			id: `item_${crypto.randomUUID()}`,
			text: searchQuery.trim() || result.title,
			image: result.url,
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

		if (reset) {
			searching = true;
			searchResults = [];
			searchPage = 1;
			hasMoreResults = true;
		} else {
			loadingMore = true;
		}

		try {
			const results = await searchForImages(searchQuery);
			let newResults: { url: string; title: string; snippet?: string }[] = [];
			if (Array.isArray(results)) {
				newResults = results.map((result) => ({
					url: result.url,
					fullUrl: result.url,
					title: result.title,
					snippet: result.snippet,
					id: `${searchQuery}-${searchPage}-${result.title}`
				}));
			}
			if (reset) {
				searchResults = newResults;
				searchPage = 1;
			} else {
				const existingUrls = new Set(searchResults.map((r) => r.url));
				const uniqueNewResults = newResults.filter((r) => !existingUrls.has(r.url));
				searchResults = [...searchResults, ...uniqueNewResults];
				searchPage++;
			}
			hasMoreResults = newResults.length > 0;
		} catch (err) {
			console.error('Search error:', err);
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
		} finally {
			searching = false;
			loadingMore = false;
		}
	}

	async function loadMoreImages() {
		if (!loadingMore && hasMoreResults && searchQuery.trim()) {
			await searchImages(false);
		}
	}

	// Save Functionality

	import { get } from 'svelte/store';

	async function saveTierList() {
		try {
			creating = true;
			error = '';

			if (!tierList.title.trim()) {
				error = 'Please provide a title';
				return;
			}

			// Collect all items from unassigned and tiers, but deduplicate by id
			const itemMap = new Map();
			// Add tier items first
			for (const tier of tierList.tiers) {
				for (const item of tier.items) {
					if (item && item.id) {
						itemMap.set(item.id, item);
					}
				}
			}
			// Add unassigned items only if not already present
			for (const item of tierList.unassignedItems) {
				if (item && item.id && !itemMap.has(item.id)) {
					itemMap.set(item.id, item);
				}
			}
			const allItems = Array.from(itemMap.values());

			if (allItems.length === 0) {
				error = 'Please add at least 1 item';
				return;
			}

			const auth = getAuth();
			const ownerId = auth.currentUser ? auth.currentUser.uid : null;
			// Build placements array
			const placements = tierList.tiers.flatMap((tier: { items: TierItem[] }, tierIdx: number) =>
				tier.items.map((item: TierItem, itemIdx: number) => ({
					item_id: item.id,
					tier_position: tierIdx,
					...(item.position && { position: item.position }),
					...(item.size && { size: item.size })
				}))
			);
			const tierListData = {
				title: tierList.title,
				list_type: tierList.type,
				...(tierList.bannerImage && { banner_image: tierList.bannerImage }),
				tiers: tierList.tiers.map((tier: Tier, index: number) => ({
					name: tier.name,
					position: index / tierList.tiers.length,
					color: tier.color
				})),
				items: allItems.map((item) => ({
					id: item.id,
					text: item.text || item.name || '',
					name: item.text || item.name || '',
					...(item.url && { url: item.url }),
					...(item.image && { image: item.image }),
					...(item.type && { type: item.type }),
					...(item.position && { position: item.position }),
					...(item.size && { size: item.size })
				})),
				item_placements: placements,
				owner: ownerId,
				likes: 0,
				forks: 0,
				comments: 0
			};
			let newTierlistId;
			if (auth.currentUser) {
				newTierlistId = await saveTierlistToFirestore(tierListData);
				const localTierlists = localStorage.getItem(LOCAL_STORAGE_TIERLISTS_KEY);
				if (localTierlists) {
					const tierlistsArr = JSON.parse(localTierlists);
					for (const localTierlist of tierlistsArr) {
						if (!localTierlist.owner) {
							await saveTierlistToFirestore({ ...localTierlist, owner: ownerId });
						}
					}
					localStorage.removeItem(LOCAL_STORAGE_TIERLISTS_KEY);
				}
			} else {
				const localTierlists = localStorage.getItem(LOCAL_STORAGE_TIERLISTS_KEY);
				const tierlistsArr = localTierlists ? JSON.parse(localTierlists) : [];
				newTierlistId = Date.now().toString();
				tierlistsArr.push({ id: newTierlistId, ...tierListData });
				localStorage.setItem(LOCAL_STORAGE_TIERLISTS_KEY, JSON.stringify(tierlistsArr));
			}
			goto(`/tierlists/${newTierlistId}`);
		} catch (err) {
			console.error('Error creating tier list:', err);
			if (err instanceof Error) {
				error = `Failed to create tier list: ${err.message}`;
			} else {
				error = 'Failed to create tier list. Please try again.';
			}
			addToast('Failed to create tier list', 'error');
		} finally {
			creating = false;
		}
	}

	function getDynamicGradient(): string {
		if (tierList.tiers.length <= 1)
			return 'background: linear-gradient(to bottom, #2d7a2d, #7a2d2d);';

		const colors = tierList.tiers.map((tier: { color: string }) => dimColor(tier.color, 0.6));
		const gradientStops = colors
			.map((color: string, index: number) => `${color} ${(index / (colors.length - 1)) * 100}%`)
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

		const newWidth = Math.max(50, resizeStartWidth + deltaX);
		const newHeight = Math.max(50, resizeStartHeight + deltaY);

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

		if (item.image && item.naturalSize) {
			const scale = Math.min(200 / item.naturalSize.width, 200 / item.naturalSize.height, 1);
			return {
				width: item.naturalSize.width * scale,
				height: item.naturalSize.height * scale
			};
		} else if (item.image) {
			return { width: 128, height: 128 };
		} else {
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

		const { width, height } = item.size;
		const minFontSize = 10;
		const maxFontSize = 32;

		const textLength = item.text.length;
		const avgCharWidth = 0.6;

		const maxFontForWidth = (width * 0.9) / (textLength * avgCharWidth);
		const maxFontForHeight = height * 0.4;

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
		document.body.style.overflow = 'hidden';

		const handleResize = () => {
			if (typeof window !== 'undefined') {
				windowWidth = window.innerWidth;
				windowHeight = window.innerHeight;
			}
		};

		if (typeof window !== 'undefined') {
			window.addEventListener('resize', handleResize);

			// Load user profile and AI settings
			if ($currentUser) {
				getUserProfile($currentUser.uid)
					.then((profile) => {
						if (profile) {
							userProfile = profile;
							aiEnabled = profile.enableAI ?? true;
						}
					})
					.catch((error) => {
						console.error('Error loading user profile:', error);
						aiEnabled = true; 
					});
			}

			// Check for draft parameter in URL
			const urlParams = new URLSearchParams(window.location.search);
			const draftId = urlParams.get('draft');
			const isForked = urlParams.get('forked');
			const forkId = urlParams.get('fork');

			if (draftId) {
				loadDraftById(draftId);
			} else if (isForked === 'true') {
				// Load forked data as suggestions
				loadForkedData();
			} else if (forkId) {
				// Handle direct fork by ID
				loadTierlistForFork(forkId);
			}
		}

		// Setup autosave
		autosaveCleanup = createAutosaver(
			() => ({
				id: draftId,
				title: tierList.title,
				type: tierList.type,
				bannerImage: tierList.bannerImage,
				tiers: tierList.tiers,
				unassignedItems: tierList.unassignedItems,
				lastSaved: Date.now()
			}),
			() => tierList.title.trim() !== 'Untitled Tier List' && tierList.title.trim().length > 0
		);

		return () => {
			document.body.style.overflow = 'auto';
			if (typeof window !== 'undefined') {
				window.removeEventListener('resize', handleResize);
			}
			if (autosaveCleanup) {
				autosaveCleanup();
			}
		};
	});
</script>

<svelte:head>
	<title
		>{tierList.title ? `${tierList.title} - Standpoint` : 'Create Tier List - Standpoint'}</title
	>
</svelte:head>
<div class="fixed inset-0 flex flex-col bg-black text-white">
	<!-- Banner-->
	{#if tierList.bannerImage}
		<div
			class="pointer-events-none absolute inset-0 z-0"
			style="background: url('{tierList.bannerImage}') center/cover no-repeat; filter: blur(12px) brightness(0.5);"
		></div>
	{/if}
	<!-- Header -->
	<div
		class="relative z-10 flex min-h-[56px] items-center justify-between border-b border-gray-700 bg-black/80 px-6 py-4"
		in:fade={{ duration: 400 }}
		out:fade={{ duration: 200 }}
	>
		<div class="flex w-full items-center gap-4">
			<!-- Title, banner upload, sign-in -->
			<div class="flex items-center gap-2 pl-10">
				{#if editingTitle}
					<input
						class="border-b-2 border-orange-500 bg-transparent px-2 py-1 text-2xl font-bold text-white outline-none"
						bind:value={tierList.title}
						on:blur={() => {
							toggleTitleEdit();
							handleTitleSet();
						}}
						on:keydown={(e) => {
							if (e.key === 'Enter') {
								toggleTitleEdit();
								handleTitleSet();
							}
						}}
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
				<!-- Banner upload button -->
				<label
					class="ml-4 flex cursor-pointer items-center gap-2 bg-gray-800 px-2 py-1 transition-colors hover:bg-gray-700"
					title="Upload banner image"
				>
					<span class="material-symbols-outlined text-lg text-orange-400">image</span>
					<span class="text-xs text-gray-300">Banner</span>
					<input
						type="file"
						accept="image/*"
						class="hidden"
						on:change={async (e) => {
							const input = e.target as HTMLInputElement;
							const file = input.files?.[0];
							if (!file) return;
							try {
								const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
								const storage = getStorage();
								const storageRef = ref(storage, `tierlist-banners/${Date.now()}_${file.name}`);
								await uploadBytes(storageRef, file);
								const url = await getDownloadURL(storageRef);
								tierList.bannerImage = url;
							} catch (err) {
								console.error('Banner upload failed:', err);
								addToast('Banner upload failed. Please try again.', 'error');
							}
						}}
					/>
				</label>
				{#if tierList.bannerImage}
					<div class="relative ml-2 h-12 w-24 overflow-hidden shadow">
						<img
							src={tierList.bannerImage}
							alt="Banner Preview"
							class="absolute inset-0 h-full w-full object-cover"
							style="filter: brightness(0.7) blur(2px);"
						/>
					</div>
				{/if}
				{#if !$currentUser}
					<button
						class="ml-4 flex items-center gap-2 border border-gray-300 bg-white px-4 py-2 shadow transition-colors hover:bg-gray-100"
						on:click={signInWithGoogle}
					>
						<img
							src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
							alt="Google"
							class="h-5 w-5"
						/>
						<span>Sign in with Google</span>
					</button>
				{/if}
			</div>
			<!-- Suggestions, mode toggle, POST button -->
			<div class="flex flex-1 items-center justify-end gap-4">
				{#if aiEnabled}
					{#if fetchingSuggestions}
						<span class="ml-4 animate-pulse text-xs text-blue-400" in:fade={{ duration: 300 }}>
							Fetching suggestions...
						</span>
					{:else if suggestedItems.length === 0 && tierList.title}
						{#if tierList.title === 'Untitled Tier List'}
							<span class="ml-4 cursor-pointer text-xs text-white" in:fade={{ duration: 300 }}>
								Change the title to view AI suggestions
							</span>
						{:else}
							<button
								type="button"
								class="ml-4 cursor-pointer border-0 bg-transparent p-0 text-xs text-orange-400"
								on:click={() => (showGeminiDebugModal = true)}
								in:fade={{ duration: 300 }}>No suggestions found</button
							>
						{/if}
					{:else if suggestedItems.length > 0}
						<span class="ml-4 text-xs text-green-400" in:fade={{ duration: 300 }}>
							Suggestions ready
						</span>
					{/if}
				{/if}
				<!-- Draft autosave indicator -->
				{#if tierList.title.trim() !== 'Untitled Tier List' && tierList.title.trim().length > 0}
					<span class="ml-4 text-xs text-blue-400" title="Draft automatically saved">
						💾 Auto-saved
					</span>
				{/if}
				<!-- Mode Toggle -->
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
				{#if $currentUser}
					<button
						class="bg-orange-500 px-6 py-2 font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
						on:click={saveTierList}
						disabled={creating}
					>
						{creating ? 'PUBLISHING...' : 'PUBLISH'}
					</button>
				{:else}
					<button
						class="bg-gray-600 px-6 py-2 font-bold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
						on:click={saveTierList}
						disabled={creating}
						title="Creates a local tier list - sign in to publish publicly"
					>
						{creating ? 'CREATING...' : 'CREATE LOCALLY'}
					</button>
				{/if}
			</div>
		</div>
	</div>
	{#if error}
		<div class="mx-6 mt-4 border border-red-700 bg-red-900 px-4 py-3 text-red-200">
			{error}
		</div>
	{/if}

	{#if !$currentUser}
		<div class="mx-6 mt-4 border border-blue-700 bg-blue-900 px-4 py-3 text-blue-200">
			<div class="flex items-center gap-2">
				<span class="material-symbols-outlined text-lg">info</span>
				<span>
					You can create tier lists without signing in, but they'll only be saved locally on your
					device.
					<strong>Sign in to publish and share your creations publicly!</strong>
				</span>
			</div>
		</div>
	{/if}
	<!-- Main Tier List Display -->
	<div class="flex min-h-0 w-full flex-1 flex-col">
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
							on:keydown={(e) =>
								(e.key === 'Enter' || e.key === ' ') && openAddItemModal(tier.id, null, e)}
							role="button"
							tabindex="0"
						>
							<!-- Tier Controls -->
							<div
								class="group absolute top-0 right-4 z-20 flex h-full w-64 items-center justify-end"
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
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center transition-colors hover:bg-black"
												style="color: {tier.color};"
												on:click|stopPropagation={control.action}
												title={control.title}
											>
												<span class="material-symbols-outlined text-lg">{control.icon}</span>
											</button>
										{/each}
										{#if tierList.tiers.length > 1}
											<button
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center transition-colors hover:bg-black"
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

							<!-- Drop zones -->
							{#if true}
								{@const itemsStyle = getTierItemsStyle(tier.items.length)}
								<div
									class="relative"
									style="height: {itemsStyle.itemHeight}; min-height: {itemsStyle.itemHeight};"
								>
									<div
										class="flex items-center gap-4 pr-80"
										style="height: {itemsStyle.itemHeight}; min-height: {itemsStyle.itemHeight};"
									>
										{#if tier.items.length === 0}
											{#if isDragging}
												<!-- Empty tier drop zone -->
												<div
													class="flex flex-1 cursor-pointer items-center justify-center border-2 border-dashed border-gray-400 bg-gray-800/40 transition-colors hover:border-orange-400 hover:bg-orange-900/10"
													style="height: {itemsStyle.itemHeight}; min-width: 120px;"
													on:dragover={(e) => handleDragOver(e, tier.id, 0)}
													on:drop={(e) => handleDrop(e, tier.id, 0)}
													aria-label="Drop here"
													tabIndex="0"
												>
													<span class="text-sm text-gray-400">Drop here</span>
												</div>
											{/if}
										{:else}
											{#each tier.items as item, idx (item.id)}
												<div
													class="group/item relative cursor-pointer overflow-hidden shadow-sm transition-shadow hover:shadow-lg"
													style="
														{item.image
														? `background-image: url('${item.image}'); background-size: cover; background-position: center;`
														: 'background: linear-gradient(135deg, #1f2937, #374151);'}
														height: {itemsStyle.itemHeight};
														width: {itemsStyle.itemWidth};
														opacity: {isDragging && draggedItem?.id === item.id ? 0.5 : 1};
														border-left: {isDragging && dragOverTier === tier.id && dragOverPosition === idx
														? '4px solid orange'
														: 'none'};
													"
													draggable="true"
													on:dragstart={(e) => handleDragStart(e, item)}
													on:dragend={handleDragEnd}
													on:dragover={(e) => {
														if (isDragging) handleDragOver(e, tier.id, idx);
													}}
													on:drop={(e) => {
														if (isDragging) handleDrop(e, tier.id, idx);
													}}
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
														class="absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center bg-red-500 text-white opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-red-600"
														on:click|stopPropagation={() => deleteItem(item.id)}
														title="Delete item"
													>
														<span class="material-symbols-outlined text-sm">close</span>
													</button>
													{#if editingItemId === item.id}
														<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
															<input
																id="inline-edit-{item.id}"
																class="w-full border border-white/30 bg-black/50 px-2 py-1 text-center text-sm font-medium text-white outline-none"
																bind:value={inlineEditText}
																on:blur={finishInlineEdit}
																on:keydown={(e) => {
																	if (e.key === 'Enter') finishInlineEdit();
																	if (e.key === 'Escape') cancelInlineEdit();
																}}
															/>
														</div>
													{:else if item.type === 'text' && !item.image}
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
											{#if isDragging}
												<!-- End drop zone -->
												<div
													class="flex min-h-20 flex-1 cursor-pointer items-center justify-center border-2 border-dashed border-gray-400 bg-gray-800/40 transition-colors hover:border-orange-400 hover:bg-orange-900/10"
													style="
														height: {itemsStyle.itemHeight};
														min-width: 120px;
														border-left: {isDragging && dragOverTier === tier.id && dragOverPosition === tier.items.length
														? '4px solid orange'
														: '2px dashed #888'};
														background: transparent;
													"
													on:dragover={(e) => {
														if (isDragging) handleDragOver(e, tier.id, tier.items.length);
													}}
													on:drop={(e) => {
														if (isDragging) handleDrop(e, tier.id, tier.items.length);
													}}
													aria-label="Drop here"
													tabIndex="0"
												>
													<span class="text-sm text-gray-400">Drop here</span>
												</div>
											{/if}
										{/if}
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
						openAddItemModal(null, y, e);
					}}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && openAddItemModal(null, 0.5, e)}
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
								class="group pointer-events-auto absolute top-0 right-4 z-20 flex h-full w-64 items-center justify-end"
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
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center transition-colors hover:bg-black"
												style="color: {tier.color};"
												on:click|stopPropagation={control.action}
												title={control.title}
											>
												<span class="material-symbols-outlined text-lg">{control.icon}</span>
											</button>
										{/each}
										{#if tierList.tiers.length > 1}
											<button
												class="hover:bg-opacity-20 flex h-8 w-8 items-center justify-center transition-colors hover:bg-black"
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
					{#each [...tierList.unassignedItems, ...tierList.tiers.flatMap( (tier: Tier, tierIndex: number) => tier.items.map( (item: TierItem) => ({ ...item, _defaultY: (tierIndex + 0.5) / tierList.tiers.length }) ) )] as item, i (item.id)}
						{@const x = item.position?.x ?? 0.1 + (i % 8) * 0.1}
						{@const y = item.position?.y ?? (item as any)._defaultY ?? 0.5}
						{@const isEditing = editingItemId === item.id}
						{@const isDragged = isDragging && draggedItem?.id === item.id}
						{@const itemSize = getItemSize(item)}

						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div
							class="group/item absolute -translate-x-1/2 -translate-y-1/2 transform cursor-pointer overflow-hidden shadow-lg transition-all hover:shadow-xl {isDragged
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
								class="absolute top-1 right-1 z-20 flex h-6 w-6 items-center justify-center bg-red-500 text-white opacity-0 transition-opacity group-hover/item:opacity-100 hover:bg-red-600"
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
										class="w-full border border-white/30 bg-black/50 px-2 py-1 text-center text-sm font-medium text-white outline-none"
										bind:value={inlineEditText}
										on:blur={finishInlineEdit}
										on:keydown={(e) => {
											if (e.key === 'Enter') finishInlineEdit();
											if (e.key === 'Escape') cancelInlineEdit();
										}}
									/>
								</div>
							{:else if item.type === 'text' && !item.image}
								<!-- Text items -->
								<div class="absolute inset-0 z-10 flex items-center justify-center p-2">
									<div
										class="text-center text-sm leading-tight font-medium text-white"
										style={getTextStyle(item)}
									>
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

					{#if tierList.unassignedItems.length === 0 && tierList.tiers.every((t: Tier) => t.items.length === 0)}
						<div
							class="pointer-events-none absolute inset-0 flex items-center justify-center text-white"
						>
							<div class="bg-opacity-30 bg-black p-6 text-center">
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
			class="fixed z-50 min-w-48 border border-gray-600 bg-gray-800 py-2 shadow-lg"
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
									updateItemEverywhere( currentItem.id, { image: URL.createObjectURL(file), type: 'image' } );
								}
							};
							input.click();
							closeContextMenu();
						} }, { icon: 'swap_horiz', text: 'Change Type', action: () => {
						if (!contextMenuItem) return;
						let nextType: 'text' | 'image' | 'search';
						if (contextMenuItem.type === 'text') nextType = 'image';
						else if (contextMenuItem.type === 'image') nextType = 'search';
						else nextType = 'text';
						updateItemEverywhere(contextMenuItem.id, { type: nextType });
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

	<!-- Add Item Modal -->
	{#if showAddItemModal}
		<div
			class="fixed z-50 border border-gray-800 bg-black shadow-2xl"
			style="left: {addItemModalX}px; top: {addItemModalY}px; min-width: 320px; max-width: 95vw; width: auto;"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			on:keydown={(e) => {
				if (e.key === 'Escape') closeAddItemModal();
				if (e.key === 'ArrowDown' && filteredAISuggestions.length > 0) {
					highlightedAISuggestionIdx = Math.min(
						highlightedAISuggestionIdx + 1,
						filteredAISuggestions.length - 1
					);
					e.preventDefault();
				}
				if (e.key === 'ArrowUp' && filteredAISuggestions.length > 0) {
					highlightedAISuggestionIdx = Math.max(highlightedAISuggestionIdx - 1, 0);
					e.preventDefault();
				}
			}}
		>
			<div class="flex w-auto max-w-[95vw] min-w-[320px] flex-col items-stretch p-4">
				<!-- AI Suggestions -->
				{#if aiEnabled && filteredAISuggestions.length > 0}
					<div class="mb-3">
						<div class="mb-1 text-xs text-gray-400">Suggestions</div>
						<div
							class="flex max-h-32 max-w-[420px] flex-wrap gap-2 overflow-x-hidden overflow-y-auto pr-2"
						>
							{#each filteredAISuggestions as suggestion, idx (`${suggestion.name}-${idx}`)}
								<button
									class="animate-fadein-suggestion translate-y-2 bg-gray-800 px-3 py-1 text-sm text-white opacity-0 transition-colors hover:bg-orange-500 focus:outline-none {highlightedAISuggestionIdx ===
									idx
										? 'ring-2 ring-orange-500'
										: ''}"
									style="animation-delay: {idx * 60}ms"
									on:click={() => addSuggestedItem(suggestion)}
									on:mouseenter={() => (highlightedAISuggestionIdx = idx)}
									on:mouseleave={() => (highlightedAISuggestionIdx = -1)}
									tabindex="0"
								>
									{suggestion.name}
									{#if suggestion.image && prefetchedImages[suggestion.name]}
										<img
											src={prefetchedImages[suggestion.name]}
											alt={suggestion.name}
											class="ml-2 inline-block h-5 w-5 object-cover"
										/>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Input row with upload button -->
				<div class="flex items-center gap-2">
					<input
						id="quick-add-input"
						class="flex-1 border border-gray-600 bg-[#191919] px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
						type="text"
						bind:value={newItemText}
						placeholder="Type to add item or search images..."
						autocomplete="off"
						on:input={() => {
							if (newItemText.trim().length > 2) {
								clearTimeout(searchTimeout);
								searchTimeout = setTimeout(() => {
									searchQuery = newItemText;
									searchImages(true);
								}, 300);
							} else {
								searchResults = [];
								hasMoreResults = true;
								searchPage = 1;
								highlightedImageIdx = -1;
							}
							highlightedAISuggestionIdx = -1;
						}}
						on:keydown={(e: KeyboardEvent) => {
							if (e.key === 'Enter' && newItemText.trim()) {
								if (highlightedAISuggestionIdx >= 0 && filteredAISuggestions.length > 0) {
									addSuggestedItem(filteredAISuggestions[highlightedAISuggestionIdx]);
								} else if (highlightedImageIdx >= 0 && searchResults.length > 0) {
									addSearchResult(searchResults[highlightedImageIdx]);
								} else {
									addTextItem();
								}
							}
							if (e.key === 'Escape') closeAddItemModal();
							if (e.key === 'ArrowDown' && filteredAISuggestions.length > 0) {
								highlightedAISuggestionIdx = Math.min(
									highlightedAISuggestionIdx + 1,
									filteredAISuggestions.length - 1
								);
								e.preventDefault();
							}
							if (e.key === 'ArrowUp' && filteredAISuggestions.length > 0) {
								highlightedAISuggestionIdx = Math.max(highlightedAISuggestionIdx - 1, 0);
								e.preventDefault();
							}
						}}
						aria-label="Add item or search images"
						on:paste={handlePasteImage}
					/>
					<label
						class="flex h-10 w-10 cursor-pointer items-center justify-center text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
						title="Upload Image"
						on:click={() => document.getElementById('add-modal-file-input')?.click()}
					>
						<span class="material-symbols-outlined text-lg">upload</span>
						<input id="add-modal-file-input" type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
					</label>
					<button
						class="flex h-8 w-8 items-center justify-center text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
						on:click={closeAddItemModal}
						title="Close"
						tabindex="0"
					>
						<span class="material-symbols-outlined text-sm">close</span>
					</button>
				</div>

				<!-- Google Image Search Results -->
				{#if newItemText.trim().length > 2 && (searchResults.length > 0 || searching)}
					<div class="mt-4 max-h-64 overflow-y-auto">
						<div
							class="grid gap-2"
							style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));"
						>
							{#each searchResults as result, idx}
								<button
									class="group animate-fadein-image overflow-hidden border border-gray-600 opacity-0 transition-colors hover:border-orange-400 hover:bg-gray-700 focus:outline-none {highlightedImageIdx ===
									idx
										? 'ring-2 ring-orange-500'
										: ''}"
									style="animation-delay: {idx * 70}ms"
									on:click={() => addSearchResult(result)}
									on:mouseenter={() => (highlightedImageIdx = idx)}
									on:mouseleave={() => (highlightedImageIdx = -1)}
									tabindex="0"
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
							{#if searching && searchResults.length === 0}
								{#each Array(6) as _, i}
									<div
										class="animate-pulse overflow-hidden border border-gray-600"
										style="animation-delay: {i * 0.1}s"
									>
										<div class="aspect-square bg-gray-700"></div>
										<div class="p-2">
											<div
												class="mb-1 h-3 bg-gray-700"
												style="width: {60 + Math.random() * 30}%"
											></div>
											<div class="h-2 bg-gray-600" style="width: {40 + Math.random() * 40}%"></div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/if}
				{#if searching}
					<div class="mt-2 flex items-center space-x-2 text-gray-400">
						<div class="h-4 w-4 animate-spin border-2 border-gray-400 border-t-orange-500"></div>
						<span class="text-sm">Searching...</span>
					</div>
				{/if}
				{#if newItemText.trim() && (!searchResults.length || highlightedImageIdx === -1)}
					<div class="mt-2 text-xs text-gray-500">Press <kbd>Enter</kbd> to add as text item</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Search Results -->
	{#if addItemType === 'search' && (searchResults.length > 0 || searching)}
		<div class="border-t border-gray-600 p-4">
			<div class="mb-3 flex items-center justify-between">
				<div class="text-sm text-gray-400">Search Results</div>
				{#if searching}
					<div class="flex items-center space-x-2 text-blue-400">
						<div class="h-3 w-3 animate-spin border-2 border-blue-400 border-t-transparent"></div>
						<span class="text-xs">Searching...</span>
					</div>
				{:else if loadingMore}
					<div class="flex items-center space-x-2 text-blue-400">
						<div class="h-3 w-3 animate-spin border-2 border-blue-400 border-t-transparent"></div>
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
						const scrollThreshold = 100;
						const isNearBottom =
							target.scrollTop + target.clientHeight >= target.scrollHeight - scrollThreshold;

						if (isNearBottom) {
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
							class="group overflow-hidden border border-gray-600 transition-colors hover:border-orange-400 hover:bg-gray-700"
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
								class="animate-pulse overflow-hidden border border-gray-600"
								style="animation-delay: {i * 0.1}s"
							>
								<div class="aspect-square bg-gray-700"></div>
								<div class="p-2">
									<div class="mb-1 h-3 bg-gray-700" style="width: {60 + Math.random() * 30}%"></div>
									<div class="h-2 bg-gray-600" style="width: {40 + Math.random() * 40}%"></div>
								</div>
							</div>
						{/each}
					{/if}

					<!-- Load more skeleton loading -->
					{#if loadingMore && searchResults.length > 0}
						{#each Array(6) as _, i}
							<div
								class="animate-pulse overflow-hidden border border-gray-600"
								style="animation-delay: {i * 0.1}s"
							>
								<div class="aspect-square bg-gray-700"></div>
								<div class="p-2">
									<div class="mb-1 h-3 bg-gray-700" style="width: {60 + Math.random() * 30}%"></div>
									<div class="h-2 bg-gray-600" style="width: {40 + Math.random() * 40}%"></div>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Load more button (fallback) -->
				{#if searchResults.length > 0 && hasMoreResults && !loadingMore}
					<div class="mt-4 text-center">
						<button
							class="bg-gray-700 px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-600"
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
				<div class="h-4 w-4 animate-spin border-2 border-gray-400 border-t-orange-500"></div>
				<span class="text-sm">Searching...</span>
			</div>
		</div>
	{/if}

	<!-- Color Picker Modal -->
	{#if showColorPicker && colorPickerTierId}
		{@const currentTier = tierList.tiers.find((t: Tier) => t.id === colorPickerTierId)}
		{#if currentTier}
			<div class="bg-opacity-75 fixed inset-0 z-50 flex items-center justify-center bg-black">
				<div class="w-full max-w-md border border-gray-600 bg-gray-800 p-6">
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
							class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
									class="h-12 w-12 border-2 transition-colors {currentTier.color === color
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
								class="h-12 w-full border border-gray-600 bg-gray-700"
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
								class="w-full bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
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
							class="w-full bg-orange-500 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-600"
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
			<div class="mx-4 w-full max-w-md bg-gray-800 p-6 shadow-xl">
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
							class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:ring-2 focus:ring-orange-500 focus:outline-none"
							type="text"
							bind:value={editingItem.text}
							placeholder="Enter item text..."
						/>
					</div>
					<!-- Type Selector -->
					<div>
						<label for="item-type-selector" class="mb-2 block text-sm font-medium text-gray-300">
							Item Type
							<span class="ml-1 text-xs text-gray-500">(change anytime)</span>
						</label>
						<select
							id="item-type-selector"
							class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
							bind:value={editingItem.type}
						>
							<option value="text">Text</option>
							<option value="image">Image</option>
							<option value="search">Search</option>
						</select>
					</div>
					<!-- Image Preview -->
					{#if editingItem.image}
						<div>
							<div class="mb-2 block text-sm font-medium text-gray-300">Current Image</div>
							<div class="flex items-center space-x-4">
								<img
									src={editingItem.image}
									alt={editingItem.text}
									class="h-16 w-16 object-cover"
								/>
								<button
									class="bg-red-600 px-3 py-1 text-sm text-white transition-colors hover:bg-red-700"
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
							class="flex cursor-pointer flex-col items-center border-2 border-dashed border-gray-600 p-4 transition-colors hover:border-orange-400"
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
										editingItem.type = 'image';
										editingItem = editingItem;
									}
								}}
							/>
						</label>
					</div>
				</div>

				<!-- Move to Tier -->
				<div>
					<label for="tier-select" class="mb-2 block text-sm font-medium text-gray-300"
						>Move to Tier</label
					>
					<select
						id="tier-select"
						class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
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
					class="flex-1 bg-red-600 px-4 py-2 font-bold text-white transition-colors hover:bg-red-700"
					on:click={() => {
						if (editingItem) {
							deleteItem(editingItem.id);
						}
					}}
				>
					Delete Item
				</button>
				<button
					class="flex-1 bg-orange-500 px-4 py-2 font-bold text-white transition-colors hover:bg-orange-600"
					on:click={updateItem}
				>
					Save Changes
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Gemini Debug Modal -->
{#if showGeminiDebugModal}
	<div class="bg-opacity-80 fixed inset-0 z-50 flex items-center justify-center bg-black">
		<div class="relative mx-4 w-full max-w-2xl bg-gray-900 p-8 shadow-2xl">
			<button
				class="absolute top-4 right-4 text-2xl text-gray-400 hover:text-white"
				on:click={() => (showGeminiDebugModal = false)}
				aria-label="Close debug modal"
			>
				&times;
			</button>
			<h2 class="mb-4 text-2xl font-bold text-orange-400">Gemini Debug Info</h2>
			<div class="mb-6">
				<div class="mb-2 text-sm font-semibold text-gray-300">Prompt Sent to Gemini:</div>
				<pre
					class="overflow-x-auto bg-gray-800 p-4 text-xs whitespace-pre-wrap text-gray-200"
					style="max-height: 200px;">{lastGeminiPrompt}</pre>
			</div>
			<div>
				<div class="mb-2 text-sm font-semibold text-gray-300">Raw Gemini Response:</div>
				<pre
					class="overflow-x-auto bg-gray-800 p-4 text-xs whitespace-pre-wrap text-gray-200"
					style="max-height: 300px;">{lastGeminiRawResponse}</pre>
			</div>
		</div>
	</div>
{/if}

<Toast />
