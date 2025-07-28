<script context="module" lang="ts">
	export type ResponseTypeOption = {
		value: number;
		icon: string;
		label: string;
		description: string;
	};
</script>

<script lang="ts">
	import type { PollResponse } from '../lib/api';

	export let poll: PollResponse & {
		customOptions: string[];
		gradients: {
			colors: string[];
			enabled: boolean;
		};
		responseType: number;
	};
	export let onUpdate: (updatedPoll: typeof poll) => void;
	export let responseTypes: ResponseTypeOption[];

	const colorSchemes = [
		{ name: 'Warm/Cool', colors: ['#ff5705', '#0066cc', '#00ff88', '#ff4488', '#ffaa00'] },
		{ name: 'RGB Primary', colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff'] },
		{ name: 'Modern', colors: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'] },
		{ name: 'Sunset', colors: ['#fbbf24', '#f59e0b', '#d97706', '#92400e', '#451a03'] }
	];

	function updateOption(index: number, value: string) {
		poll.customOptions[index] = value;
		onUpdate(poll);
	}

	function applyColorScheme(colors: string[]) {
		poll.gradients.colors = colors.slice(0, poll.customOptions.length);
		onUpdate(poll);
	}
</script>

<!-- Response Type Selection -->
<fieldset class="mb-8">
	<legend class="mb-4 block text-sm font-medium text-white/90">Response Type *</legend>
	<div class="space-y-3">
		{#each responseTypes as type (type.value)}
			<label
				class="flex cursor-pointer items-center rounded-lg border p-4 transition-colors hover:bg-gray-700 {poll.responseType ===
				type.value
					? 'border-[#ff5705] bg-[#ff5705]/20'
					: 'border-gray-600 bg-gray-700/50'}"
			>
				<input type="radio" bind:group={poll.responseType} value={type.value} class="sr-only" />
				<div class="flex items-center space-x-4">
					<div class="text-2xl text-white/70">{type.icon}</div>
					<div>
						<div class="font-medium text-white">{type.label}</div>
						<div class="text-sm text-white/60">{type.description}</div>
					</div>
				</div>
				{#if poll.responseType === type.value}
					<div class="ml-auto">
						<div class="flex h-5 w-5 items-center justify-center rounded-full bg-[#ff5705]">
							<div class="h-2 w-2 rounded-full bg-white"></div>
						</div>
					</div>
				{/if}
			</label>
		{/each}
	</div>
</fieldset>

<!-- Option Labels -->
<fieldset class="mb-8">
	<legend class="mb-4 block text-sm font-medium text-white/90">Option Labels *</legend>
	<div class="space-y-3">
		{#each poll.customOptions as option, index (index)}
			<div class="flex items-center space-x-3">
				<input
					type="color"
					bind:value={poll.gradients.colors[index]}
					on:input={() => onUpdate(poll)}
					class="h-12 w-12 cursor-pointer rounded-lg border border-gray-600 bg-transparent"
					title="Choose color for {option}"
				/>
				<input
					class="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-[#ff5705] focus:outline-none"
					type="text"
					value={option}
					on:input={(e) => {
						const target = e.target as HTMLInputElement;
						if (target) updateOption(index, target.value);
					}}
					placeholder="Option {String.fromCharCode(65 + index)}"
				/>
			</div>
		{/each}
	</div>
</fieldset>

<!-- Gradient Configuration -->
<div class="mb-8">
	<div class="mb-4 flex items-center justify-between">
		<span class="block text-sm font-medium text-white/90">Background Gradient</span>
		<label class="relative inline-flex cursor-pointer items-center">
			<input
				type="checkbox"
				bind:checked={poll.gradients.enabled}
				on:change={() => onUpdate(poll)}
				class="peer sr-only"
			/>
			<div
				class="peer h-6 w-11 rounded-full bg-gray-600 peer-checked:bg-[#ff5705] peer-focus:ring-4 peer-focus:ring-[#ff5705]/20 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
			></div>
		</label>
	</div>

	{#if poll.gradients.enabled}
		<div class="space-y-4 rounded-lg border border-gray-600 bg-gray-700/50 p-4">
			<div class="mb-3 text-sm text-white/70">
				Choose option colors above to customize your poll visualization gradient
			</div>

			<!-- Gradient Preview -->
			<div class="h-12 overflow-hidden rounded-lg border border-gray-600">
				<div
					class="h-full w-full"
					style="background: linear-gradient(to right, {poll.gradients.colors
						.slice(0, poll.customOptions.length)
						.join(', ')})"
				></div>
			</div>

			<!-- Preset Color Schemes -->
			<div>
				<span class="mb-2 block text-xs font-medium text-white/70">Quick Color Schemes</span>
				<div class="grid grid-cols-2 gap-2">
					{#each colorSchemes as scheme (scheme.name)}
						<button
							type="button"
							class="h-8 rounded border border-gray-600 text-xs text-white/70 transition-colors hover:border-white/50"
							style="background: linear-gradient(to right, {scheme.colors
								.slice(0, Math.min(3, scheme.colors.length))
								.join(', ')})"
							on:click={() => applyColorScheme(scheme.colors)}
						>
							{scheme.name}
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}
</div>
