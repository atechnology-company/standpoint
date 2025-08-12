<script lang="ts">
	export let size: 'sm' | 'md' | 'lg' = 'md';

	const sizes = {
		sm: { container: 'h-6', bars: ['w-2', 'w-3', 'w-4'] },
		md: { container: 'h-10', bars: ['w-4', 'w-6', 'w-8'] },
		lg: { container: 'h-16', bars: ['w-6', 'w-9', 'w-12'] }
	};
</script>

<div class="flex items-center justify-center {sizes[size].container}">
	<div class="flex flex-col items-end justify-center gap-1">
		<div
			class="h-2 bg-gray-300 transition-all duration-500 {sizes[size]
				.bars[0]} animate-pulse-accent-1"
		></div>
		<div
			class="h-2 bg-gray-300 transition-all duration-500 {sizes[size]
				.bars[1]} animate-pulse-accent-2"
		></div>
		<div
			class="h-2 bg-gray-300 transition-all duration-500 {sizes[size]
				.bars[2]} animate-pulse-accent-3"
		></div>
	</div>
</div>

<style>
	@keyframes pulse-accent {
		0%,
		60%,
		100% {
			background-color: rgb(209, 213, 219);
		}
		30% {
			background-color: rgb(var(--primary));
		}
	}

	:global(.animate-pulse-accent-1) {
		animation: pulse-accent 1.5s ease-in-out infinite;
		animation-delay: 0s;
	}

	:global(.animate-pulse-accent-2) {
		animation: pulse-accent 1.5s ease-in-out infinite;
		animation-delay: 0.5s;
	}

	:global(.animate-pulse-accent-3) {
		animation: pulse-accent 1.5s ease-in-out infinite;
		animation-delay: 1s;
	}
</style>
