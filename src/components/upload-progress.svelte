<script lang="ts">
	export let progress: number = 0; // 0-100
	export let message: string = 'Uploading...';
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let show: boolean = true;

	const sizes = {
		sm: { bar: 'h-1', text: 'text-xs', container: 'p-2' },
		md: { bar: 'h-2', text: 'text-sm', container: 'p-4' },
		lg: { bar: 'h-3', text: 'text-base', container: 'p-6' }
	};

	$: sizeClasses = sizes[size];
	$: isComplete = progress >= 100;
</script>

{#if show}
	<div
		class="theme-transition fixed top-4 right-4 z-50 max-w-[400px] min-w-[300px] border shadow-2xl backdrop-blur-sm {sizeClasses.container}"
		style="border-color: var(--border); background-color: var(--surface);"
		role="status"
		aria-live="polite"
		aria-atomic="true"
	>
		<div class="flex items-center gap-3">
			{#if !isComplete}
				<div class="flex-shrink-0">
					<svg
						class="text-accent h-5 w-5 animate-spin"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				</div>
			{:else}
				<div class="flex-shrink-0">
					<svg
						class="h-5 w-5 text-[rgb(var(--success))]"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"
						></path>
					</svg>
				</div>
			{/if}

			<div class="flex-1">
				<p class="font-medium text-white {sizeClasses.text}">
					{message}
				</p>
				<div class="mt-2 w-full overflow-hidden bg-white/10 {sizeClasses.bar}">
					<div
						class="bg-accent h-full transition-all duration-300 ease-out"
						style="width: {progress}%"
					></div>
				</div>
				<p class="mt-1 text-xs text-white/60">
					{Math.round(progress)}%
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slideInRight {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	div[role='status'] {
		animation: slideInRight 0.3s ease-out;
	}
</style>
