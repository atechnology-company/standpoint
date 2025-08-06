<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	$: error = $page.error;
	$: status = $page.status;
</script>

<svelte:head>
	<title>{status} - Standpoint</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-black px-4">
	<div class="mx-auto max-w-md text-center">
		<div class="mb-8">
			<div class="mb-4 text-6xl font-bold text-white">{status}</div>
			<h1 class="mb-4 text-2xl font-bold text-white">
				{#if status === 404}
					Page Not Found
				{:else if status === 500}
					Server Error
				{:else if status === 403}
					Access Denied
				{:else}
					Something went wrong
				{/if}
			</h1>
			<p class="mb-8 text-gray-400">
				{#if status === 404}
					{#if $page.url.pathname.includes('/user/')}
						This user profile doesn't exist or has been removed.
					{:else}
						The page you're looking for doesn't exist.
					{/if}
				{:else if status === 500}
					We're experiencing technical difficulties. Please try again later.
				{:else if status === 403}
					You don't have permission to access this page.
				{:else}
					{error?.message || 'An unexpected error occurred.'}
				{/if}
			</p>
		</div>

		<div class="space-y-4">
			<button
				on:click={() => history.back()}
				class="w-full border border-gray-700 bg-gray-800 px-6 py-3 font-medium text-white transition-colors hover:bg-gray-700"
			>
				Go Back
			</button>
			<button
				on:click={() => goto('/')}
				class="w-full bg-white px-6 py-3 font-medium text-black transition-colors hover:bg-gray-100"
			>
				Return Home
			</button>
		</div>

		{#if status === 404 && $page.url.pathname.includes('/user/')}
			<div class="mt-8 border border-gray-800 bg-gray-900 p-4">
				<p class="mb-2 text-sm text-gray-400">Looking for someone specific?</p>
				<button
					on:click={() => goto('/search')}
					class="text-sm text-white underline hover:text-gray-300"
				>
					Try searching for users
				</button>
			</div>
		{/if}
	</div>
</div>
