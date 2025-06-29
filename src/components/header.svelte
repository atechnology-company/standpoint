<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { getContext } from 'svelte';

	const navHoverStore = getContext<Writable<boolean>>('navHover');

	let isLoggedIn = false;
	let profileHovering = false;

	function handleMouseEnter() {
		navHoverStore.set(true);
	}

	function handleMouseLeave() {
		navHoverStore.set(false);
	}

	function handleProfileEnter() {
		profileHovering = true;
	}

	function handleProfileLeave() {
		profileHovering = false;
	}
</script>

<div class="flex h-20 items-start gap-4 p-4">
	<div
		class="group relative z-50 flex flex-col items-end justify-center gap-1 transition-all duration-500 ease-out"
		style="margin-top: calc((5rem - 2rem) / 3 / 3);"
		on:mouseenter={handleMouseEnter}
		on:mouseleave={handleMouseLeave}
	>
		<a
			href="/"
			class={`relative overflow-hidden transition-all duration-300 ease-out
					${
						$page.url.pathname === '/'
							? 'h-2 w-4 bg-orange-500 text-white group-hover:h-12 group-hover:w-18'
							: 'h-2 w-4 bg-gray-200 group-hover:h-12 group-hover:w-18 group-hover:bg-white hover:bg-orange-400 group-hover:hover:bg-orange-500 group-hover:hover:text-white'
					}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-end group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					>FEED</span
				>
			</div>
		</a>
		<a
			href="/polls"
			class={`relative overflow-hidden transition-all duration-300 ease-out
							${
								$page.url.pathname === '/polls'
									? 'h-2 w-6 bg-orange-500 text-white group-hover:h-12 group-hover:w-32'
									: 'h-2 w-6 bg-gray-200 group-hover:h-12 group-hover:w-32 group-hover:bg-white hover:bg-orange-400 group-hover:hover:bg-orange-500 group-hover:hover:text-white'
							}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					>POLLS</span
				>
			</div>
		</a>
		<a
			href="/tierlists"
			class={`relative overflow-hidden transition-all duration-300 ease-out
							${
								$page.url.pathname === '/tierlists'
									? 'h-2 w-8 bg-orange-500 text-white group-hover:h-12 group-hover:w-44'
									: 'h-2 w-8 bg-gray-200 group-hover:h-12 group-hover:w-44 group-hover:bg-white hover:bg-orange-400 group-hover:hover:bg-orange-500 group-hover:hover:text-white'
							}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					>TIERLISTS</span
				>
			</div>
		</a>
	</div>

	<div class="flex h-10 items-center gap-2">
		<span class="material-symbols-outlined text-xl text-gray-500">search</span>
		<input
			placeholder="SEARCH"
			class="bg-transparent text-gray-700 placeholder:text-gray-400 focus:outline-none"
		/>
	</div>

	<div class="ml-auto flex items-center">
		{#if isLoggedIn}
			<div class="h-10 w-10 overflow-hidden rounded-full bg-gray-300">
				<img src="/path/to/profile.jpg" alt="Profile" class="h-full w-full object-cover" />
			</div>
		{:else}
			<div
				class="group relative flex items-center"
				on:mouseenter={handleProfileEnter}
				on:mouseleave={handleProfileLeave}
			>
				<div
					class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black transition-all duration-300"
				>
					<span class="material-symbols-outlined text-white">person</span>
				</div>

				<div
					class={`flex items-center overflow-hidden transition-all duration-300 ease-out ${profileHovering ? 'ml-2 w-36' : 'w-0'}`}
				>
					<a
						href="/login"
						class="bg-gray-600 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-gray-700"
					>
						LOGIN
					</a>
					<a
						href="/signup"
						class="bg-orange-500 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-orange-600"
					>
						SIGN UP
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
