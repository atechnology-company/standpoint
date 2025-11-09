<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getContext, onMount } from 'svelte';
	import {
		currentUser,
		userGroup,
		signInWithGoogle,
		signOutUser,
		hasProAccessStore
	} from '../lib/stores';

	const navHoverStore = getContext<Writable<boolean>>('navHover');

	let profileHovering = false;
	let searchQuery = '';
	let searchActive = false;
	let searchResults: { tierlists: any[]; polls: any[]; users: any[] } | null = null;
	let searching = false;
	let searchDebounce: any;
	let avatarUrl: string | null = null;
	let inputEl: HTMLInputElement | null = null;
	let filterAnimating = false;

	let isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
	let mobileOpen = false;
	let activeIndex: number = -1;
	let navGroupEl: HTMLElement | null = null;
	let linkEls: Array<{ el: HTMLElement; href: string } | null> = [null, null, null, null];
	let homeEl: HTMLElement | null = null;
	let pollsEl: HTMLElement | null = null;
	let tierlistsEl: HTMLElement | null = null;
	let draftsEl: HTMLElement | null = null;

	function updateIsMobile() {
		if (typeof window !== 'undefined') isMobile = window.innerWidth < 768;
	}

	onMount(() => {
		updateIsMobile();
		const onResize = () => updateIsMobile();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	function updateLinks() {
		linkEls = [
			homeEl ? { el: homeEl, href: '/' } : null,
			pollsEl ? { el: pollsEl, href: '/polls' } : null,
			tierlistsEl ? { el: tierlistsEl, href: '/tierlists' } : null,
			draftsEl ? { el: draftsEl, href: '/tierlists/drafts' } : null
		];
	}

	function startMobileNav(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		if (!isMobile) return;
		mobileOpen = true;
		updateLinks();
		updateActiveFromTouch(e);
		if (activeIndex === -1) activeIndex = 0;
	}

	function updateActiveFromTouch(e: TouchEvent) {
		if (!mobileOpen) return;
		const touch = e.touches[0];
		if (!touch || !navGroupEl) return;
		const rect = navGroupEl.getBoundingClientRect();
		const y = touch.clientY - rect.top;
		let bestIdx = -1;
		let bestDist = Infinity;
		for (let i = 0; i < linkEls.length; i++) {
			const l = linkEls[i]?.el;
			if (!l) continue;
			const lr = l.getBoundingClientRect();
			const center = (lr.top + lr.bottom) / 2 - rect.top;
			const d = Math.abs(center - y);
			if (d < bestDist) {
				bestDist = d;
				bestIdx = i;
			}
		}
		activeIndex = bestIdx;
	}

	function moveMobileNav(e: TouchEvent) {
		if (e.cancelable) e.preventDefault();
		if (!mobileOpen) return;
		updateActiveFromTouch(e);
	}

	function endMobileNav() {
		if (!mobileOpen) return;
		const target = linkEls[activeIndex]?.href;
		mobileOpen = false;
		activeIndex = -1;
		if (target) goto(target);
	}

	function handleMouseEnter() {
		navHoverStore?.set(true);
	}
	function handleMouseLeave() {
		navHoverStore?.set(false);
	}

	async function handleGoogleLogin() {
		await signInWithGoogle();
	}
	async function handleSignOut() {
		await signOutUser();
		goto('/');
	}
</script>

<div class="justify center flex h-20 items-start gap-4">
	<div
		class="group relative z-50 flex flex-col items-end justify-center gap-1 p-4 transition-all duration-500 ease-out"
		style="margin-top: calc((5rem - 2rem) / 3 / 3);"
		onmouseenter={handleMouseEnter}
		onmouseleave={handleMouseLeave}
		role="region"
		bind:this={navGroupEl}
	>
		<a
			href="/"
			bind:this={homeEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-20' : 'h-2 w-4'} group-hover:h-12 group-hover:w-20 ${$page.url.pathname === '/' ? 'bg-[rgb(var(--primary))] text-white' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'}`}
			style="transform-origin: top center;"
			ontouchstart={startMobileNav}
			ontouchmove={moveMobileNav}
			ontouchend={endMobileNav}
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>HOME</span
				>
			</div>
		</a>

		<a
			href="/polls"
			bind:this={pollsEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-32' : 'h-2 w-6'} group-hover:h-12 group-hover:w-32 ${$page.url.pathname.startsWith('/polls') ? 'bg-[rgb(var(--primary))] text-white' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>POLLS</span
				>
			</div>
		</a>

		<a
			href="/tierlists"
			bind:this={tierlistsEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-44' : 'h-2 w-8'} group-hover:h-12 group-hover:w-44 ${$page.url.pathname.startsWith('/tierlists') && !$page.url.pathname.startsWith('/tierlists/drafts') ? 'bg-[rgb(var(--primary))] text-white' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>TIERLISTS</span
				>
			</div>
		</a>

		<a
			href="/tierlists/drafts"
			bind:this={draftsEl}
			class={`relative overflow-hidden transition-all duration-300 ease-out ${mobileOpen ? 'h-12 w-24' : 'h-2 w-4'} group-hover:h-12 group-hover:w-24 ${$page.url.pathname.startsWith('/tierlists/drafts') ? 'bg-[rgb(var(--primary))] text-white opacity-100' : 'bg-gray-300 text-gray-900 hover:bg-gray-400/70'} ${!$page.url.pathname.startsWith('/tierlists/drafts') && !mobileOpen ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
			style="transform-origin: top center;"
		>
			<div
				class="absolute inset-0 flex items-center justify-center px-2 group-hover:justify-start group-hover:pl-2"
			>
				<span
					class="text-center text-lg font-bold whitespace-nowrap opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100"
					class:opacity-100={mobileOpen}>DRAFTS</span
				>
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
			aria-label="Focus search input">search</button
		>
		<input
			bind:this={inputEl}
			bind:value={searchQuery}
			placeholder="SEARCH"
			class="flex-1 bg-transparent text-white placeholder:text-white/40 focus:text-white focus:outline-none"
		/>
	</div>

	<div class="ml-auto flex h-full items-center justify-end">
		{#if $currentUser}
			<div class="flex h-full items-center" role="group">
				<a
					href={'/user/' + $currentUser.uid}
					class="group/avatar hover:shadow-accent/30 hover:ring-accent h-full w-[80px] cursor-pointer overflow-hidden bg-gray-300 transition-all duration-300 hover:shadow-lg hover:ring-10"
					title={$currentUser.displayName || $currentUser.email}
				>
					{#if avatarUrl}
						<img src={avatarUrl} alt="Profile" class="h-full w-full object-cover" />
					{:else}
						<div class="flex h-full w-full items-center justify-center">
							<span class="material-symbols-outlined text-4xl text-gray-500">person</span>
						</div>
					{/if}
				</a>
			</div>
		{:else}
			<button
				class="flex h-full items-center gap-2 border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100"
				onclick={handleGoogleLogin}
				aria-label="Sign in with Google">Sign in with Google</button
			>
		{/if}
	</div>
</div>
