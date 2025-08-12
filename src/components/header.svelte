<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getContext } from 'svelte';
	import {
		currentUser,
		userGroup,
		signInWithGoogle,
		signOutUser,
		hasProAccessStore
	} from '../lib/stores';
	import { onMount } from 'svelte';

	const navHoverStore = getContext<Writable<boolean>>('navHover');

	let profileHovering = $state(false);
	let searchQuery = $state('');
	let searchActive = $state(false);
	let searchResults: { tierlists: any[]; polls: any[]; users: any[] } | null = $state(null);
	let searching = $state(false);
	let searchDebounce: any;
	let avatarUrl: string | null = $state(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let filterAnimating = $state(false);

	function handleMouseEnter() {
		if (searchActive) return;
		navHoverStore.set(true);
	}
	function handleMouseLeave() {
		if (searchActive) return;
		navHoverStore.set(false);
	}
	function handleProfileEnter() {
		if (searchActive) return;
		profileHovering = true;
	}
	function handleProfileLeave() {
		if (searchActive) return;
		profileHovering = false;
	}

	async function handleGoogleLogin() {
		await signInWithGoogle();
		updateAvatar();
	}
	async function handleSignOut() {
		await signOutUser();
		goto('/');
	}

	function openSearch() {
		if (searchActive) return;
		searchActive = true;
		requestAnimationFrame(() => {
			filterAnimating = true;
			inputEl?.focus();
		});
	}
	function closeSearch() {
		searchActive = false;
		filterAnimating = false;
		searchResults = null;
		searchQuery = '';
	}

	async function runSearch(q: string) {
		if (!q.trim()) {
			searchResults = null;
			return;
		}
		searching = true;
		try {
			const mod = await import('../lib/search');
			const r = await mod.searchAll(q.trim());
			searchResults = r;
		} catch (e) {
			console.warn('Search failed', e);
		} finally {
			searching = false;
		}
	}

	function handleType() {
		if (!searchActive && searchQuery.trim().length > 0) {
			openSearch();
		}
		clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => runSearch(searchQuery), 250);
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			closeSearch();
			return;
		}
		if (e.key === 'Enter') {
			clearTimeout(searchDebounce);
			runSearch(searchQuery);
		}
	}

	let userProfile: any = $state(null);
	onMount(async () => {
		if ($currentUser) await loadProfile();
	});

	async function loadProfile() {
		if (!$currentUser) {
			userProfile = null;
			updateAvatar();
			return;
		}
		try {
			const { getDoc, doc } = await import('firebase/firestore');
			const { db } = await import('../lib/firebase');
			const userDoc = await getDoc(doc(db, 'users', $currentUser.uid));
			if (userDoc.exists()) userProfile = userDoc.data();
		} catch (e) {
			console.warn('Could not load user profile:', e);
		}
		updateAvatar();
	}

	$effect(() => {
		if ($currentUser) loadProfile();
		else {
			userProfile = null;
			updateAvatar();
		}
	});
	function updateAvatar() {
		avatarUrl = $currentUser?.photoURL || userProfile?.avatarURL || null;
	}
</script>

<div class="justify center flex h-20 items-start gap-4">
	<div
		class="group relative z-50 flex flex-col items-end justify-center gap-1 p-4 transition-all duration-500 ease-out"
		style="margin-top: calc((5rem - 2rem) / 3 / 3);"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		role="region"
	>
		<a
			href="/"
			class={`relative overflow-hidden transition-all duration-300 ease-out
					${
						$page.url.pathname === '/'
							? 'bg-accent h-2 w-4 text-white group-hover:h-12 group-hover:w-20'
							: 'group-hover:bg-accent hover:bg-accent/70 group-hover:hover:bg-accent h-2 w-4 bg-gray-300 text-gray-900 group-hover:h-12 group-hover:w-20 group-hover:hover:text-white'
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
									? 'bg-accent h-2 w-6 text-white group-hover:h-12 group-hover:w-32'
									: 'group-hover:bg-accent hover:bg-accent/70 group-hover:hover:bg-accent h-2 w-6 bg-gray-300 text-gray-900 group-hover:h-12 group-hover:w-32 group-hover:hover:text-white'
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
									? 'bg-accent h-2 w-8 text-white group-hover:h-12 group-hover:w-44'
									: 'group-hover:bg-accent hover:bg-accent/70 group-hover:hover:bg-accent h-2 w-8 bg-gray-300 text-gray-900 group-hover:h-12 group-hover:w-44 group-hover:hover:text-white'
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
									? 'bg-accent h-2 w-4 text-white opacity-100 group-hover:h-12 group-hover:w-24'
									: 'group-hover:bg-accent hover:bg-accent/70 group-hover:hover:bg-accent h-2 w-4 bg-gray-300 text-gray-900 opacity-0 group-hover:h-12 group-hover:w-24 group-hover:opacity-100 group-hover:hover:text-white'
							}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
				>
					DRAFTS
				</span>
			</div>
		</a>
	</div>

	<div
		class="search-shell mt-5 flex h-10 items-center gap-2 transition-all duration-500 ease-out"
		class:overlay-active={searchActive}
	>
		<button
			type="button"
			class="material-symbols-outlined hover:text-accent text-xl text-gray-500 transition-colors select-none focus:outline-none"
			onclick={() => inputEl?.focus()}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && inputEl?.focus()}
			aria-label="Focus search input">search</button
		>
		<input
			bind:this={inputEl}
			bind:value={searchQuery}
			onfocus={() => {
				if (!searchActive && searchQuery.trim().length > 0) openSearch();
			}}
			oninput={handleType}
			onkeydown={handleSearchKeydown}
			placeholder="SEARCH"
			class="flex-1 bg-transparent text-white placeholder:text-white/40 focus:text-white focus:outline-none"
		/>
		{#if searchActive}
			<button
				type="button"
				class="text-xs tracking-wide text-gray-400 uppercase hover:text-white"
				onclick={closeSearch}>Close</button
			>
		{/if}
		<div
			class="bg-accent absolute right-0 bottom-0 left-0 h-0.5 origin-left transform transition-opacity duration-800"
			class:scale-x-0={!filterAnimating}
			class:scale-x-100={filterAnimating}
			class:opacity-0={!filterAnimating}
			class:opacity-100={filterAnimating}
			style="transition: transform 0.8s ease-in-out, opacity 0.4s ease-in-out;"
		></div>
	</div>

	<div class="ml-auto flex h-full items-center justify-end">
		{#if searchActive}
			<div class="fixed inset-0 z-200" role="dialog" aria-modal="true" aria-label="Search overlay">
				<button
					type="button"
					class="absolute inset-0 bg-black/70 backdrop-blur-md"
					aria-label="Close search"
					onclick={closeSearch}
					onkeydown={(e) => e.key === 'Escape' && closeSearch()}
				></button>
				<!-- Search container -->
				<div class="absolute top-0 right-0 left-0 flex flex-col items-stretch pt-4 md:pt-6">
					<div
						class="mx-4 border border-white/10 bg-white/5 px-4 py-3 shadow-lg backdrop-blur-md transition-[transform,opacity] duration-500 md:mx-10"
						style="transform-origin:top center;"
					>
						<div class="flex items-center gap-3">
							<span class="material-symbols-outlined text-accent text-xl select-none">search</span>
							<input
								bind:this={inputEl}
								bind:value={searchQuery}
								oninput={handleType}
								onkeydown={handleSearchKeydown}
								placeholder="Search everything..."
								class="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none"
							/>
							<button
								type="button"
								class="text-xs tracking-wide text-gray-400 uppercase hover:text-white"
								onclick={closeSearch}>ESC</button
							>
						</div>
					</div>
				</div>
				<div class="absolute inset-0 top-28 overflow-hidden">
					<div class="absolute inset-0 space-y-14 overflow-y-auto px-6 pt-4 pb-16 md:pt-10">
						{#if searching}
							<div class="text-center text-sm text-white/50">Searching...</div>
						{:else if searchResults}
							<section>
								<header class="mb-6 flex items-baseline justify-between">
									<h3 class="text-accent text-sm font-semibold tracking-wider">
										TIERLISTS <span class="text-white/40">{searchResults.tierlists.length}</span>
									</h3>
								</header>
								{#if searchResults.tierlists.length === 0}
									<div class="text-xs text-white/30">None</div>
								{:else}
									<div
										class="grid grid-cols-1 gap-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
									>
										{#each searchResults.tierlists.slice(0, 24) as t}
											<a
												href={'/tierlists/' + t.id}
												class="group relative h-56 cursor-pointer overflow-hidden border-r border-b border-gray-800 transition-all duration-200 hover:brightness-110"
												onclick={() => (searchActive = false)}
											>
												{#if t.banner_image || t.thumbnail}
													<img
														src={t.banner_image || t.thumbnail}
														alt={t.title}
														class="absolute inset-0 h-full w-full object-cover opacity-40 group-hover:opacity-60"
														loading="lazy"
														decoding="async"
													/>
												{:else}
													<div
														class="absolute inset-0"
														style="background-color:{[
															'#FFD6E0',
															'#FFEFB5',
															'#C1E7E3',
															'#DCECDD',
															'#E2D0F9',
															'#FFB5B5',
															'#B5E5FF'
														][Math.floor(Math.random() * 7)]};"
													></div>
												{/if}
												<div
													class="absolute inset-0 bg-gradient-to-t from-black/80 to-black/40"
												></div>
												<div
													class="relative z-10 flex h-full flex-col justify-between p-3 text-white"
												>
													<div class="flex items-start justify-between text-[10px] opacity-70">
														<span class="max-w-[60%] truncate"
															>{t.owner_displayName || t.author || 'Anonymous'}</span
														><span class="flex gap-1"
															><span class="material-symbols-outlined text-base">favorite</span
															>{t.likes || 0}</span
														>
													</div>
													<h4 class="mt-auto line-clamp-2 text-sm leading-snug font-semibold">
														{t.title}
													</h4>
												</div>
											</a>
										{/each}
									</div>
								{/if}
							</section>
							<section>
								<header class="mb-6 flex items-baseline justify-between">
									<h3 class="text-accent text-sm font-semibold tracking-wider">
										POLLS <span class="text-white/40">{searchResults.polls.length}</span>
									</h3>
								</header>
								{#if searchResults.polls.length === 0}
									<div class="text-xs text-white/30">None</div>
								{:else}
									<div
										class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
									>
										{#each searchResults.polls.slice(0, 24) as p}
											<a
												href={'/polls/' + p.id}
												class="group relative flex aspect-[16/9] flex-col bg-white/5 transition-colors hover:bg-white/10"
												onclick={() => (searchActive = false)}
											>
												<div
													class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"
												></div>
												<div class="relative mt-auto p-3">
													<h4 class="line-clamp-2 text-sm leading-snug font-semibold text-white">
														{p.title}
													</h4>
												</div>
											</a>
										{/each}
									</div>
								{/if}
							</section>
							<section>
								<header class="mb-6 flex items-baseline justify-between">
									<h3 class="text-accent text-sm font-semibold tracking-wider">
										USERS <span class="text-white/40">{searchResults.users.length}</span>
									</h3>
								</header>
								{#if searchResults.users.length === 0}
									<div class="text-xs text-white/30">None</div>
								{:else}
									<div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
										{#each searchResults.users.slice(0, 32) as u}
											<a
												href={'/user/' + u.uid}
												class="group relative flex flex-col bg-white/5 p-4 transition-colors hover:bg-white/10"
												onclick={() => (searchActive = false)}
											>
												{#if u.photoURL}
													<img
														src={u.photoURL}
														alt={u.displayName}
														class="mb-3 h-16 w-16 object-cover"
														loading="lazy"
														decoding="async"
													/>
												{:else}
													<div
														class="mb-3 flex h-16 w-16 items-center justify-center bg-white/10 text-xl font-bold text-white/40"
													>
														{(u.displayName || 'U').slice(0, 1)}
													</div>
												{/if}
												<div class="text-sm font-semibold text-white">{u.displayName}</div>
												<div class="text-xs text-white/40">@{u.uid}</div>
											</a>
										{/each}
									</div>
								{/if}
							</section>
						{:else}
							<div class="text-center text-sm text-white/40">Type to search...</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
		{#if $currentUser}
			<div class="flex h-full items-center" role="group">
				<!-- User Group Badges -->
				<div class="flex h-full items-center">
					{#if $userGroup === 'dev'}
						<span
							class="bg-size-200 animate-gradient-x flex h-full items-center bg-gradient-to-r from-cyan-400 to-blue-500 px-2 py-0.5 text-xs font-semibold text-white"
							>⚡ DEV</span
						>
					{/if}
					{#if $hasProAccessStore || $userGroup === 'dev'}
						<span
							class="bg-size-200 animate-gradient-x flex h-full items-center bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 px-2 py-0.5 text-xs font-semibold text-white"
							>✨ PRO</span
						>
					{:else if $userGroup && $userGroup !== 'dev' && $userGroup !== 'pro'}
						<a
							href="/pro"
							class="flex h-full items-center bg-indigo-600 px-2 py-0.5 text-xs text-white transition-colors hover:bg-indigo-700"
							>Buy Pro</a
						>
						<span class="bg-accent-100 text-accent flex h-full items-center px-2 py-0.5 text-xs"
							>{$userGroup}</span
						>
					{/if}
				</div>

				<div
					class="group relative flex h-full items-center"
					onmouseenter={handleProfileEnter}
					onmouseleave={handleProfileLeave}
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
								class="hover:text-accent flex h-full items-center justify-center bg-gray-200 px-3 text-gray-500 transition-all duration-200 hover:bg-gray-300"
								title="Settings"><span class="material-symbols-outlined">settings</span></a
							>

							<!-- Sign Out Button -->
							<button
								class="h-full bg-gray-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-300"
								onclick={handleSignOut}
							>
								Sign Out
							</button>
						</div>
					</div>

					<style>
						.search-shell {
							position: absoluteyes;
						}
						.search-shell.overlay-active {
							position: fixed;
							top: 0;
							left: 0;
							right: 0;
							z-index: 60;
							margin-top: 0;
							padding: 1rem 1.5rem;
							height: 4.5rem;
							background: rgba(0, 0, 0, 0.75);
							backdrop-filter: blur(12px);
						}
						.text-accent {
							color: rgb(var(--primary));
						}
						.bg-accent {
							background: rgb(var(--primary));
						}
						.bg-accent-100 {
							background: rgba(var(--primary), 0.1);
						}
						.hover\:text-accent:hover {
							color: rgb(var(--primary));
						}
					</style>

					<!-- Avatar -->
					<a
						href={'/user/' + $currentUser.uid}
						data-sveltekit-preload-data="off"
						class="group/avatar hover:shadow-accent/30 hover:ring-accent h-full w-[80px] cursor-pointer overflow-hidden bg-gray-300 transition-all duration-300 hover:shadow-lg hover:ring-10"
						title={$currentUser.displayName || $currentUser.email}
					>
						{#if avatarUrl}
							<img
								src={avatarUrl}
								alt="Profile"
								class="h-full w-full object-cover transition-transform duration-300 group-hover/avatar:scale-105"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center">
								<span
									class="material-symbols-outlined group-hover/avatar:text-accent text-4xl text-gray-500 transition-colors duration-300"
									>person</span
								>
							</div>
						{/if}
					</a>
				</div>
			</div>
		{:else}
			<div class="flex h-full items-center" role="group">
				<div class="flex h-full items-center" role="group">
					<!-- Google Login Button -->
					<button
						class="flex h-full items-center gap-2 border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
						onclick={handleGoogleLogin}
						aria-label="Sign in with Google">Sign in with Google</button
					>
				</div>
			</div>
		{/if}
	</div>
</div>
