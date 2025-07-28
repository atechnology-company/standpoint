<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';
	import Sidebar from '../../../components/sidebar.svelte';
	import ChartRenderer from '$lib/../components/chart-renderer.svelte';

	let poll: any = null;
	let loading = true;
	let error = '';
	export let params: { id: string };
	let pollId: string = params.id;

	import { get } from 'svelte/store';

	onMount(async () => {
		await loadPoll();
	});

	async function loadPoll() {
		try {
			loading = true;
			error = '';
			const numericPollId = parseInt(pollId, 10);
			poll = await apiClient.getPoll(String(numericPollId));
		} catch (err) {
			error = 'Failed to load poll. Make sure the backend server is running.';
			console.error('Error loading poll:', err);
		} finally {
			loading = false;
		}
	}

	async function vote(position: number, position2D?: { x: number; y: number }) {
		if (!poll) return;

		try {
			const voteData: any = { position };
			if (position2D && [3, 4, 5].includes(poll.response_type)) {
				voteData.position_2d = position2D;
			}

			await apiClient.vote(poll.id, position, voteData);
			await loadPoll();
		} catch (err) {
			console.error('Error voting:', err);
		}
	}

	async function deletePoll(pollId: string | number) {
		try {
			const numericPollId = typeof pollId === 'string' ? parseInt(pollId, 10) : pollId;
			await apiClient.deletePoll(String(numericPollId));
			window.location.href = '/polls';
		} catch (err) {
			console.error('Error deleting poll:', err);
			error = 'Failed to delete poll. Please try again.';
		}
	}

	function handleSidebarDelete(event: CustomEvent) {
		const { id, type } = event.detail;
		if (type === 'poll') {
			deletePoll(id);
		}
	}

	function renderChart(poll: any) {
		if (!poll) return null;

		const chartPoll = poll;
		const positions = chartPoll.stats.vote_positions || [];
		const positions2D = chartPoll.stats.vote_positions_2d || [];
		const average = chartPoll.stats.average;
		const average2D = chartPoll.stats.average_2d;
		const stdDev = chartPoll.stats.std_dev;

		return {
			poll: chartPoll,
			positions,
			positions2D,
			average,
			average2D,
			stdDev,
			lowerBound: Math.max(0, average - 1.5 * stdDev),
			upperBound: Math.min(1, average + 1.5 * stdDev)
		};
	}

	$: chartData = renderChart(poll);
</script>

<div class="flex min-h-screen bg-black">
	<!-- Main Chart Area -->
	<div class="h-screen flex-1 bg-black">
		{#if error}
			<div class="m-6 border border-red-500/40 bg-red-500/20 px-4 py-3 text-red-200">
				{error}
			</div>
		{/if}

		{#if loading}
			<div class="flex h-full items-center justify-center">
				<div class="text-center">
					<div class="inline-block h-8 w-8 animate-spin border-b-2 border-blue-500"></div>
					<p class="mt-2 text-white">Loading poll...</p>
				</div>
			</div>
		{:else if !poll}
			<div class="flex h-full items-center justify-center">
				<div class="text-center">
					<p class="text-white/70">Poll not found</p>
					<a href="/polls" class="mt-4 inline-block text-[#ff5705] hover:underline">
						← Back to polls
					</a>
				</div>
			</div>
		{:else if chartData}
			<div class="h-full w-full">
				<div class="relative h-full w-full overflow-hidden bg-white/5">
					<ChartRenderer {chartData} onVote={vote} />
				</div>
			</div>
		{/if}
	</div>

	<!-- Sidebar -->
	{#if poll}
		<div class="h-screen w-80 border-l border-white/20">
			<Sidebar pollId={poll.id} on:delete={handleSidebarDelete} />
		</div>
	{/if}
</div>
