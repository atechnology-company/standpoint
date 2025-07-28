<script lang="ts">
	import type { Writable } from 'svelte/store';
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import Modal from './login-modal.svelte';
	import { currentUser, userGroup, signInWithGoogle, signOutUser } from '../lib/stores';

	const navHoverStore = getContext<Writable<boolean>>('navHover');

	let profileHovering = false;
	let showLoginModal = false;

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
</script>

<div class="flex h-20 items-start gap-4 p-4">
	<div
		class="group relative z-50 flex flex-col items-end justify-center gap-1 transition-all duration-500 ease-out"
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
		{#if $currentUser}
			<div class="group relative flex items-center">
				<div
					class="h-10 w-10 cursor-pointer overflow-hidden rounded-full bg-gray-300"
					title={$currentUser.displayName || $currentUser.email}
				>
					{#if $currentUser.photoURL}
						<img src={$currentUser.photoURL} alt="Profile" class="h-full w-full object-cover" />
					{:else}
						<span class="material-symbols-outlined text-gray-500">person</span>
					{/if}
				</div>
				<button
					class="ml-2 rounded bg-gray-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-300"
					on:click={handleSignOut}
				>
					Sign Out
				</button>
				{#if $userGroup}
					<span class="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700"
						>{$userGroup}</span
					>
				{/if}
			</div>
		{:else}
			<div
				class="group relative flex items-center"
				on:mouseenter={handleProfileEnter}
				on:mouseleave={handleProfileLeave}
				role="region"
			>
				<div
					class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black transition-all duration-300"
					on:click={openLoginModal}
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') openLoginModal();
					}}
					role="button"
					tabindex="0"
				>
					<span class="material-symbols-outlined text-white">person</span>
				</div>

				<div
					class={`flex items-center overflow-hidden transition-all duration-300 ease-out ${profileHovering ? 'ml-2 w-56 max-w-xs' : 'w-0'}`}
				>
					<button
						class="flex w-full items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 font-medium whitespace-nowrap text-gray-700 shadow transition-colors hover:bg-gray-100"
						style="min-width: 180px; max-width: 220px;"
						on:click={handleGoogleLogin}
					>
						<img
							src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
							alt="Google"
							class="h-5 w-5"
						/>
						<span>Sign in with Google</span>
					</button>
				</div>
			</div>
			<Modal open={showLoginModal} on:close={closeLoginModal}>
				<!-- theres an error i have no idea what to do about it -->
				<div class="flex flex-col items-center gap-4">
					<h2 class="mb-2 text-xl font-bold">Sign in to Standpoint</h2>
					<button
						class="flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 shadow transition-colors hover:bg-gray-100"
						on:click={handleGoogleLogin}
					>
						<img
							src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
							alt="Google"
							class="h-5 w-5"
						/>
						<span>Sign in with Google</span>
					</button>
				</div>
			</Modal>
		{/if}
	</div>
</div>
