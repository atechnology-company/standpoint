<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let title: string = '';
	export let date: string = '';
	export let author: string = 'Anonymous';
	export let revision: number = 1;
	export let shareUrl: string = '';
	export let type: 'poll' | 'tierlist' = 'tierlist';
	export let id: string | number = '';

	const dispatch = createEventDispatcher();

	function handleShare() {
		if (navigator.share && shareUrl) {
			navigator.share({
				title: title,
				url: shareUrl
			});
		} else if (shareUrl) {
			navigator.clipboard.writeText(shareUrl);
			// TODO - add a toast notification here
		}
	}

	function handleDelete() {
		if (confirm(`Are you sure you want to delete this ${type}? This action cannot be undone.`)) {
			dispatch('delete', { id, type });
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
</script>

<div class="flex h-full flex-col bg-orange-900 p-6 text-white">
	<!-- Header section -->
	<div class="mb-8">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-sm text-orange-300">{author}</span>
			<div class="flex items-center space-x-2 text-sm text-orange-300">
				social media items to go here
			</div>
		</div>
		<h1 class="mb-4 text-2xl font-bold">{title || 'TITLE'}</h1>

		<div class="mb-6 text-sm text-orange-300">
			{formatDate(date)} | REVISION {revision}
		</div>

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
			<span>Delete {type}</span>
		</button>
	</div>
</div>
