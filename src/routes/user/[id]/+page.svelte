<script context="module" lang="ts">
	import { doc, getDoc } from 'firebase/firestore';
	import { db } from '$lib/firebase';
	export const load = async ({ params }: { params: { id: string } }) => {
		const userId = params.id;
		let userProfile = null;
		if (userId) {
			const userDoc = await getDoc(doc(db, 'users', userId));
			if (userDoc.exists()) {
				userProfile = userDoc.data();
				userProfile.id = userId;
			}
		}
		// TODO: Fetch creations, forks, comments, likes, followers, following, aura, pro status, banner
		return { userProfile };
	};
</script>

<script lang="ts">
	import { currentUser, userGroup } from '$lib/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import {
		updateUserProfile,
		followUser as followUserFirestore,
		unfollowUser as unfollowUserFirestore,
		isFollowing as isFollowingFirestore,
		isFriend as isFriendFirestore,
		getFollowerCount,
		getFollowingCount,
		getAuraAndPro
	} from '$lib/user-profile';

	export let data: { userProfile: any };

	let editingName = false;
	let newName = data.userProfile?.displayName || '';
	let editingBanner = false;
	let newBanner = data.userProfile?.bannerURL || '';
	let uploadingPhoto = false;
	let uploadingBanner = false;
	let isFollowing = false;
	let isFriend = false;
	let followers = 0;
	let following = 0;
	let aura = 0;
	let pro = data.userProfile?.pro || false;
	let activeTab = 'CREATIONS';

	const isOwnProfile = $currentUser && data.userProfile && $currentUser.uid === data.userProfile.id;

	onMount(async () => {
		if (!data.userProfile || !$currentUser) return;
		const uid = $currentUser.uid;
		const targetUid = data.userProfile.id;
		[isFollowing, isFriend, followers, following] = await Promise.all([
			isFollowingFirestore(uid, targetUid),
			isFriendFirestore(uid, targetUid),
			getFollowerCount(targetUid),
			getFollowingCount(targetUid)
		]);
		const auraPro = await getAuraAndPro(targetUid);
		aura = auraPro.aura;
		pro = auraPro.pro;
	});

	async function saveName() {
		if (!isOwnProfile) return;
		await updateUserProfile($currentUser.uid, { displayName: newName });
		data.userProfile.displayName = newName;
		editingName = false;
	}

	async function saveBanner() {
		if (!isOwnProfile || !pro) return;
		await updateUserProfile($currentUser.uid, { bannerURL: newBanner });
		data.userProfile.bannerURL = newBanner;
		editingBanner = false;
	}

	async function followUser() {
		if (!$currentUser || !data.userProfile) return;
		await followUserFirestore($currentUser.uid, data.userProfile.id);
		isFollowing = true;
		isFriend = await isFriendFirestore($currentUser.uid, data.userProfile.id);
		followers = await getFollowerCount(data.userProfile.id);
	}

	async function unfollowUser() {
		if (!$currentUser || !data.userProfile) return;
		await unfollowUserFirestore($currentUser.uid, data.userProfile.id);
		isFollowing = false;
		isFriend = await isFriendFirestore($currentUser.uid, data.userProfile.id);
		followers = await getFollowerCount(data.userProfile.id);
	}
</script>

{#if data.userProfile}
	<div class="relative min-h-[400px] w-full bg-black text-white">
		<!-- Banner -->
		<div class="relative h-56 w-full bg-gray-800">
			{#if data.userProfile.bannerURL}
				<img src={data.userProfile.bannerURL} alt="Banner" class="h-full w-full object-cover" />
			{/if}
			{#if isOwnProfile && pro}
				<button
					class="absolute top-4 right-4 rounded bg-white/80 px-3 py-1 text-black"
					on:click={() => (editingBanner = true)}>Edit Banner</button
				>
				{#if editingBanner}
					<div class="absolute top-16 right-4 rounded bg-white p-4 text-black shadow">
						<input
							type="text"
							bind:value={newBanner}
							placeholder="Banner Image URL"
							class="w-64 rounded border px-2 py-1"
						/>
						<button class="ml-2 rounded bg-orange-500 px-3 py-1 text-white" on:click={saveBanner}
							>Save</button
						>
						<button class="ml-2 px-3 py-1" on:click={() => (editingBanner = false)}>Cancel</button>
					</div>
				{/if}
			{/if}
		</div>

		<!-- Profile, name, aura, followers, follow/friend -->
		<div class="absolute top-32 right-0 left-0 flex items-end gap-8 px-12">
			<!-- Profile Picture -->
			<div class="relative">
				{#if data.userProfile.photoURL}
					<img
						src={data.userProfile.photoURL}
						alt="Profile"
						class="h-40 w-40 rounded-xl border-4 border-black object-cover shadow-lg"
					/>
				{:else}
					<div
						class="flex h-40 w-40 items-center justify-center rounded-xl border-4 border-black bg-gray-700 text-6xl text-gray-400 shadow-lg"
					>
						<span class="material-symbols-outlined">person</span>
					</div>
				{/if}
				{#if isOwnProfile}
					<button class="absolute right-2 bottom-2 rounded bg-white/80 px-2 py-1 text-xs text-black"
						>Edit</button
					>
					<!-- TODO: Add file upload for profile picture -->
				{/if}
			</div>
			<div class="flex flex-1 flex-col gap-2">
				<div class="flex items-center gap-2">
					{#if isOwnProfile && editingName}
						<input
							type="text"
							bind:value={newName}
							class="rounded px-2 py-1 text-3xl font-bold text-black"
						/>
						<button class="ml-2 rounded bg-orange-500 px-3 py-1 text-white" on:click={saveName}
							>Save</button
						>
						<button class="ml-2 px-3 py-1" on:click={() => (editingName = false)}>Cancel</button>
					{:else}
						<h2 class="text-3xl font-bold">
							{data.userProfile?.displayName ?? data.userProfile?.name ?? 'User'}
						</h2>
						{#if isOwnProfile}
							<button
								class="ml-2 rounded bg-white/80 px-2 py-1 text-xs text-black"
								on:click={() => (editingName = true)}>Edit</button
							>
						{/if}
					{/if}
				</div>
				<div class="mt-2 flex gap-8">
					<div class="text-lg"><span class="font-bold">{aura}</span> aura</div>
					<div class="text-lg"><span class="font-bold">{followers}</span> followers</div>
				</div>
			</div>
			<div class="flex flex-col items-end gap-2">
				{#if !isOwnProfile}
					{#if isFriend}
						<div class="rounded bg-green-600 px-6 py-2 text-lg font-bold">FRIENDS</div>
					{:else if isFollowing}
						<div class="rounded bg-gray-700 px-6 py-2 text-lg font-bold">FOLLOWING</div>
					{:else}
						<button
							class="rounded bg-white px-8 py-3 text-xl font-bold text-black"
							on:click={followUser}>FOLLOW</button
						>
					{/if}
				{/if}
			</div>
		</div>

		<!-- Tabs -->
		<div class="mt-40 bg-black/80 pt-16">
			<div class="flex gap-8 border-b border-gray-700 px-12 text-2xl font-light">
				<button
					class={activeTab === 'CREATIONS'
						? 'border-b-4 border-orange-500 font-bold text-orange-500'
						: 'text-gray-300'}
					on:click={() => (activeTab = 'CREATIONS')}>CREATIONS</button
				>
				<button
					class={activeTab === 'FORKS'
						? 'border-b-4 border-orange-500 font-bold text-orange-500'
						: 'text-gray-300'}
					on:click={() => (activeTab = 'FORKS')}>FORKS</button
				>
				<button
					class={activeTab === 'COMMENTS'
						? 'border-b-4 border-orange-500 font-bold text-orange-500'
						: 'text-gray-300'}
					on:click={() => (activeTab = 'COMMENTS')}>COMMENTS</button
				>
				<button
					class={activeTab === 'LIKES'
						? 'border-b-4 border-orange-500 font-bold text-orange-500'
						: 'text-gray-300'}
					on:click={() => (activeTab = 'LIKES')}>LIKES</button
				>
			</div>
			<div class="px-12 py-8">
				<!-- Placeholder grid for creations -->
				<div class="grid grid-cols-4 gap-6">
					{#each Array(8) as _, i}
						<div class="flex flex-col gap-2 rounded-lg bg-gray-900 p-4">
							<div class="mb-2 flex h-32 w-full items-center justify-center rounded bg-gray-700">
								<img
									src="/static/fake-thumb.png"
									alt="thumb"
									class="h-full w-full rounded object-cover"
								/>
							</div>
							<div class="text-xs text-gray-400">DATE</div>
							<div class="text-sm font-bold text-orange-400">AUTHOR</div>
							<div class="text-lg font-bold">TITLE</div>
							<div class="mt-2 flex gap-4 text-xs text-gray-400">
								<span>♡ 7.3K</span>
								<span>💬 5.5K</span>
								<span>🔁 10K</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="flex h-64 items-center justify-center">User not found.</div>
{/if}
