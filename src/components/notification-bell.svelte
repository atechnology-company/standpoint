<script lang="ts">
	import { onMount } from 'svelte';
	import { notifications, unreadCount, type Notification } from '$lib/notifications';
	import { fade, fly } from 'svelte/transition';
	import { goto } from '$app/navigation';

	let showDropdown = false;
	let notificationsList: Notification[] = [];

	$: unread = $unreadCount;

	notifications.subscribe((notifs) => {
		notificationsList = notifs.slice(0, 10); // Show last 10
	});

	onMount(() => {
		notifications.loadFromStorage();
	});

	function toggleDropdown() {
		showDropdown = !showDropdown;
	}

	function handleNotificationClick(notification: Notification) {
		notifications.markRead(notification.id);
		if (notification.link) {
			goto(notification.link);
		}
		showDropdown = false;
	}

	function handleMarkAllRead() {
		notifications.markAllRead();
	}

	function getNotificationIcon(type: Notification['type']) {
		switch (type) {
			case 'like':
				return '❤️';
			case 'comment':
				return '💬';
			case 'fork':
				return '🍴';
			case 'follow':
				return '👤';
			case 'mention':
				return '@';
			default:
				return '🔔';
		}
	}

	function getTimeAgo(timestamp: number): string {
		const seconds = Math.floor((Date.now() - timestamp) / 1000);

		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.notification-container')) {
			showDropdown = false;
		}
	}

	$: if (typeof window !== 'undefined') {
		if (showDropdown) {
			window.addEventListener('click', handleClickOutside);
		} else {
			window.removeEventListener('click', handleClickOutside);
		}
	}
</script>

<div class="notification-container relative">
	<button
		class="relative flex items-center justify-center rounded-md p-2 text-white transition-colors hover:bg-white/10"
		on:click|stopPropagation={toggleDropdown}
		aria-label="Notifications"
		aria-expanded={showDropdown}
	>
		<span class="material-symbols-outlined text-2xl">notifications</span>
		{#if unread > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
				style="background-color: rgb(var(--error));"
				in:fade
			>
				{unread > 9 ? '9+' : unread}
			</span>
		{/if}
	</button>

	{#if showDropdown}
		<div
			class="theme-transition absolute top-full right-0 z-50 mt-2 w-80 border shadow-2xl"
			style="border-color: rgba(255, 255, 255, 0.2); background-color: var(--bg);"
			transition:fly={{ y: -10, duration: 200 }}
		>
			<div class="flex items-center justify-between border-b border-white/10 p-4">
				<h3 class="font-semibold text-white">Notifications</h3>
				{#if unread > 0}
					<button
						class="text-accent text-xs hover:underline"
						on:click|stopPropagation={handleMarkAllRead}
					>
						Mark all read
					</button>
				{/if}
			</div>

			<div class="max-h-96 overflow-y-auto">
				{#if notificationsList.length === 0}
					<div class="p-8 text-center text-white/50">
						<span class="material-symbols-outlined text-4xl">notifications_off</span>
						<p class="mt-2">No notifications yet</p>
					</div>
				{:else}
					{#each notificationsList as notification (notification.id)}
						<button
							class="block w-full border-b border-white/5 p-4 text-left transition-colors hover:bg-white/5 {notification.read
								? 'opacity-60'
								: ''}"
							on:click={() => handleNotificationClick(notification)}
						>
							<div class="flex gap-3">
								<div class="flex-shrink-0 text-2xl">{getNotificationIcon(notification.type)}</div>
								<div class="min-w-0 flex-1">
									<p class="font-medium text-white">{notification.title}</p>
									<p class="mt-1 text-sm text-white/70">{notification.message}</p>
									<p class="mt-1 text-xs text-white/50">{getTimeAgo(notification.timestamp)}</p>
								</div>
								{#if !notification.read}
									<div class="flex-shrink-0">
										<div class="bg-accent h-2 w-2 rounded-full"></div>
									</div>
								{/if}
							</div>
						</button>
					{/each}
				{/if}
			</div>

			{#if notificationsList.length > 0}
				<div class="border-t border-white/10 p-2">
					<button
						class="text-accent w-full py-2 text-center text-sm hover:underline"
						on:click={() => {
							showDropdown = false;
							goto('/notifications');
						}}
					>
						View all notifications
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>
