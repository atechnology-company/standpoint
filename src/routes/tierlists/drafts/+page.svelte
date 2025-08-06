<script lang="ts">
	import { onMount } from 'svelte';
	import { getDrafts, deleteDraft, type TierListDraft } from '$lib/draft-autosave';
	import { addToast } from '$lib/toast';
	import Toast from '$lib/../components/toast.svelte';

	let drafts: TierListDraft[] = [];

	onMount(() => {
		drafts = getDrafts();
	});

	function handleDeleteDraft(id: string) {
		if (confirm('Are you sure you want to delete this draft?')) {
			deleteDraft(id);
			drafts = getDrafts();
			addToast('Draft deleted successfully', 'success');
		}
	}

	function formatDate(timestamp: number) {
		return new Date(timestamp).toLocaleString();
	}

	function getItemCount(draft: TierListDraft) {
		const tierItems = draft.tiers.reduce((count, tier) => count + tier.items.length, 0);
		return tierItems + draft.unassignedItems.length;
	}
</script>

<svelte:head>
	<title>Drafts - Standpoint</title>
</svelte:head>

<div class="min-h-screen bg-black text-white">
	<div class="container mx-auto max-w-4xl px-6 py-8">
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold">Tier List Drafts</h1>
			<p class="text-gray-400">
				Your automatically saved tier list drafts. Drafts are saved every 10 seconds while you work.
			</p>
		</div>

		{#if drafts.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<div class="mb-4 text-6xl">📝</div>
				<h2 class="mb-2 text-xl font-semibold text-gray-300">No drafts yet</h2>
				<p class="mb-6 text-gray-500">
					Start creating a tier list and your progress will be automatically saved here.
				</p>
				<a
					href="/tierlists/create"
					class="bg-orange-500 px-6 py-3 font-bold text-white transition-colors hover:bg-orange-600"
				>
					Create Tier List
				</a>
			</div>
		{:else}
			<div class="space-y-4">
				{#each drafts as draft (draft.id)}
					<div class="border border-gray-700 bg-gray-900 p-6">
						<div class="flex items-start justify-between">
							<div class="flex-1">
								<h3 class="mb-2 text-xl font-semibold">{draft.title}</h3>
								<div class="mb-3 flex flex-wrap gap-4 text-sm text-gray-400">
									<span>📊 {draft.type === 'classic' ? 'Classic' : 'Dynamic'} mode</span>
									<span>🔖 {draft.tiers.length} tiers</span>
									<span>📦 {getItemCount(draft)} items</span>
									<span>💾 Saved {formatDate(draft.lastSaved)}</span>
								</div>
								{#if draft.bannerImage}
									<div class="mb-3">
										<img src={draft.bannerImage} alt="Banner" class="h-16 w-32 object-cover" />
									</div>
								{/if}
								<div class="flex flex-wrap gap-2">
									{#each draft.tiers as tier}
										<span
											class="px-2 py-1 text-xs font-medium text-white"
											style="background-color: {tier.color};"
										>
											{tier.name} ({tier.items.length})
										</span>
									{/each}
								</div>
							</div>
							<div class="ml-4 flex flex-col gap-2">
								<a
									href="/tierlists/create?draft={draft.id}"
									class="bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600"
								>
									Continue Editing
								</a>
								<button
									class="bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
									on:click={() => handleDeleteDraft(draft.id)}
								>
									Delete
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<Toast />
