import { writable, derived } from 'svelte/store';

import { auth, firebaseUser, db } from './firebase';
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
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
export const currentUser = firebaseUser;

// Store for user group (example: 'dev', 'user', 'pro')
export const userGroup = writable<string | null>(null);

// Derived store for current user profile
export const currentUserProfile = derived(firebaseUser, ($firebaseUser, set) => {
	if ($firebaseUser) {
		getDoc(doc(db, 'users', $firebaseUser.uid)).then((userDoc) => {
			set(userDoc.exists() ? { ...userDoc.data(), id: $firebaseUser.uid } : null);
		});
	} else {
		set(null);
	}
});

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
	currentUser.set(user);
	if (user) {
		let group = await getUserGroup(user.uid);
		if (!group) {
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

// Utility function to check if user has pro-level access
export function hasProAccess(group: string | null): boolean {
	return group === 'pro' || group === 'dev';
}

// Store for pro access
export const hasProAccessStore = derived(userGroup, (group) => hasProAccess(group));
