<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let title: string = '';
	export let date: string = '';
	export let author: string = 'Anonymous';
	export let revision: number = 1;
	export let shareUrl: string = '';
	export let id: string | number = '';
	export let pollData: any = null;

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

	$: hasVotes = pollData?.stats?.total_votes > 0;
	$: votes = pollData?.stats?.vote_positions || [];
	$: median = hasVotes ? calculateMedian(votes) : 0;
	$: mode = hasVotes ? calculateMode(votes) : 0;
</script>

<div class="flex h-full flex-col overflow-y-auto bg-orange-900 p-6 text-white">
	<!-- Header section -->
	<div class="mb-6">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm text-orange-300">{author}</span>
			<div class="flex items-center space-x-2 text-sm text-orange-300">
				<span>📊</span>
				<span>💬</span>
				<span>🔗</span>
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
										{(pollData.stats.average_2d[0] * 100).toFixed(1)}%
									</div>
									<div class="text-xs text-orange-300">X-Axis</div>
								</div>
								<div class="rounded bg-orange-800/30 p-2 text-center">
									<div class="text-sm font-bold text-white">
										{(pollData.stats.average_2d[1] * 100).toFixed(1)}%
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
						{#each pollData.options as option, i}
							<div class="flex items-center space-x-2 rounded bg-orange-800/30 p-2">
								{#if pollData.gradients?.colors?.[i]}
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
			<span>Share Poll</span>
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
			<span>Delete Poll</span>
		</button>
	</div>
</div>
