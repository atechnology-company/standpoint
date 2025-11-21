import { db } from './firebase';
import {
	collection,
	query,
	orderBy,
	limit,
	onSnapshot,
	updateDoc,
	doc,
	getDocs,
	type QuerySnapshot,
	type DocumentChange
} from 'firebase/firestore';
import { notifications } from './notifications';
import type { Notification } from './notifications';

/**
 * Subscribe to real-time Firebase notifications for a user
 * Syncs Firebase notifications with local notification store
 */
export function subscribeToUserNotifications(userId: string) {
	try {
		const notificationsRef = collection(db, 'users', userId, 'notifications');
		const q = query(notificationsRef, orderBy('timestamp', 'desc'), limit(50));

		const unsubscribe = onSnapshot(
			q,
			(snapshot: QuerySnapshot) => {
				snapshot.docChanges().forEach((change: DocumentChange) => {
					const data = change.doc.data();
					const notification: Omit<Notification, 'id' | 'timestamp' | 'read'> = {
						type: data.type as 'like' | 'comment' | 'fork' | 'mention',
						title: formatNotificationTitle(data),
						message: formatNotificationMessage(data),
						link: getNotificationLink(data)
					};

					if (change.type === 'added') {
						// Add new notification
						notifications.add(notification);
					} else if (change.type === 'modified') {
						// Update read status if changed
						if (data.read) {
							notifications.markRead(change.doc.id);
						}
					}
				});
			},
			(error: Error) => {
				console.error('Error subscribing to notifications:', error);
			}
		);

		return unsubscribe;
	} catch (error) {
		console.error('Error setting up notification subscription:', error);
		return () => {};
	}
}

/**
 * Format notification title based on type
 */
function formatNotificationTitle(data: any): string {
	switch (data.type) {
		case 'like':
			return 'New Like';
		case 'comment':
			return 'New Comment';
		case 'fork':
			return 'Content Forked';
		case 'mention':
			return 'Mentioned';
		default:
			return 'Notification';
	}
}

/**
 * Format notification message based on type and data
 */
function formatNotificationMessage(data: any): string {
	const contentType = data.contentType || 'content';
	const contentTitle = data.contentTitle || 'Untitled';

	switch (data.type) {
		case 'like':
			return `Someone liked your ${contentType}: "${contentTitle}"`;
		case 'comment':
			return `New comment on your ${contentType}: "${contentTitle}"`;
		case 'fork':
			return `Someone forked your ${contentType}: "${contentTitle}"`;
		case 'mention':
			return `You were mentioned in "${contentTitle}"`;
		default:
			return `New notification about "${contentTitle}"`;
	}
}

/**
 * Generate link URL for notification
 */
function getNotificationLink(data: any): string {
	const contentType = data.contentType || 'poll';
	const contentId = data.contentId;

	if (!contentId) return '/';

	switch (contentType) {
		case 'poll':
			return `/polls/${contentId}`;
		case 'tierlist':
			return `/tierlists/${contentId}`;
		case 'user':
			return `/user/${contentId}`;
		default:
			return '/';
	}
}

/**
 * Mark a notification as read in Firebase
 */
export async function markNotificationRead(userId: string, notificationId: string) {
	try {
		const notificationRef = doc(db, 'users', userId, 'notifications', notificationId);
		await updateDoc(notificationRef, {
			read: true
		});
	} catch (error) {
		console.error('Error marking notification as read:', error);
	}
}

/**
 * Mark all notifications as read in Firebase
 */
export async function markAllNotificationsRead(userId: string) {
	try {
		const notificationsRef = collection(db, 'users', userId, 'notifications');
		const q = query(notificationsRef);
		const snapshot = await getDocs(q);

		const updates = snapshot.docs.map((docSnap) => updateDoc(docSnap.ref, { read: true }));

		await Promise.all(updates);
	} catch (error) {
		console.error('Error marking all notifications as read:', error);
	}
}
