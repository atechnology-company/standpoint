<script lang="ts">
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import type { TierListResponse, TierCreate, TierItem } from '$lib/types';
	import { currentUser, userGroup } from '$lib/stores';
	import { getUserProfile } from '$lib/user-profile';
	import { addToast } from '$lib/toast';
	import { goto } from '$app/navigation';
	import confetti from 'canvas-confetti';
	import {
		collection,
		addDoc,
		query,
		where,
		orderBy,
		onSnapshot,
		serverTimestamp,
		doc,
		setDoc,
		deleteDoc,
		getDoc
	} from 'firebase/firestore';
	import { db } from '$lib/firebase';
	import {
		likeTierlist,
		unlikeTierlist,
		hasUserLikedTierlist
	} from '$lib/firestore-polls-tierlists.js';

	export let title: string = '';
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let tierListData: TierListResponse | null = null;

	// Track if this is a fork and the original data
	let isForked = false;
	let originalId = '';
	let originalTitle = '';
	let originalAuthor = '';

	const dispatch = createEventDispatcher();

	// Interaction states
	let liked = false;
	let likes = 0;
	let comments = 0;
	let forks = 0;
	let commentText = '';
	let commentsList: Array<{
		id: string;
		text: string;
		author: string;
		timestamp: number;
		authorUid?: string;
	}> = [];
	let interacting = false;
	let unsubscribeComments: (() => void) | null = null;
	let unsubscribeLikes: (() => void) | null = null;
	let unsubscribeForks: (() => void) | null = null;

	$: resolvedAuthorName =
		tierListData && typeof tierListData.owner_displayName === 'string' && tierListData.owner_displayName.trim()
			? tierListData.owner_displayName
			: tierListData?.author || 'Anonymous';

	function normalizeDate(input: any): Date | null {
		if (!input) return null;
		if (typeof input === 'string' || typeof input === 'number') {
			const d = new Date(input);
			return isNaN(d.getTime()) ? null : d;
		}
		if (typeof input.toDate === 'function') {
			const d = input.toDate();
			return isNaN(d.getTime()) ? null : d;
		}
		return null;
	}
	function formatDateSafe(input: any): string {
		const d = normalizeDate(input);
		return d
			? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
			: 'Invalid date';
	}

	function handleShare() {
		if (navigator.share && shareUrl) {
			navigator.share({
				title: title,
				url: shareUrl
			});
		} else if (shareUrl) {
			navigator.clipboard.writeText(shareUrl);
			addToast('Link copied to clipboard!', 'success');
		}
	}

	function handleDelete() {
		if (confirm(`Are you sure you want to delete this tier list? This action cannot be undone.`)) {
			handleDeleteWithFallback();
		}
	}

	async function handleDeleteWithFallback() {
		try {
			await deleteDoc(doc(db, 'tierlists', id.toString()));
			addToast('Tierlist deleted!', 'success');
			goto('/tierlists');
		} catch (error) {
			addToast('Failed to delete tierlist', 'error');
		}
	}

	async function toggleLike(event?: Event) {
		if (!$currentUser) {
			addToast('Please sign in to like tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			if (liked) {
				await unlikeTierlist(id.toString(), $currentUser.uid);
				liked = false;
				addToast('Removed like', 'success');
			} else {
				await likeTierlist(id.toString(), $currentUser.uid);
				liked = true;

				// Confetti
				if (event?.target) {
					const button = event.target as HTMLElement;
					const rect = button.getBoundingClientRect();
					const x = (rect.left + rect.width / 2) / window.innerWidth;
					const y = (rect.top + rect.height / 2) / window.innerHeight;

					confetti({
						particleCount: 50,
						spread: 60,
						origin: { x, y },
						startVelocity: 15,
						gravity: 0.8,
						ticks: 100
					});
				} else {
					// Fallback to center
					confetti({
						particleCount: 50,
						spread: 60,
						origin: { y: 0.7 },
						startVelocity: 15,
						gravity: 0.8,
						ticks: 100
					});
				}
			}
		} catch (error) {
			console.error('Error toggling like:', error);
			addToast('Failed to update like', 'error');
		} finally {
			interacting = false;
		}
	}

	async function addComment() {
		if (!$currentUser || !commentText.trim()) {
			if (!$currentUser) addToast('Please sign in to comment', 'error');
			return;
		}

		try {
			interacting = true;

			await addDoc(collection(db, 'comments'), {
				tierlistId: id.toString(),
				text: commentText.trim(),
				author: $currentUser.displayName || 'Anonymous',
				authorUid: $currentUser.uid,
				timestamp: serverTimestamp()
			});

			commentText = '';
			addToast('Comment added!', 'success');
		} catch (error) {
			console.error('Error adding comment:', error);
			addToast('Failed to add comment', 'error');
		} finally {
			interacting = false;
		}
	}

	function loadComments() {
		if (!id) return;

		const commentsQuery = query(
			collection(db, 'comments'),
			where('tierlistId', '==', id.toString()),
			orderBy('timestamp', 'desc')
		);

		unsubscribeComments = onSnapshot(
			commentsQuery,
			(snapshot: any) => {
				commentsList = snapshot.docs.map((doc: any) => {
					const data = doc.data();
					return {
						id: doc.id,
						text: data.text,
						author: data.author,
						authorUid: data.authorUid,
						timestamp: data.timestamp?.toMillis() || Date.now()
					};
				});
				comments = commentsList.length;
			},
			(error: any) => {
				console.error('Error loading comments:', error);
			}
		);
	}

	async function loadLikes() {
		if (!id) return;

		const likesQuery = query(collection(db, 'tierlists', id.toString(), 'likes'));

		unsubscribeLikes = onSnapshot(
			likesQuery,
			(snapshot: any) => {
				likes = snapshot.size;

				if ($currentUser) {
					liked = snapshot.docs.some((doc: any) => doc.id === $currentUser.uid);
				} else {
					liked = false;
				}
			},
			(error: any) => {
				console.error('Error loading likes:', error);
			}
		);
	}

	function loadForks() {
		if (!id) return;

		const forksQuery = query(collection(db, 'forks'), where('tierlistId', '==', id.toString()));

		unsubscribeForks = onSnapshot(
			forksQuery,
			(snapshot: any) => {
				forks = snapshot.size;
			},
			(error: any) => {
				console.error('Error loading forks:', error);
			}
		);
	}

	async function forkTierlist() {
		if (!$currentUser) {
			addToast('Please sign in to fork tierlists', 'error');
			return;
		}

		try {
			interacting = true;

			const allItems: TierItem[] = [];

			if (tierListData?.tiers) {
				tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
					if (tier.items) {
						allItems.push(...tier.items);
					}
				});
			}

			const forkData = {
				sourceTitle: title,
				sourceId: id,
				items: allItems,
				timestamp: Date.now()
			};

			localStorage.setItem('standpoint_fork_data', JSON.stringify(forkData));

			await addDoc(collection(db, 'forks'), {
				tierlistId: id.toString(),
				userUid: $currentUser.uid,
				userName: $currentUser.displayName || 'Anonymous',
				timestamp: serverTimestamp()
			});

			addToast('Tierlist forked! Redirecting to editor...', 'success');

			setTimeout(() => {
				goto('/tierlists/create?forked=true');
			}, 1000);
		} catch (error) {
			console.error('Error forking tierlist:', error);
			addToast('Failed to fork tierlist', 'error');
		} finally {
			interacting = false;
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
		return tierListData.tiers.reduce(
			(total: number, tier: TierCreate & { items?: TierItem[] }) =>
				total + (tier.items?.length || 0),
			0
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

		tierListData.tiers.forEach((tier: TierCreate & { items?: TierItem[] }) => {
			tier.items?.forEach((item: TierItem) => {
				if (item.image) imageCount++;
				else textCount++;
			});
		});

		return { text: textCount, image: imageCount };
	}

	const totalItems = getTotalItems();
	const itemBreakdown = getItemTypeBreakdown();
	const mostPopulated = getMostPopulatedTier();

	onMount(() => {
		loadComments();
		loadLikes();
		loadForks();
		checkIfForked();
	});

	async function checkIfForked() {
		if (!id) return;

		try {
			const tierlistRef = doc(db, 'tierlists', id.toString());
			const tierlistDoc = await getDoc(tierlistRef);

			if (tierlistDoc.exists()) {
				const data = tierlistDoc.data();
				isForked = data.isForked || false;
				originalId = data.originalId || '';

				if (isForked && originalId) {
					const originalRef = doc(db, 'tierlists', originalId);
					const originalDoc = await getDoc(originalRef);

					if (originalDoc.exists()) {
						const originalData = originalDoc.data();
						originalTitle = originalData.title || 'Original Tierlist';
						originalAuthor = originalData.authorName || 'Unknown Author';
					}
				}
			}
		} catch (error) {
			console.error('Error checking if tierlist is forked:', error);
		}
	}

	onDestroy(() => {
		if (unsubscribeComments) {
			unsubscribeComments();
		}
		if (unsubscribeLikes) {
			unsubscribeLikes();
		}
		if (unsubscribeForks) {
			unsubscribeForks();
		}
	});

	let isOwner = false;

	$: if ($currentUser && tierListData) {
		const isOriginalOwner = $currentUser.uid === tierListData.owner;
		const redirectUids = tierListData.redirectUids || [];
		const hasRedirectAccess = redirectUids.includes($currentUser.uid);
		const isDevUser = $userGroup === 'dev';
		const displayNameMatch = $currentUser.displayName === tierListData.owner_displayName;

		isOwner = isOriginalOwner || hasRedirectAccess || isDevUser || displayNameMatch;
	}

	function handleLike(event: Event) {
		toggleLike(event);
	}

	function handleFork() {
		forkTierlist();
	}

	function promptLogin() {
		addToast('Please sign in to interact with tierlists', 'info');
		goto('/login');
	}

	function copyShareUrl() {
		if (navigator.clipboard && shareUrl) {
			navigator.clipboard
				.writeText(shareUrl)
				.then(() => {
					addToast('Link copied to clipboard!', 'success');
				})
				.catch(() => {
					addToast('Failed to copy link', 'error');
				});
		} else {
			addToast('Clipboard not available', 'error');
		}
	}

	function handleEdit() {
		dispatch('edit');
	}
</script>

<div class="flex h-full flex-col overflow-y-auto bg-orange-900 p-6 text-white">
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm text-orange-300">{resolvedAuthorName}</span>
			<!-- Interaction buttons -->
			<div class="flex items-center space-x-2">
				{#if $currentUser}
					<!-- Like button -->
					<button
						class="flex h-10 w-10 items-center justify-center transition-colors duration-200 {liked
							? 'bg-red-600 text-white hover:bg-red-700'
							: 'bg-orange-700 text-orange-300 hover:bg-orange-600'}"
						on:click={handleLike}
						title={liked ? 'Unlike' : 'Like'}
					>
						<span class="material-symbols-outlined text-lg"
							>{liked ? 'favorite' : 'favorite_border'}</span
						>
					</button>

					<!-- Fork button -->
					<button
						class="flex h-10 w-10 items-center justify-center bg-orange-700 text-orange-300 transition-colors duration-200 hover:bg-orange-600"
						on:click={handleFork}
						title="Fork this tierlist"
						aria-label="Fork this tierlist"
					>
						<span class="material-symbols-outlined text-lg">call_split</span>
					</button>
				{:else}
					<!-- Login prompt for guests -->
					<button
						class=" bg-blue-600 px-3 py-1 text-xs text-white transition-colors duration-200 hover:bg-blue-700"
						on:click={promptLogin}
					>
						Login to interact
					</button>
				{/if}
			</div>
		</div>
		<h1 class="mb-4 text-2xl font-bold break-words">{title || 'UNTITLED TIER LIST'}</h1>

		<div class="mb-6 text-sm text-orange-300">
			{formatDateSafe(tierListData?.created_at)}
		</div>

		<!-- Tier List Statistics Section -->
		{#if tierListData}
			<div class="mb-6 bg-orange-800/50 p-4">
				<!-- Basic Stats Grid -->
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div class=" bg-orange-800/30 p-3 text-center">
						<div class="text-2xl font-bold text-white">{totalItems}</div>
						<div class="text-xs text-orange-300">Total Items</div>
					</div>
					<div class=" bg-orange-800/30 p-3 text-center">
						<div class="text-lg font-bold text-white">
							{getTierListTypeName(tierListData?.list_type || 'classic')}
						</div>
						<div class="text-xs text-orange-300">List Type</div>
					</div>
				</div>

				<!-- Item Type Breakdown -->
				<div class="mb-4 grid grid-cols-2 gap-3">
					<div class=" bg-orange-800/30 p-2 text-center">
						<div class="text-sm font-bold text-white">{itemBreakdown.text}</div>
						<div class="text-xs text-orange-300">Text Items</div>
					</div>
					<div class=" bg-orange-800/30 p-2 text-center">
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
								<div class="flex items-center justify-between bg-orange-800/30 p-2">
									<div class="flex items-center space-x-2">
										<div
											class="h-3 w-3 flex-shrink-0 border border-orange-300"
											style="background-color: {tier.color || '#ff7f7f'}"
										></div>
										<span class="text-sm text-orange-100">{tier.name}</span>
									</div>
									<span class="text-sm font-bold text-white">{getItemsInTier(tier.name)}</span>
								</div>
							{/each}
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

				<!-- Original Tierlist Button (if this is a fork) -->
				{#if isForked && originalId}
					<div class="mt-4 mb-4">
						<a
							href="/tierlists/{originalId}"
							class="block w-full bg-orange-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-orange-700"
						>
							<div class="flex items-center justify-center gap-2">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="m7 7 10 10"></path>
									<path d="M17 7h-7"></path>
									<path d="M7 17v-7"></path>
								</svg>
								View Original Tierlist
							</div>
						</a>
					</div>
				{/if}

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
										<div class="h-2 flex-1 overflow-hidden bg-orange-900">
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

				<!-- Original Tierlist Link (if this is a fork) -->
				{#if isForked && originalId}
					<div class="mt-6 mb-4">
						<div class="mb-2 text-sm text-orange-200">Forked From</div>
						<a
							href="/tierlists/{originalId}"
							class="flex items-center gap-2 bg-orange-700/50 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-700/80"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="lucide lucide-git-fork"
							>
								<circle cx="12" cy="18" r="3"></circle>
								<circle cx="6" cy="6" r="3"></circle>
								<circle cx="18" cy="6" r="3"></circle>
								<path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"></path>
								<path d="M12 12v3"></path>
							</svg>
							View Original Tierlist
							<span class="ml-1 opacity-70">by {originalAuthor}</span>
						</a>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Comments Section -->
		<div class="mb-6 bg-orange-800/50 p-4">
			<h3 class="mb-4 text-lg font-semibold text-orange-200">Comments ({comments})</h3>

			<!-- Add Comment Form -->
			{#if $currentUser}
				<div class="mb-4">
					<textarea
						bind:value={commentText}
						placeholder="Add a comment..."
						class="w-full border border-orange-700 bg-orange-800/30 px-3 py-2 text-white placeholder-orange-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
						rows="3"
					></textarea>
					<div class="mt-2 flex justify-end">
						<button
							on:click={addComment}
							disabled={!commentText.trim() || interacting}
							class=" bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
						>
							{interacting ? 'Posting...' : 'Post'}
						</button>
					</div>
				</div>
			{:else}
				<div class="mb-4 text-center">
					<p class="text-sm text-orange-300">Please sign in to add comments</p>
				</div>
			{/if}

			<!-- Comments List -->
			{#if commentsList.length > 0}
				<div class="space-y-3">
					{#each commentsList as comment (comment.id)}
						<div class=" bg-orange-800/30 p-3">
							<div class="mb-1 flex items-center space-x-2">
								<span class="text-sm font-medium text-orange-100">{comment.author}</span>
								<span class="text-xs text-orange-300"
									>{new Date(comment.timestamp).toLocaleDateString()}</span
								>
							</div>
							<p class="text-sm text-orange-200">{comment.text}</p>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center text-orange-300">
					<p class="text-sm">No comments yet. Be the first to comment!</p>
				</div>
			{/if}
		</div>

		<!-- Bottom section with link, edit and delete -->
		<div class="mt-auto border-t border-orange-700 pt-4">
			<div class="flex items-center justify-between">
				<!-- Copyable link at bottom left -->
				<button
					class="flex-1 truncate pr-4 text-left text-sm text-orange-300 transition-colors hover:text-orange-200"
					on:click={copyShareUrl}
					title="Click to copy link"
				>
					{shareUrl}
				</button>

				<!-- Edit and Delete buttons at bottom right -->
				<div class="flex items-center space-x-2">
					{#if isOwner}
						<button
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-blue-600 text-white transition-colors duration-200 hover:bg-blue-700"
							on:click={handleEdit}
							title="Edit tierlist"
						>
							<span class="material-symbols-outlined text-xl">edit</span>
						</button>
						<button
							class="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-red-600 text-white transition-colors duration-200 hover:bg-red-700"
							on:click={handleDelete}
							title="Delete tierlist"
						>
							<span class="material-symbols-outlined text-xl">delete</span>
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>