import { writable } from 'svelte/store';

import { auth } from './firebase';
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import { getUserGroup, setUserGroup } from './user-groups';

export interface ImageResult {
	url: string;
	title: string;
	thumbnailLink: string;
	image?: string;
	link?: string;
	snippet?: string;
}

// Store for holding image search results
export const resultImages = writable<ImageResult[]>([]);

// Store for current user
export const currentUser = writable<User | null>(null);

// Store for user group (example: 'dev', 'user', 'pro')
export const userGroup = writable<string | null>(null);

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
	currentUser.set(user);
	if (user) {
		// Fetch user group from Firestore
		let group = await getUserGroup(user.uid);
		if (!group) {
			// If user doc doesn't exist, set default group
			group = 'user';
			await setUserGroup(user.uid, group);
		}
		userGroup.set(group);
	} else {
		userGroup.set(null);
	}
});

// Sign in with Google
export async function signInWithGoogle() {
	const provider = new GoogleAuthProvider();
	await signInWithPopup(auth, provider);
}

// Sign out
export async function signOutUser() {
	await signOut(auth);
}
