<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$lib/api';
	import { savePollToFirestore, getPollsFromFirestore } from '$lib/firestore-polls-tierlists';
	import { getUserVote, saveUserVote, updatePollStatistics } from '$lib/poll-vote-functions';
	import { getAuth } from 'firebase/auth';
	import PollSidebar from '$lib/../components/poll-sidebar.svelte';
	import ChartRenderer from '$lib/../components/chart-renderer.svelte';
	import LoadingIndicator from '$lib/../components/loading-indicator.svelte';
	import PollForm from '$lib/../components/poll-form.svelte';
	import { linear } from 'svelte/easing';
	import { currentUser, userGroup } from '$lib/stores';
	import { addToast } from '$lib/toast';

	let polls: any[] = [];
	const LOCAL_STORAGE_POLLS_KEY = 'standpoint_local_polls';
	let loading = true;
	let error = '';
	let selectedPoll: any = null;
	let showSidebar = false;
	let showCreateModal = false;
	let showProUpgradeModal = false;
	let creating = false;
	let createError = '';
	let voteMessage = '';
	let showVoteToast = false;
	let chartData: any = null;
	let hadPreviousVote = false;
	let onVote = vote;

	type PollFormType = {
		title: string;
		responseType: number;
		customOptions: string[];
		gradients: { colors: string[]; enabled: boolean };
	};

	const defaultPoll: PollFormType = {
		title: '',
		responseType: 2,
		customOptions: ['Option A', 'Option B'],
		gradients: { colors: ['#ff5705', '#0066cc'], enabled: false }
	};

	let poll: PollFormType = { ...defaultPoll };

	const responseTypes = [
		{
			value: 2,
			label: 'Line Scale (2 options)',
			icon: '─',
			description: "It's a line, it has an option on each side."
		},
		{
			value: 3,
			label: 'Triangle (3 options)',
			icon: '△',
			description: "It's a triangle, great for three-way comparisons."
		},
		{
			value: 4,
			label: 'Square (4 options)',
			icon: '□',
			description: "It's a square, cool right?"
		},
		{
			value: 5,
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

				for (const poll of loadedPolls) {
					const userVote = await getUserVote(poll.id, auth.currentUser.uid);
					if (userVote) {
						poll.user_vote = userVote.position;
						poll.user_vote_2d = userVote.position_2d;
					}
				}
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
		// Only allow Pro users to create polls
		if ($userGroup === 'pro' || $userGroup === 'dev') {
			showCreateModal = true;
			resetPollForm();
		} else {
			addToast('Polls creation is a Pro feature. Upgrade to Pro to create polls!', 'warning');
			window.location.href = '/pro';
		}
	}

	function resetPollForm() {
		poll = {
			title: '',
			responseType: 2,
			customOptions: ['Option A', 'Option B'],
			gradients: { colors: ['#ff5705', '#0066cc'], enabled: false }
		};
	}

	function closeCreateModal() {
		showCreateModal = false;
	}

	function showVoteMessage(wasUpdate: boolean) {
		voteMessage = wasUpdate ? 'Vote updated!' : 'Vote recorded!';
		showVoteToast = true;
		setTimeout(() => {
			showVoteToast = false;
		}, 3000);
	}

	function updateOptionsForResponseType() {
		const targetCount = poll.responseType;

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
			const auth = getAuth();
			const hadPreviousVote =
				selectedPoll.user_vote !== undefined && selectedPoll.user_vote !== null;

			// For Firebase users, store vote persistently
			if (auth.currentUser) {
				await saveUserVote(selectedPoll.id, auth.currentUser.uid, position, position2D);
				await updatePollStatistics(selectedPoll.id);

				selectedPoll = {
					...selectedPoll,
					user_vote: position,
					user_vote_2d: position2D || null
				};

				const pollIndex = polls.findIndex((p) => p.id === selectedPoll.id);
				if (pollIndex !== -1) {
					polls[pollIndex] = {
						...polls[pollIndex],
						user_vote: position,
						user_vote_2d: position2D || null
					};
				}

				await loadPolls();
				selectedPoll = polls.find((p) => p.id === selectedPoll.id);
			} else {
				// Fallback to backend API for non-Firebase users
				const voteData: any = { position };
				const responseType = selectedPoll.response_type || selectedPoll.responseType;
				if (position2D && [3, 4, 5].includes(responseType)) {
					voteData.position_2d = position2D;
				}

				const voteResponse = await apiClient.vote(selectedPoll.id, position, voteData);

				if (
					voteResponse &&
					(voteResponse.user_vote !== undefined || voteResponse.user_vote_2d !== undefined)
				) {
					selectedPoll = {
						...selectedPoll,
						user_vote: voteResponse.user_vote,
						user_vote_2d: voteResponse.user_vote_2d
					};

					const pollIndex = polls.findIndex((p) => p.id === selectedPoll.id);
					if (pollIndex !== -1) {
						polls[pollIndex] = {
							...polls[pollIndex],
							user_vote: voteResponse.user_vote,
							user_vote_2d: voteResponse.user_vote_2d
						};
					}
				} else {
					await loadPolls();
					selectedPoll = polls.find((p) => p.id === selectedPoll.id);
				}
			}

			// Show feedback message
			showVoteMessage(hadPreviousVote);
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

			const auth = getAuth();
			const ownerId = auth.currentUser ? auth.currentUser.uid : null;
			const pollData = {
				title: poll.title,
				question: poll.title,
				response_type: poll.responseType,
				options: poll.customOptions,
				gradients: poll.gradients,
				owner: ownerId,
				stats: {
					total_votes: 0,
					average: 0,
					std_dev: 0,
					vote_positions: [],
					vote_positions_2d: [],
					average_2d: [0, 0]
				},
				created_at: new Date().toISOString()
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

		const chartPoll = {
			...poll,
			response_type: poll.response_type || poll.responseType || 1
		};

		// Ensure stats object exists with defaults
		const stats = chartPoll.stats || {
			vote_positions: [],
			vote_positions_2d: [],
			average: 0,
			average_2d: null, 
			std_dev: 0,
			total_votes: 0,
			median_x: 0,
			median_y: 0,
			mode_x: 0,
			mode_y: 0,
			range_x: 0,
			range_y: 0
		};

		const positions = stats.vote_positions || [];

		// Ensure positions2D is in the correct format for the chart renderer
		let positions2D: Array<{ x: number; y: number; id?: string }> = [];
		if (stats.vote_positions_2d && Array.isArray(stats.vote_positions_2d)) {
			console.log('Raw positions2D:', stats.vote_positions_2d);
			positions2D = stats.vote_positions_2d.map((pos: any, i: number) => {
				if (typeof pos === 'object' && pos !== null) {
					return {
						x: typeof pos.x === 'number' ? pos.x : 0.5,
						y: typeof pos.y === 'number' ? pos.y : 0.5,
						id: `vote-${i}`
					};
				}
				return { x: 0.5, y: 0.5, id: `vote-${i}` };
			});
			console.log('Processed positions2D:', positions2D);
		}

		const average = stats.average || 0;
		const average2D =
			stats.average_2d &&
			stats.average_2d.length === 2 &&
			(stats.average_2d[0] !== 0 || stats.average_2d[1] !== 0)
				? stats.average_2d
				: null;
		const stdDev = stats.std_dev || 0;

		// Get the new statistics
		const medianX = stats.median_x !== undefined ? stats.median_x : 0;
		const medianY = stats.median_y !== undefined ? stats.median_y : 0;
		const modeX = stats.mode_x || 0;
		const modeY = stats.mode_y || 0;
		const rangeX = stats.range_x || 0;
		const rangeY = stats.range_y || 0;

		return {
			poll: chartPoll,
			positions,
			positions2D,
			average,
			average2D,
			stdDev,
			medianX,
			medianY,
			modeX,
			modeY,
			rangeX,
			rangeY,
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
						<LoadingIndicator size="md" />
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
									{poll.response_type} options • {poll.stats?.total_votes || 0} votes
								</div>

								<div class="flex flex-wrap gap-2 overflow-hidden text-xs">
									{#each poll.options as option, i}
										<span
											class="flex flex-shrink-0 items-center space-x-1 bg-white/10 px-2 py-1 text-white/80"
										>
											{#if poll.gradients?.colors?.[i]}
												<div
													class="h-2 w-2 border border-white/30"
													style="background-color: {poll.gradients.colors[i]}"
												></div>
											{/if}
											<span class="font-normal text-white/50">{option}</span>
										</span>
									{/each}
								</div>

								{#if poll.stats?.total_votes && poll.stats.total_votes > 0}
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
		<div class="flex h-screen flex-1 items-center justify-center bg-black">
			{#if chartData}
				<div
					class="chart-container relative"
					style="height: 90vh; width: 90vh; max-width: calc(100vw - 476px); max-height: 90vh;"
				>
					<div class="relative h-full w-full overflow-hidden bg-white/5">
						<ChartRenderer {chartData} {onVote} />
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
			<PollSidebar pollData={selectedPoll} showComments={false} on:delete={handleSidebarDelete} />
		</div>
	{/if}

	<!-- Add Button -->
	{#if $userGroup === 'pro' || $userGroup === 'dev'}
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
	{/if}

	<!-- Create Poll Modal -->
	{#if showCreateModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-gray-800 p-8">
				<div class="mb-6 flex items-center justify-between">
					<h2 class="text-2xl font-bold text-white">Create New Poll</h2>
					<button class="text-2xl text-white/70 hover:text-white" on:click={closeCreateModal}>
						×
					</button>
				</div>

				{#if createError}
					<div class="mb-6 border border-red-500/40 bg-red-500/20 px-4 py-3 text-red-200">
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
						class="w-full border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#ff5705] focus:outline-none"
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
						created_at: '',
						owner: $currentUser?.uid || 'anonymous'
					}}
					{responseTypes}
					onUpdate={(updatedPoll) => (poll = updatedPoll)}
				/>

				<!-- Preview -->
				<div class="mb-8 bg-gray-700/50 p-6">
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
								<span class="flex items-center space-x-2 bg-white/10 px-3 py-1 text-white/80">
									<div
										class="h-3 w-3 border border-white/30"
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
							class="bg-gray-600 px-6 py-3 font-bold text-white transition-colors hover:bg-gray-700"
							on:click={closeCreateModal}>Cancel</button
						>
						<button
							class="bg-[#ff5705] px-6 py-3 font-bold text-white transition-colors hover:bg-[#ff5705]/80 disabled:opacity-50"
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

	<!-- Pro Upgrade Modal -->
	{#if showProUpgradeModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		>
			<div class="w-full max-w-md bg-gray-800 p-8">
				<div class="mb-6 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center bg-gradient-to-r from-[#ff5705] to-[#0066cc]"
					>
						<svg class="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							></path>
						</svg>
					</div>
					<h2 class="mb-2 text-2xl font-bold text-white">Upgrade to Pro</h2>
					<p class="text-white/70">Poll creation is a Pro feature</p>
				</div>

				<div class="mb-6 space-y-3">
					<div class="flex items-center space-x-3 text-white/80">
						<svg
							class="h-5 w-5 text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						<span>Create unlimited polls</span>
					</div>
					<div class="flex items-center space-x-3 text-white/80">
						<svg
							class="h-5 w-5 text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						<span>Advanced poll analytics</span>
					</div>
					<div class="flex items-center space-x-3 text-white/80">
						<svg
							class="h-5 w-5 text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						<span>Custom tier list themes</span>
					</div>
					<div class="flex items-center space-x-3 text-white/80">
						<svg
							class="h-5 w-5 text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							></path>
						</svg>
						<span>Priority support</span>
					</div>
				</div>

				<div class="flex space-x-3">
					<button
						class="flex-1 bg-gray-600 px-4 py-3 font-bold text-white transition-colors hover:bg-gray-700"
						on:click={() => (showProUpgradeModal = false)}
					>
						Maybe Later
					</button>
					<a
						href="/pro"
						class="flex-1 bg-gradient-to-r from-[#ff5705] to-[#0066cc] px-4 py-3 text-center font-bold text-white transition-all hover:from-[#ff5705]/80 hover:to-[#0066cc]/80"
					>
						Upgrade Now
					</a>
				</div>
			</div>
		</div>
	{/if}

	<!-- Vote Toast Notification -->
	{#if showVoteToast}
		<div
			class="fixed right-6 bottom-6 z-50 bg-green-600 px-4 py-3 text-white shadow-lg transition-all duration-300"
			class:translate-y-0={showVoteToast}
			class:translate-y-full={!showVoteToast}
		>
			<div class="flex items-center space-x-2">
				<span class="material-symbols-outlined text-lg">check_circle</span>
				<span class="font-medium">{voteMessage}</span>
			</div>
		</div>
	{/if}
</div>
