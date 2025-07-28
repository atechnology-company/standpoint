<script lang="ts">
	import type { PollResponse } from '../lib/api';
	import { tick, createEventDispatcher } from 'svelte';
	import { scale } from 'svelte/transition';
	import confetti from 'canvas-confetti';
	let likeBtn: HTMLButtonElement | null = null;

	export let title: string = '';
	export let date: string = '';
	export let author: string = 'Anonymous';
	export let revision: number = 1;
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let pollData: PollResponse | null = null;
	export let likes: number = 0;
	export let liked: boolean = false;

	let likeLoading = false;
	let likeAnim = false;
	let likeHover = false;
	let likeActive = false;
	let copied = false;

	// Fetch initial like count and liked state on mount
	import { onMount } from 'svelte';

	onMount(async () => {
		try {
			const res = await fetch(`/api/interactions/poll/${id}/likes`);
			if (res.ok) {
				const data = await res.json();
				likes = data.likes ?? 0;
			}
			// Optionally, fetch if the user has liked this poll (if backend supports)
			// liked = ...;
		} catch {
			likes = 0;
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
				// Only animate on like (not unlike)
				if (!liked) {
					likeAnim = false;
					await tick();
					likeAnim = true;
					if (likeBtn) {
						const rect = likeBtn.getBoundingClientRect();
						const x = (rect.left + rect.width / 2) / window.innerWidth;
						const y = (rect.top + rect.height / 2) / window.innerHeight;
						for (let i = 0; i < 12; i++) {
							confetti({
								particleCount: 4,
								spread: 360,
								angle: Math.random() * 360,
								origin: { x, y }
							});
						}
					} else {
						for (let i = 0; i < 12; i++) {
							confetti({
								particleCount: 4,
								spread: 120,
								angle: Math.random() * 360,
								origin: { y: 0.7 }
							});
						}
					}
				}
				liked = !liked;
			}
		} catch {
			// Optionally handle error
		} finally {
			likeLoading = false;
		}
	}

	// Remove infinite reactive loop: use a function instead

	const dispatch = createEventDispatcher();

	function handleDelete() {
		if (confirm(`Are you sure you want to delete this poll? This action cannot be undone.`)) {
			dispatch('delete', { id, type: 'poll' });
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

	function getVariabilityLevel(stdDev: number) {
		// Adjust thresholds based on poll type (more options = higher natural std dev)
		const responseType = pollData?.response_type || 2;
		let lowThreshold = 0.15;
		let mediumThreshold = 0.3;

		// Scale thresholds based on number of options
		if (responseType === 3) {
			// Triangle
			lowThreshold = 0.18;
			mediumThreshold = 0.35;
		} else if (responseType === 4) {
			// Square
			lowThreshold = 0.22;
			mediumThreshold = 0.4;
		} else if (responseType === 5) {
			// Pentagon
			lowThreshold = 0.25;
			mediumThreshold = 0.45;
		}

		if (stdDev < lowThreshold) return 'Low';
		if (stdDev < mediumThreshold) return 'Medium';
		return 'High';
	}

	function getConsensusLevel(stdDev: number) {
		// Adjust thresholds based on poll type (more options = higher natural std dev)
		const responseType = pollData?.response_type || 2;
		let strongThreshold = 0.1;
		let moderateThreshold = 0.2;
		let weakThreshold = 0.3;

		// Scale thresholds based on number of options
		if (responseType === 3) {
			// Triangle
			strongThreshold = 0.12;
			moderateThreshold = 0.25;
			weakThreshold = 0.35;
		} else if (responseType === 4) {
			// Square
			strongThreshold = 0.15;
			moderateThreshold = 0.3;
			weakThreshold = 0.4;
		} else if (responseType === 5) {
			// Pentagon
			strongThreshold = 0.18;
			moderateThreshold = 0.35;
			weakThreshold = 0.45;
		}

		if (stdDev < strongThreshold) return 'Strong Consensus';
		if (stdDev < moderateThreshold) return 'Moderate Consensus';
		if (stdDev < weakThreshold) return 'Weak Consensus';
		return 'No Consensus';
	}

	function getEngagementLevel(totalVotes: number) {
		if (totalVotes < 5) return 'Low';
		if (totalVotes < 20) return 'Medium';
		return 'High';
	}

	function calculateMedian(votes: number[]) {
		const sorted = [...votes].sort((a, b) => a - b);
		const middle = Math.floor(sorted.length / 2);
		if (sorted.length % 2 === 0) {
			return (sorted[middle - 1] + sorted[middle]) / 2;
		}
		return sorted[middle];
	}

	function calculateMode(votes: number[]) {
		const frequency: Record<number, number> = {};
		let maxFreq = 0;
		let mode = null;

		votes.forEach((vote) => {
			const rounded = Math.round(vote * 10) / 10; // Round to 1 decimal
			frequency[rounded] = (frequency[rounded] || 0) + 1;
			if (frequency[rounded] > maxFreq) {
				maxFreq = frequency[rounded];
				mode = rounded;
			}
		});

		return mode;
	}

	function copyLink() {
		navigator.clipboard.writeText(shareUrl);
		copied = true;
	}

	$: hasVotes = (pollData?.stats?.total_votes ?? 0) > 0;
	$: votes = pollData?.stats?.vote_positions || [];
	$: median = hasVotes ? calculateMedian(votes) : 0;
	$: mode = hasVotes ? calculateMode(votes) : 0;
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
					disabled={likeLoading}
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
							in:scale={{ duration: 200, start: 0.7 }}
							class="material-symbols-outlined text-lg transition-colors select-none"
							style="color: #ff5705; font-family: 'Material Symbols Outlined' !important; font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important; transition: transform 0.12s cubic-bezier(.4,2,.6,1); transform: scale({likeActive
								? 0.96
								: likeHover
									? 1.08
									: 1});"
						>
							favorite
						</span>
					{:else}
						<span
							class="material-symbols-outlined text-lg transition-colors select-none"
							style="color: {liked
								? '#ff5705'
								: ''}; font-family: 'Material Symbols Outlined' !important; font-variation-settings: 'FILL' {liked
								? 1
								: 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24 !important; transition: transform 0.12s cubic-bezier(.4,2,.6,1); transform: scale({likeActive
								? 0.96
								: likeHover
									? 1.08
									: 1});"
						>
							favorite
						</span>
					{/if}
					<span class="text-xs">{likes}</span>
					<style>
						.material-symbols-outlined.fill {
							color: #ff5705 !important;
						}
						.group:hover .material-symbols-outlined,
						.material-symbols-outlined-filled:hover,
						.group:hover .material-symbols-outlined-filled {
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
		<h1 class="mb-4 text-2xl font-bold break-words">{title || 'TITLE'}</h1>

		<div class="mb-6 text-sm text-orange-300">
			{formatDate(date)} | REVISION {revision}
		</div>

		<!-- Poll Statistics Section -->
		{#if pollData}
			<div class="mb-6 rounded-lg bg-orange-800/50 p-4">
				<h3 class="mb-4 text-lg font-semibold text-orange-200">Poll Statistics</h3>

				<!-- Basic Stats Grid -->
				<div class="mb-6 grid grid-cols-2 gap-4">
					<div class="rounded-lg bg-orange-800/30 p-3 text-center">
						<div class="text-2xl font-bold text-white">{pollData.stats.total_votes}</div>
						<div class="text-xs text-orange-300">Total Votes</div>
					</div>
					<div class="rounded-lg bg-orange-800/30 p-3 text-center">
						<div class="text-lg font-bold text-white">
							{getResponseTypeName(pollData.response_type)}
						</div>
						<div class="text-xs text-orange-300">Response Type</div>
					</div>
				</div>

				{#if hasVotes}
					<!-- Average Position -->
					<div class="mb-4">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm text-orange-200">Average Position</span>
							<span class="text-sm font-bold text-white"
								>{(pollData.stats.average * 100).toFixed(1)}%</span
							>
						</div>
						<div class="relative h-3 w-full rounded-full bg-orange-900">
							<div
								class="h-3 rounded-full bg-orange-300 transition-all duration-300"
								style="width: {pollData.stats.average * 100}%"
							></div>
							<div
								class="absolute top-0 h-3 w-1 rounded-full bg-white"
								style="left: {pollData.stats.average * 100}%"
							></div>
						</div>
					</div>

					<!-- Central Tendency Measures -->
					<div class="mb-4 grid grid-cols-3 gap-3">
						<div class="rounded bg-orange-800/30 p-2 text-center">
							<div class="text-sm font-bold text-white">
								{(pollData.stats.average * 100).toFixed(1)}%
							</div>
							<div class="text-xs text-orange-300">Mean</div>
						</div>
						<div class="rounded bg-orange-800/30 p-2 text-center">
							<div class="text-sm font-bold text-white">{(median * 100).toFixed(1)}%</div>
							<div class="text-xs text-orange-300">Median</div>
						</div>
						<div class="rounded bg-orange-800/30 p-2 text-center">
							<div class="text-sm font-bold text-white">
								{mode !== null ? (mode * 100).toFixed(1) + '%' : 'N/A'}
							</div>
							<div class="text-xs text-orange-300">Mode</div>
						</div>
					</div>

					<!-- Variability & Consensus -->
					<div class="mb-4">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm text-orange-200">Consensus Level</span>
							<span class="text-sm font-bold text-white"
								>{getConsensusLevel(pollData.stats.std_dev)}</span
							>
						</div>
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm text-orange-200">Variability</span>
							<span class="text-sm font-bold text-white"
								>{getVariabilityLevel(pollData.stats.std_dev)}</span
							>
						</div>
						<div class="text-xs text-orange-300">
							Standard Deviation: {pollData.stats.std_dev.toFixed(3)}
						</div>
					</div>

					<!-- Engagement -->
					<div class="mb-4">
						<div class="mb-2 flex items-center justify-between">
							<span class="text-sm text-orange-200">Engagement</span>
							<span class="text-sm font-bold text-white"
								>{getEngagementLevel(pollData.stats.total_votes)}</span
							>
						</div>
						<div class="text-xs text-orange-300">
							{pollData.stats.total_votes}
							{pollData.stats.total_votes === 1 ? 'response' : 'responses'}
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
							<div class="relative mt-1 h-2 w-full rounded-full bg-orange-900">
								<div
									class="absolute h-2 rounded-full bg-orange-400/50"
									style="left: {ci.lower * 100}%; width: {(ci.upper - ci.lower) * 100}%"
								></div>
							</div>
						</div>
					{/if}

					<!-- 2D Statistics (if available) -->
					{#if pollData.stats.average_2d && pollData.response_type > 2}
						<div class="mb-4">
							<div class="mb-2 text-sm text-orange-200">2D Average Position</div>
							<div class="grid grid-cols-2 gap-2">
								<div class="rounded bg-orange-800/30 p-2 text-center">
									<div class="text-sm font-bold text-white">
										{(pollData.stats.average_2d?.[0]
											? pollData.stats.average_2d[0] * 100
											: 0
										).toFixed(1)}%
									</div>
									<div class="text-xs text-orange-300">X-Axis</div>
								</div>
								<div class="rounded bg-orange-800/30 p-2 text-center">
									<div class="text-sm font-bold text-white">
										{(pollData.stats.average_2d?.[1]
											? pollData.stats.average_2d[1] * 100
											: 0
										).toFixed(1)}%
									</div>
									<div class="text-xs text-orange-300">Y-Axis</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}

				<!-- Poll Options with Colors -->
				<div class="mb-4">
					<div class="mb-2 text-sm text-orange-200">Response Options</div>
					<div class="space-y-2">
						{#each pollData.options as option, i (option)}
							<div class="flex items-center space-x-2 rounded bg-orange-800/30 p-2">
								{#if pollData.gradients && pollData.gradients.colors && pollData.gradients.colors[i]}
									<div
										class="h-4 w-4 flex-shrink-0 rounded border border-orange-300"
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

		<!-- Bottom Bar: Share Link (left) and Delete Icon (right) -->
		<div class="mt-auto flex items-center justify-between pt-4">
			<!-- Share Link (copies to clipboard on click) -->
			{#if shareUrl}
				<button
					type="button"
					class="flex cursor-pointer items-center space-x-2 border-0 bg-transparent p-0 text-orange-200 transition-colors hover:text-orange-100"
					title="Click to copy link"
					on:click={() => {
						copyLink();
					}}
					tabindex="0"
				>
					<span class="material-symbols-outlined align-middle text-base"
						>{copied ? 'check' : 'link'}</span
					>
					<span class="text-xs break-all">{shareUrl}</span>
				</button>
			{/if}

			<!-- Delete Icon (right) -->
			<button
				type="button"
				class="group flex cursor-pointer items-center border-0 bg-transparent p-0"
				title="Delete Poll"
				on:click={handleDelete}
				tabindex="0"
				on:keydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						handleDelete();
					}
				}}
			>
				<span
					class="material-symbols-outlined text-2xl text-orange-300 transition-colors select-none group-hover:text-red-600"
				>
					delete
				</span>
			</button>
		</div>
	</div>
</div>
