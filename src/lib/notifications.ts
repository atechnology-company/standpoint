import { writable, derived } from 'svelte/store';

export interface Notification {
	id: string;
	type: 'like' | 'comment' | 'fork' | 'follow' | 'mention';
	title: string;
	message: string;
	link?: string;
	timestamp: number;
	read: boolean;
	icon?: string;
	// Bundling support
	count?: number; // Number of similar notifications bundled
	userIds?: string[]; // IDs of users who triggered this notification
	lastUserId?: string; // Most recent user who triggered this
}

function createNotificationStore() {
	const { subscribe, set, update } = writable<Notification[]>([]);

	return {
		subscribe,
		add: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
			const newNotification: Notification = {
				...notification,
				id: `notif-${Date.now()}-${Math.random()}`,
				timestamp: Date.now(),
				read: false
			};

			update((notifications) => [newNotification, ...notifications]);

			// Persist to localStorage
			if (typeof window !== 'undefined') {
				const stored = localStorage.getItem('standpoint_notifications');
				const existing = stored ? JSON.parse(stored) : [];
				existing.unshift(newNotification);
				// Keep only last 50 notifications
				const trimmed = existing.slice(0, 50);
				localStorage.setItem('standpoint_notifications', JSON.stringify(trimmed));
			}

			return newNotification.id;
		},
		markRead: (id: string) => {
			update((notifications) => {
				const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));

				// Update localStorage
				if (typeof window !== 'undefined') {
					localStorage.setItem('standpoint_notifications', JSON.stringify(updated));
				}

				return updated;
			});
		},
		markAllRead: () => {
			update((notifications) => {
				const updated = notifications.map((n) => ({ ...n, read: true }));

				// Update localStorage
				if (typeof window !== 'undefined') {
					localStorage.setItem('standpoint_notifications', JSON.stringify(updated));
				}

				return updated;
			});
		},
		remove: (id: string) => {
			update((notifications) => {
				const updated = notifications.filter((n) => n.id !== id);

				// Update localStorage
				if (typeof window !== 'undefined') {
					localStorage.setItem('standpoint_notifications', JSON.stringify(updated));
				}

				return updated;
			});
		},
		clear: () => {
			set([]);
			if (typeof window !== 'undefined') {
				localStorage.removeItem('standpoint_notifications');
			}
		},
		loadFromStorage: () => {
			if (typeof window !== 'undefined') {
				const stored = localStorage.getItem('standpoint_notifications');
				if (stored) {
					try {
						const notifications = JSON.parse(stored);
						set(notifications);
					} catch (error) {
						console.error('Failed to load notifications:', error);
					}
				}
			}
		}
	};
}

export const notifications = createNotificationStore();

// Helper to get unread count
export const unreadCount = writable(0);

notifications.subscribe((notifs) => {
	unreadCount.set(notifs.filter((n) => !n.read).length);
});
