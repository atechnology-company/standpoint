<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';
	import { savePollToFirestore, getPollsFromFirestore } from '$lib/firestore-polls-tierlists';
	import { getAuth } from 'firebase/auth';
	import PollSidebar from '$lib/../components/poll-sidebar.svelte';
	import ChartRenderer from '$lib/../components/chart-renderer.svelte';
	import PollForm from '$lib/../components/poll-form.svelte';
	import { linear } from 'svelte/easing';

	let polls: any[] = [];
	const LOCAL_STORAGE_POLLS_KEY = 'standpoint_local_polls';
	let loading = true;
	let error = '';
	let selectedPoll: any = null;
	let showSidebar = false;
	let showCreateModal = false;
	let creating = false;
	let createError = '';

	type PollFormType = {
		title: string;
		responseType: number;
		customOptions: string[];
		gradients: { colors: string[]; enabled: boolean };
	};

	const defaultPoll: PollFormType = {
		title: '',
		responseType: 0,
		customOptions: ['Option A', 'Option B'],
		gradients: { colors: ['#ff5705', '#0066cc'], enabled: false }
	};

	let poll: PollFormType = { ...defaultPoll };

	const responseTypes = [
		{
			value: 0,
			label: 'Line Scale (2 options)',
			icon: '─',
			description: "It's a line, it has an option on each side."
		},
		{
			value: 1,
			label: 'Triangle (3 options)',
			icon: '△',
			description: "It's a triangle, great for three-way comparisons."
		},
		{
			value: 2,
			label: 'Square (4 options)',
			icon: '□',
			description: "It's a square, cool right?"
		},
		{
			value: 3,
			label: 'Pentagon (5 options)',
			icon: '⬟',
			description: "It's a pentagon, so many options to choose from!"
		}
	];

	onMount(async () => {
		await loadPolls();
	});

	async function loadPolls() {
		try {
			loading = true;
			error = '';
			const auth = getAuth();
			let loadedPolls = [];
			if (auth.currentUser) {
				loadedPolls = await getPollsFromFirestore();
			} else {
				const localPolls = localStorage.getItem(LOCAL_STORAGE_POLLS_KEY);
				loadedPolls = localPolls ? JSON.parse(localPolls) : [];
			}
			polls = loadedPolls;
		} catch (err) {
			error = 'Failed to load polls. Make sure the backend server is running.';
			console.error('Error loading polls:', err);
		} finally {
			loading = false;
		}
	}

	function handlePollClick(poll: any) {
		selectedPoll = poll;
		showSidebar = true;
	}

	function openCreateModal() {
		showCreateModal = true;
		resetPollForm();
		createError = '';
	}

	function resetPollForm() {
		poll = {
			title: '',
			responseType: 0,
			customOptions: ['Option A', 'Option B'],
			gradients: { colors: ['#ff5705', '#0066cc'], enabled: false }
		};
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	function updateOptionsForResponseType() {
		const optionCounts = [2, 3, 4, 5];
		const targetCount = optionCounts[poll.responseType];

		let newCustomOptions = [...poll.customOptions];
		let newColors = [...poll.gradients.colors];

		if (newCustomOptions.length < targetCount) {
			for (let i = newCustomOptions.length; i < targetCount; i++) {
				newCustomOptions.push(`Option ${String.fromCharCode(65 + i)}`);
			}
		} else {
			newCustomOptions = newCustomOptions.slice(0, targetCount);
		}

		const defaultColors = ['#ff5705', '#0066cc', '#00ff88', '#ff4488', '#ffaa00'];
		while (newColors.length < targetCount) {
			newColors.push(defaultColors[newColors.length % defaultColors.length]);
		}
		newColors = newColors.slice(0, targetCount);

		poll = {
			...poll,
			customOptions: newCustomOptions,
			gradients: {
				...poll.gradients,
				colors: newColors
			}
		};
	}

	function updateOption(index: number, value: string) {
		const newCustomOptions = [...poll.customOptions];
		newCustomOptions[index] = value;
		poll = {
			...poll,
			customOptions: newCustomOptions
		};
	}

	async function vote(position: number, position2D?: { x: number; y: number }) {
		if (!selectedPoll) return;

		try {
			const voteData: any = { position };
			if (position2D && [3, 4, 5].includes(selectedPoll.response_type)) {
				voteData.position_2d = position2D;
			}

			await apiClient.vote(selectedPoll.id, position, voteData);
			await loadPolls();
			selectedPoll = polls.find((p) => p.id === selectedPoll.id);
		} catch (err) {
			console.error('Error voting:', err);
		}
	}

	$: if (poll.responseType) {
		updateOptionsForResponseType();
	}

	async function deletePoll(pollId: string | number) {
		try {
			const pollIdStr = typeof pollId === 'string' ? pollId : String(pollId);
			await apiClient.deletePoll(pollIdStr);
			await loadPolls();

			if (selectedPoll?.id === pollId) {
				selectedPoll = null;
				showSidebar = false;
			}
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

	async function createPoll() {
		try {
			creating = true;
			createError = '';

			if (!poll.title.trim()) {
				createError = 'Please provide a title';
				return;
			}

			const optionCounts = [2, 3, 4, 5];
			const auth = getAuth();
			const ownerId = auth.currentUser ? auth.currentUser.uid : null;
			const pollData = {
				title: poll.title,
				question: poll.title, 
				response_type: optionCounts[poll.responseType],
				options: poll.customOptions,
				gradients: poll.gradients,
				owner: ownerId
			};
			let newPollId;
			if (auth.currentUser) {
				newPollId = await savePollToFirestore(pollData);
				// Sync any local polls to Firebase
				const localPolls = localStorage.getItem(LOCAL_STORAGE_POLLS_KEY);
				if (localPolls) {
					const pollsArr = JSON.parse(localPolls);
					for (const localPoll of pollsArr) {
						if (!localPoll.owner) {
							await savePollToFirestore({ ...localPoll, owner: ownerId });
						}
					}
					localStorage.removeItem(LOCAL_STORAGE_POLLS_KEY);
				}
			} else {
				// Save to localStorage
				const localPolls = localStorage.getItem(LOCAL_STORAGE_POLLS_KEY);
				const pollsArr = localPolls ? JSON.parse(localPolls) : [];
				newPollId = Date.now().toString();
				pollsArr.push({ id: newPollId, ...pollData });
				localStorage.setItem(LOCAL_STORAGE_POLLS_KEY, JSON.stringify(pollsArr));
			}
			await loadPolls();
			selectedPoll = polls.find((p) => p.id === newPollId);
			showSidebar = true;
			closeCreateModal();
		} catch (err) {
			createError = 'Failed to create poll';
			console.error('Error creating poll:', err);
		} finally {
			creating = false;
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

	$: chartData = renderChart(selectedPoll);
</script>

<div class="flex min-h-screen bg-black">
	<!-- Poll List / Chart Area -->
	<div class="flex flex-1">
		<div class="h-screen w-96 bg-black">
			<div class="h-full overflow-y-auto">
				{#if error}
					<div class="mb-4 border border-red-500/40 bg-red-500/20 px-4 py-3 text-red-200">
						{error}
					</div>
				{/if}

				{#if loading}
					<div class="py-8 text-center">
						<div class="inline-block h-8 w-8 animate-spin border-b-2 border-blue-500"></div>
						<p class="mt-2 text-white">Loading polls...</p>
					</div>
				{:else if polls.length === 0}
					<div class="py-8 text-center">
						<p class="text-white/70">No polls yet. Create the first one!</p>
					</div>
				{:else}
					<div class="overflow-hidden">
						{#each polls as poll}
							<div
								class="cursor-pointer border-2 border-transparent bg-white/10 p-6 backdrop-blur transition-all duration-300 hover:border-[#ff5705] hover:bg-white/20"
								class:!bg-[#ff5705]={selectedPoll?.id === poll.id}
								on:click={() => handlePollClick(poll)}
								on:keydown={(e) => e.key === 'Enter' && handlePollClick(poll)}
								role="button"
								tabindex="0"
							>
								<h3 class="mb-2 text-xl font-bold text-white">{poll.title}</h3>
								<div class="mb-4 text-sm text-white/70">
									{poll.response_type} options • {poll.stats.total_votes} votes
								</div>

								<div class="flex flex-wrap gap-2 overflow-hidden text-xs">
									{#each poll.options as option, i}
										<span
											class="flex flex-shrink-0 items-center space-x-1 rounded bg-white/10 px-2 py-1 text-white/80"
										>
											{#if poll.gradients?.colors?.[i]}
												<div
													class="h-2 w-2 rounded-full border border-white/30"
													style="background-color: {poll.gradients.colors[i]}"
												></div>
											{/if}
											<span class="font-normal text-white/50">{option}</span>
										</span>
									{/each}
								</div>

								{#if poll.stats.total_votes > 0}
									<div class="mt-4 text-sm text-white/60">
										Avg: {(poll.stats.average * 100).toFixed(1)}%
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Chart Area -->
		<div class="h-screen flex-1 bg-black">
			{#if chartData}
				<div class="h-full w-full">
					<div class="relative h-full w-full overflow-hidden bg-white/5">
						<ChartRenderer {chartData} onVote={vote} />
					</div>
				</div>
			{:else}
				<div class="flex h-full w-full items-center justify-center">
					<p class="text-s text-white/50">Select a poll to view details</p>
				</div>
			{/if}
		</div>
	</div>

	<!-- Sidebar -->
	{#if selectedPoll && showSidebar}
		<div class="h-screen w-80 border-l border-white/20 bg-gray-900">
			<PollSidebar
				title={selectedPoll.title}
				date={selectedPoll.created_at}
				author="Community"
				revision={1}
				shareUrl={`${window.location.origin}/polls/view?id=${selectedPoll.id}`}
				id={selectedPoll.id}
				pollData={selectedPoll}
				on:delete={handleSidebarDelete}
			/>
		</div>
	{/if}

	<!-- Add Button -->
	<button
		class="fixed bottom-6 left-6 z-50 flex h-16 w-16 items-center justify-center bg-[#ff5705] text-2xl font-bold text-white shadow-lg transition-all duration-300 hover:bg-white hover:text-[#ff5705]"
		on:click={openCreateModal}
		aria-label="Create new poll"
	>
		<svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
			></path>
		</svg>
	</button>

	<!-- Create Poll Modal -->
	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-gray-800 p-8">
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-white">Create New Poll</h2>
					<button class="text-2xl text-white/70 hover:text-white" on:click={closeCreateModal}>
						×
					</button>
				</div>

				{#if createError}
					<div class="mb-6 rounded border border-red-500/40 bg-red-500/20 px-4 py-3 text-red-200">
						{createError}
					</div>
				{/if}

				<!-- Title -->
				<div class="mb-6">
					<label for="poll-title" class="mb-2 block text-sm font-medium text-white/90"
						>Poll Title *</label
					>
					<input
						id="poll-title"
						class="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#ff5705] focus:outline-none"
						type="text"
						bind:value={poll.title}
						placeholder="What would you like people to vote on?"
					/>
				</div>

				<!-- Poll Form Component -->
				<PollForm
					poll={{
						...poll,
						id: '',
						response_type: poll.responseType,
						options: poll.customOptions,
						stats: { average: 0, std_dev: 0, total_votes: 0, vote_positions: [] },
						user_vote: undefined,
						created_at: ''
					}}
					{responseTypes}
					onUpdate={(updatedPoll) => (poll = updatedPoll)}
				/>

				<!-- Preview -->
				<div class="mb-8 rounded-lg bg-gray-700/50 p-6">
					<h3 class="mb-4 text-lg font-medium text-white">Preview</h3>
					<div class="space-y-3">
						<div class="text-xl font-bold text-white">
							{poll.title || 'Your poll title will appear here'}
						</div>
						<div class="text-sm text-white/50 italic">Click anywhere on the chart to vote</div>
						<div class="flex items-center space-x-2 text-sm text-white/60">
							<span>{responseTypes.find((t) => t.value === poll.responseType)?.icon}</span>
							<span>{responseTypes.find((t) => t.value === poll.responseType)?.label}</span>
						</div>
						<div class="flex flex-wrap gap-2 text-xs">
							{#each poll.customOptions as option, index}
								<span
									class="flex items-center space-x-2 rounded bg-white/10 px-3 py-1 text-white/80"
								>
									<div
										class="h-3 w-3 rounded-full border border-white/30"
										style="background-color: {poll.gradients.colors[index]}"
									></div>
									<span>{option}</span>
								</span>
							{/each}
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="flex items-center justify-between">
					<div class="flex space-x-3">
						<button
							class="rounded-lg bg-gray-600 px-6 py-3 font-bold text-white transition-colors hover:bg-gray-700"
							on:click={closeCreateModal}>Cancel</button
						>
						<button
							class="rounded-lg bg-[#ff5705] px-6 py-3 font-bold text-white transition-colors hover:bg-[#ff5705]/80 disabled:opacity-50"
							on:click={createPoll}
							disabled={creating || !poll.title.trim()}
						>
							{creating ? 'Creating...' : 'Create Poll'}
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
