<script lang="ts">
	import type { PollResponse } from '../lib/api';
	import { createEventDispatcher, onMount, onDestroy } from 'svelte';
	import confetti from 'canvas-confetti';
	import { currentUser, userGroup } from '$lib/stores';
	import { db } from '$lib/firebase';
	import {
		collection,
		addDoc,
		query,
		where,
		orderBy,
		onSnapshot,
		Timestamp,
		serverTimestamp,
		getDocs,
		deleteDoc,
		doc
	} from 'firebase/firestore';
	import { addToast } from '$lib/toast';

	let likeBtn: HTMLButtonElement | null = null;

	export let title: string = '';
	export let date: string = '';
	export let author: string = 'Anonymous';
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let pollData: PollResponse | null = null;
	export let likes: number = 0;
	export let liked: boolean = false;
	export let showComments: boolean = true;

	let likeLoading = false;
	let copied = false;
	let commentText = '';
	let commentsList: Array<{
		id: string;
		text: string;
		createdAt: Date;
		userId: string;
		userDisplayName: string;
		userPhotoURL: string;
	}> = [];
	let comments = 0;
	let unsubscribeComments: (() => void) | null = null;

	// Fetch initial like count and liked state on mount
	onMount(async () => {
		try {
			const res = await fetch(`/api/interactions/poll/${id}/likes`);
			if (res.ok) {
				const data = await res.json();
				likes = data.likes ?? 0;
			}
		} catch {
			likes = 0;
		}

		// Load comments when component mounts
		loadComments();
	});

	onDestroy(() => {
		// Cleanup comment subscription
		if (unsubscribeComments) {
			unsubscribeComments();
		}
	});
	async function handleLike() {
		if (likeLoading) return;
		likeLoading = true;
		try {
			const endpoint = liked ? '/api/interactions/unlike' : '/api/interactions/like';
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ item_id: id, item_type: 'poll' })
			});
			if (res.ok) {
				const data = await res.json();
				likes = data.likes;
				// Only animate on like
				if (!liked && likeBtn) {
					const rect = likeBtn.getBoundingClientRect();
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
				}
				liked = !liked;
			}
		} catch {
			// Optionally handle error
		} finally {
			likeLoading = false;
		}
	}

	// Robust date normalization/formatting utility
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

	const dispatch = createEventDispatcher();

	function handleDelete() {
		if (confirm(`Are you sure you want to delete this poll? This action cannot be undone.`)) {
			dispatch('delete', { id, type: 'poll' });
		}
	}

	function getResponseTypeName(responseType: number) {
		const names: Record<number, string> = {
			2: 'Line Scale',
			3: 'Triangle',
			4: 'Square',
			5: 'Pentagon'
		};
		return names[responseType] || 'Unknown';
	}

	function calculateConfidenceInterval(average: number, stdDev: number, totalVotes: number) {
		if (totalVotes === 0) return { lower: 0, upper: 0 };
		const margin = (1.96 * stdDev) / Math.sqrt(totalVotes);
		return {
			lower: Math.max(0, average - margin),
			upper: Math.min(1, average + margin)
		};
	}

	function getConsensusLevel(stdDev: number) {
		if (stdDev < consensusThreshold * 0.5) return 'Very Strong';
		if (stdDev < consensusThreshold) return 'Strong';
		if (stdDev < consensusThreshold * 1.5) return 'Moderate';
		if (stdDev < consensusThreshold * 2) return 'Weak';
		return 'No Consensus';
	}

	function getVariabilityLevel(stdDev: number) {
		if (stdDev < variabilityThreshold * 0.5) return 'Very Low';
		if (stdDev < variabilityThreshold) return 'Low';
		if (stdDev < variabilityThreshold * 1.5) return 'Medium';
		return 'High';
	}

	function getEngagementLevel(totalVotes: number) {
		if (totalVotes < engagementThreshold * 0.5) return 'Very Low';
		if (totalVotes < engagementThreshold) return 'Low';
		if (totalVotes < engagementThreshold * 2) return 'Medium';
		return 'High';
	}

	function copyLink() {
		if (navigator.clipboard && shareUrl) {
			navigator.clipboard
				.writeText(shareUrl)
				.then(() => {
					copied = true;
					setTimeout(() => {
						copied = false;
					}, 2000);
				})
				.catch(() => {});
		}
	}

	// Comments functionality
	async function addComment() {
		if (!$currentUser || !commentText.trim()) {
			if (!$currentUser) addToast('Please sign in to comment', 'error');
			return;
		}

		try {
			// Add comment to Firebase
			await addDoc(collection(db, 'comments'), {
				itemId: id.toString(),
				itemType: 'poll',
				text: commentText.trim(),
				userId: $currentUser.uid,
				userDisplayName: $currentUser.displayName || 'Anonymous',
				userPhotoURL: $currentUser.photoURL || '',
				createdAt: serverTimestamp()
			});

			commentText = '';
			addToast('Comment added!', 'success');
		} catch (error) {
			console.error('Error adding comment:', error);
			addToast('Failed to add comment', 'error');
		}
	}

	// Load comments from Firebase when component mounts
	function loadComments() {
		if (!id) return;

		const commentsQuery = query(
			collection(db, 'comments'),
			where('itemId', '==', id.toString()),
			where('itemType', '==', 'poll'),
			orderBy('createdAt', 'desc')
		);

		unsubscribeComments = onSnapshot(
			commentsQuery,
			(snapshot) => {
				commentsList = snapshot.docs.map((doc) => {
					const data = doc.data();
					return {
						id: doc.id,
						text: data.text,
						createdAt: data.createdAt?.toDate() || new Date(),
						userId: data.userId,
						userDisplayName: data.userDisplayName || 'Anonymous',
						userPhotoURL: data.userPhotoURL || ''
					};
				});
				comments = commentsList.length;
			},
			(error) => {
				console.error('Error loading comments:', error);
			}
		);
	}

	async function deleteComment(commentId: string) {
		if (!$currentUser) return;

		try {
			// Check if user is owner or admin before deleting
			const commentDoc = await getDocs(
				query(collection(db, 'comments'), where('__name__', '==', commentId))
			);

			if (commentDoc.empty) return;

			const commentData = commentDoc.docs[0].data();
			if (commentData.userId !== $currentUser.uid && $userGroup !== 'dev') {
				addToast('You can only delete your own comments', 'error');
				return;
			}

			await deleteDoc(doc(db, 'comments', commentId));
			addToast('Comment deleted', 'success');
		} catch (error) {
			console.error('Error deleting comment:', error);
			addToast('Failed to delete comment', 'error');
		}
	}

	$: hasVotes = (pollData?.stats?.total_votes ?? 0) > 0;

	// Default slider values
	let consensusThreshold = 0.2;
	let variabilityThreshold = 0.3;
	let engagementThreshold = 10;

	// Determine if current user can delete this poll (owner or dev role)
	$: canDelete =
		$currentUser && pollData && ($currentUser.uid === pollData.owner || $userGroup === 'dev');

	// Determine if user can create polls (pro users only)
	$: canCreatePolls = $userGroup === 'pro' || $userGroup === 'dev';
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto bg-orange-900 p-6 text-white">
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm text-orange-300">{author}</span>
			<!-- Interaction buttons -->
			<div class="flex items-center space-x-2">
				<!-- Like button -->
				<button
					class="flex h-10 w-10 items-center justify-center transition-colors duration-200 {liked
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'bg-orange-700 text-orange-300 hover:bg-orange-600'}"
					on:click={handleLike}
					title={liked ? 'Unlike' : 'Like'}
					aria-label={liked ? 'Unlike this poll' : 'Like this poll'}
					disabled={likeLoading}
					bind:this={likeBtn}
				>
					<span class="material-symbols-outlined text-lg"
						>{liked ? 'favorite' : 'favorite_border'}</span
					>
				</button>

				<!-- Delete button -->
				{#if canDelete}
					<button
						class="flex h-10 w-10 items-center justify-center bg-red-600 text-white transition-colors duration-200 hover:bg-red-700"
						on:click={handleDelete}
						title="Delete poll"
					>
						<span class="material-symbols-outlined text-lg">delete</span>
					</button>
				{/if}
			</div>
		</div>
		<h1 class="mb-4 text-2xl font-bold break-words">{pollData?.title || title}</h1>

		<div class="mb-6 text-sm text-orange-300">
			{formatDateSafe(pollData?.created_at || date)}
		</div>

		<!-- Poll Statistics Section -->
		{#if pollData}
			<!-- User Vote Status -->
			{#if pollData.user_vote !== undefined && pollData.user_vote !== null}
				<div class="mb-4 border border-green-700/50 bg-green-800/30 p-3">
					<div class="mb-2 flex items-center space-x-2">
						<span class="material-symbols-outlined text-sm text-green-400">check_circle</span>
						<span class="text-sm font-medium text-green-300">You've voted!</span>
					</div>
					<div class="text-xs text-green-200">
						Your vote: {pollData.user_vote !== undefined
							? (pollData.user_vote * 100).toFixed(1)
							: '0'}%
						{#if pollData.user_vote_2d}
							(Position: {(pollData.user_vote_2d.x * 100).toFixed(1)}%, {(
								pollData.user_vote_2d.y * 100
							).toFixed(1)}%)
						{/if}
					</div>
					<div class="mt-1 text-xs text-green-300">
						Click anywhere on the chart to update your vote
					</div>
				</div>
			{:else}
				<div class="mb-4 border border-blue-700/50 bg-blue-800/30 p-3">
					<div class="mb-2 flex items-center space-x-2">
						<span class="material-symbols-outlined text-sm text-blue-400">how_to_vote</span>
						<span class="text-sm font-medium text-blue-300">Ready to vote?</span>
					</div>
					<div class="text-xs text-blue-200">Click anywhere on the chart to cast your vote</div>
				</div>
			{/if}

			<div class="mb-6 bg-orange-800/50 p-4">
				<h3 class="mb-4 text-lg font-semibold text-orange-200">Poll Statistics</h3>

				<!-- Basic Stats Grid -->
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div class=" bg-orange-800/30 p-3 text-center">
						<div class="text-2xl font-bold text-white">{pollData.stats.total_votes}</div>
						<div class="text-xs text-orange-300">Total Votes</div>
					</div>
					<div class=" bg-orange-800/30 p-3 text-center">
						<div class="text-lg font-bold text-white">
							{getResponseTypeName(pollData.response_type)}
						</div>
						<div class="text-xs text-orange-300">Response Type</div>
					</div>
				</div>

				{#if hasVotes}
					<!-- Central Tendency Measures -->
					<div class="mb-4">
						<div class="mb-2 text-sm font-semibold text-orange-200">Vote Distribution</div>
						<div class=" bg-orange-800/30 p-3">
							<div class="mb-2 text-sm font-bold text-white">
								{pollData.stats.average !== undefined
									? (pollData.stats.average * 100).toFixed(1)
									: '0'}% Average
							</div>
							<div class="mb-2 text-xs text-orange-300">
								Total Votes: {pollData.stats.total_votes}
							</div>
							{#if pollData.stats.std_dev !== undefined}
								<div class="text-xs text-orange-300">
									Consensus Level: {getConsensusLevel(pollData.stats.std_dev)}
								</div>
							{/if}
						</div>
					</div>

					<!-- Proximity to Options -->
					<div class="mb-4">
						<div class="mb-2 text-sm text-orange-200">Proximity to Options</div>
						<div class="space-y-2">
							{#each pollData.options as option, i (option)}
								{@const proximity =
									pollData.stats.option_proximity &&
									pollData.stats.option_proximity[i] !== undefined
										? pollData.stats.option_proximity[i] * 100
										: 0}
								<div class=" bg-orange-800/30 p-3">
									<div class="mb-1 flex items-center justify-between">
										<span class="text-sm break-words text-orange-100">{option}</span>
										<span class="text-sm font-bold">{proximity.toFixed(1)}%</span>
									</div>
									<div class="relative h-2 w-full bg-orange-900">
										<div class="absolute h-2 bg-orange-400" style="width: {proximity}%"></div>
									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- Confidence Interval -->
					{#if pollData.stats.total_votes > 1}
						{@const ci = calculateConfidenceInterval(
							pollData.stats.average,
							pollData.stats.std_dev,
							pollData.stats.total_votes
						)}
						<div class="mb-4">
							<div class="mb-2 text-sm text-orange-200">95% Confidence Interval</div>
							<div class="text-xs text-orange-300">
								{(ci.lower * 100).toFixed(1)}% - {(ci.upper * 100).toFixed(1)}%
							</div>
							<div class="relative mt-1 h-2 w-full bg-orange-900">
								<div
									class="absolute h-2 bg-orange-400/50"
									style="left: {ci.lower * 100}%; width: {(ci.upper - ci.lower) * 100}%"
								></div>
							</div>
						</div>
					{/if}

					<!-- 2D Statistics -->
					{#if pollData.stats.average_2d && pollData.response_type > 2}
						<div class="mb-4">
							<div class="mb-2 text-sm text-orange-200">2D Position Statistics</div>
							<div class="mb-3 grid grid-cols-2 gap-4">
								<div class=" bg-orange-800/30 p-3">
									<div class="mb-2 text-sm font-semibold text-orange-200">X-Axis</div>
									<div class="grid grid-cols-2 gap-2">
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{(pollData.stats.average_2d?.[0] !== undefined
													? pollData.stats.average_2d[0] * 100
													: 0
												).toFixed(1)}%
											</div>
											<div class="text-xs text-orange-300">Mean</div>
										</div>
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{pollData.stats.median_x !== null && pollData.stats.median_x !== undefined
													? (pollData.stats.median_x * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs text-orange-300">Median</div>
										</div>
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{pollData.stats.mode_x !== null && pollData.stats.mode_x !== undefined
													? (pollData.stats.mode_x * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs text-orange-300">Mode</div>
										</div>
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{pollData.stats.range_x !== null && pollData.stats.range_x !== undefined
													? (pollData.stats.range_x * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs text-orange-300">Range</div>
										</div>
									</div>
								</div>
								<div class=" bg-orange-800/30 p-3">
									<div class="mb-2 text-sm font-semibold text-orange-200">Y-Axis</div>
									<div class="grid grid-cols-2 gap-2">
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{(pollData.stats.average_2d?.[1] !== undefined
													? pollData.stats.average_2d[1] * 100
													: 0
												).toFixed(1)}%
											</div>
											<div class="text-xs text-orange-300">Mean</div>
										</div>
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{pollData.stats.median_y !== null && pollData.stats.median_y !== undefined
													? (pollData.stats.median_y * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs text-orange-300">Median</div>
										</div>
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{pollData.stats.mode_y !== null && pollData.stats.mode_y !== undefined
													? (pollData.stats.mode_y * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs text-orange-300">Mode</div>
										</div>
										<div class=" bg-orange-800/20 p-2 text-center">
											<div class="text-sm font-bold text-white">
												{pollData.stats.range_y !== null && pollData.stats.range_y !== undefined
													? (pollData.stats.range_y * 100).toFixed(1) + '%'
													: 'N/A'}
											</div>
											<div class="text-xs text-orange-300">Range</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}

				<!-- Poll Options-->
				<div class="mb-4">
					<div class="mb-2 text-sm text-orange-200">Response Options</div>
					<div class="space-y-2">
						{#each pollData.options as option, i (option)}
							<div class="flex items-center space-x-2 bg-orange-800/30 p-2">
								{#if pollData.gradients && pollData.gradients.colors && pollData.gradients.colors[i]}
									<div
										class="h-4 w-4 flex-shrink-0 border border-orange-300"
										style="background-color: {pollData.gradients.colors[i]}"
									></div>
								{/if}
								<span class="text-sm break-words text-orange-100">{option}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Comments Section -->
		<div class="mb-6 bg-orange-800/50 p-4">
			<h3 class="mb-4 text-lg font-semibold text-orange-200">Comments ({comments})</h3>

			<!-- Add Comment Form -->
			<div class="mb-4">
				<textarea
					bind:value={commentText}
					placeholder="Add a comment..."
					class="w-full border border-orange-700 bg-orange-800/30 px-3 py-2 text-white placeholder-orange-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
					rows="3"
					disabled={!$currentUser}
				></textarea>
				<div class="mt-2 flex items-center justify-between">
					{#if !$currentUser}
						<p class="text-xs text-orange-300">Sign in to comment</p>
					{:else}
						<p class="text-xs text-orange-300">{commentText.length}/500 characters</p>
					{/if}
					<button
						on:click={addComment}
						disabled={!$currentUser || !commentText.trim() || commentText.length > 500}
						class=" bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
					>
						Post
					</button>
				</div>
			</div>

			<!-- Comments List -->
			{#if commentsList.length > 0}
				<div class="space-y-4">
					{#each commentsList as comment (comment.id)}
						<div class=" bg-orange-800/30 p-3">
							<div class="mb-2 flex justify-between">
								<div class="flex items-center">
									{#if comment.userPhotoURL}
										<img
											src={comment.userPhotoURL}
											alt={comment.userDisplayName}
											class="mr-2 h-8 w-8"
										/>
									{:else}
										<div class="mr-2 flex h-8 w-8 items-center justify-center bg-orange-600">
											<span class="text-sm text-white"
												>{comment.userDisplayName?.charAt(0) || 'A'}</span
											>
										</div>
									{/if}
									<div>
										<div class="text-sm font-medium text-orange-200">{comment.userDisplayName}</div>
										<div class="text-xs text-orange-300">
											{comment.createdAt.toLocaleDateString('en-US', {
												month: 'short',
												day: 'numeric',
												year: 'numeric'
											})}
										</div>
									</div>
								</div>
								{#if $currentUser && ($currentUser.uid === comment.userId || $userGroup === 'dev')}
									<button
										on:click={() => deleteComment(comment.id)}
										class="text-orange-300 hover:text-orange-100"
										title="Delete comment"
									>
										<span class="material-symbols-outlined text-sm">delete</span>
									</button>
								{/if}
							</div>
							<p class="text-sm break-words whitespace-pre-wrap text-white">{comment.text}</p>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center text-orange-300">
					<p class="text-sm">No comments yet. Be the first to comment!</p>
				</div>
			{/if}
		</div>

		<!-- Bottom section with link and delete -->
		<div class="sticky bottom-0 mt-auto border-t border-orange-700 pt-4">
			<div class="flex items-end justify-between">
				<!-- Copyable link at bottom left -->
				<button
					class="flex-1 truncate pr-4 text-left text-sm text-orange-300 transition-colors hover:text-orange-200"
					on:click={copyLink}
					title="Click to copy link"
				>
					{shareUrl}
				</button>
			</div>
		</div>
	</div>
</div>
