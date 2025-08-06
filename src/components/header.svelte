<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';
	import Modal from './login-modal.svelte';
	import {
		currentUser,
		userGroup,
		signInWithGoogle,
		signOutUser,
		hasProAccessStore
	} from '../lib/stores';

	const navHoverStore = getContext<Writable<boolean>>('navHover');

	let profileHovering = false;
	let showLoginModal = false;
	let searchQuery = '';

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

	function openLoginModal() {
		showLoginModal = true;
	}

	function closeLoginModal() {
		showLoginModal = false;
	}

	async function handleGoogleLogin() {
		await signInWithGoogle();
		closeLoginModal();
	}

	async function handleSignOut() {
		await signOutUser();
	}

	// Animation for the filter line
	let filterAnimating = false;

	function animateFilter() {
		filterAnimating = true;
		setTimeout(() => {
			filterAnimating = false;
		}, 800);
	}

	function handleSearch() {
		if (searchQuery.trim()) {
			animateFilter();
			goto(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
		}
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handleSearch();
		}
	}
</script>

<div class="justify center flex h-20 items-start gap-4">
	<div
		class="group relative z-50 flex flex-col items-end justify-center gap-1 p-4 transition-all duration-500 ease-out"
		style="margin-top: calc((5rem - 2rem) / 3 / 3);"
		on:mouseenter={handleMouseEnter}
		on:mouseleave={handleMouseLeave}
		role="region"
	>
		<a
			href="/"
			class={`relative overflow-hidden transition-all duration-300 ease-out
					${
						$page.url.pathname === '/'
							? 'h-2 w-4 bg-orange-500 text-white group-hover:h-12 group-hover:w-20'
							: 'h-2 w-4 bg-gray-200 group-hover:h-12 group-hover:w-20 group-hover:bg-white hover:bg-orange-400 group-hover:hover:bg-orange-500 group-hover:hover:text-white'
					}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-end group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					>HOME</span
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
		<a
			href="/tierlists/drafts"
			class={`relative overflow-hidden transition-all duration-300 ease-out 
							${
								$page.url.pathname === '/tierlists/drafts'
									? 'h-2 w-4 bg-orange-500 text-white opacity-100 group-hover:h-12 group-hover:w-24'
									: 'h-2 w-4 bg-gray-200 opacity-0 group-hover:h-12 group-hover:w-24 group-hover:bg-white group-hover:opacity-100 hover:bg-orange-400 group-hover:hover:bg-orange-500 group-hover:hover:text-white'
							}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center group-hover:justify-start group-hover:pl-2"
			>
				<span class="text-lg font-bold whitespace-nowrap transition-opacity delay-150 duration-300">
					DRAFTS
				</span>
			</div>
		</a>
	</div>

	<div class="relative mt-5 flex h-10 items-center gap-2">
		<button
			on:click={handleSearch}
			class="material-symbols-outlined text-xl text-gray-500 transition-colors hover:text-orange-500"
		>
			search
		</button>
		<input
			bind:value={searchQuery}
			on:keydown={handleSearchKeydown}
			placeholder="SEARCH"
			class="bg-transparent text-gray-700 placeholder:text-gray-400 focus:text-white focus:outline-none"
		/>
		<div
			class="absolute right-0 bottom-0 left-0 h-0.5 origin-left transform bg-orange-500 transition-opacity duration-800"
			class:scale-x-0={!filterAnimating}
			class:scale-x-100={filterAnimating}
			class:opacity-0={!filterAnimating}
			class:opacity-100={filterAnimating}
			style="transition: transform 0.8s ease-in-out, opacity 0.4s ease-in-out;"
		></div>
	</div>

	<div class="ml-auto flex h-full items-center justify-end">
		{#if $currentUser}
			<div class="flex h-full items-center" role="group">
				<!-- User Group Badges -->
				<div class="flex h-full items-center">
					{#if $userGroup === 'dev'}
						<span
							class="bg-size-200 animate-gradient-x flex h-full items-center bg-gradient-to-r from-cyan-400 to-blue-500 px-2 py-0.5 text-xs font-semibold text-white"
						>
							⚡ DEV
						</span>
					{/if}
					{#if $hasProAccessStore || $userGroup === 'dev'}
						<span
							class="bg-size-200 animate-gradient-x flex h-full items-center bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 px-2 py-0.5 text-xs font-semibold text-white"
						>
							✨ PRO
						</span>
					{:else if $userGroup && $userGroup !== 'dev' && $userGroup !== 'pro'}
						<a
							href="/pro"
							class="flex h-full items-center bg-indigo-600 px-2 py-0.5 text-xs text-white transition-colors hover:bg-indigo-700"
						>
							Buy Pro
						</a>
						<span
							class="flex h-full items-center bg-orange-100 px-2 py-0.5 text-xs text-orange-700"
						>
							{$userGroup}
						</span>
					{/if}
				</div>

				<div
					class="group relative flex h-full items-center"
					on:mouseenter={handleProfileEnter}
					on:mouseleave={handleProfileLeave}
					role="group"
				>
					<!-- Settings, Sign Out -->
					<div
						class="absolute top-0 flex h-full items-center overflow-hidden whitespace-nowrap transition-all duration-300 ease-out"
						style="width: {profileHovering ? '140px' : '0'}; right: 80px;"
					>
						<div class="flex h-full items-center">
							<!-- Settings Button -->
							<a
								href="/settings"
								data-sveltekit-preload-data="off"
								class="flex h-full items-center justify-center bg-gray-200 px-3 text-gray-500 transition-all duration-200 hover:bg-gray-300 hover:text-orange-500"
								title="Settings"
							>
								<span class="material-symbols-outlined">settings</span>
							</a>

							<!-- Sign Out Button -->
							<button
								class="h-full bg-gray-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-300"
								on:click={handleSignOut}
							>
								Sign Out
							</button>
						</div>
					</div>

					<!-- Avatar -->
					<a
						href={'/user/' + $currentUser.uid}
						data-sveltekit-preload-data="off"
						class="group/avatar h-full w-[80px] cursor-pointer overflow-hidden bg-gray-300 transition-all duration-300 hover:shadow-lg hover:ring-10 hover:shadow-orange-500/30 hover:ring-orange-400"
						title={$currentUser.displayName || $currentUser.email}
					>
						{#if $currentUser.photoURL}
							<img
								src={$currentUser.photoURL}
								alt="Profile"
								class="h-full w-full object-cover transition-transform duration-300 group-hover/avatar:scale-105"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center">
								<span
									class="material-symbols-outlined text-4xl text-gray-500 transition-colors duration-300 group-hover/avatar:text-orange-400"
									>person</span
								>
							</div>
						{/if}
					</a>
				</div>
			</div>
		{:else}
			<div class="flex h-full items-center" role="group">
				<!-- Login Button -->
				<button
					class="h-full bg-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-300"
					on:click={handleGoogleLogin}
				>
					Login
				</button>

				<!-- Sign Up Button -->
				<button
					class="h-full bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 font-medium text-white transition-colors hover:from-orange-600 hover:to-pink-600"
					on:click={openLoginModal}
				>
					Sign Up
				</button>
			</div>
			<Modal open={showLoginModal} on:close={closeLoginModal} on:login={handleGoogleLogin} />
		{/if}
	</div>
</div>
