import { db } from './firebase';
import { doc, updateDoc, getDoc, collection, deleteDoc, getDocs, setDoc } from 'firebase/firestore';

// Update user profile fields
export async function updateUserProfile(
	uid: string,
	data: Partial<{ displayName: string; photoURL: string; bannerURL: string }>
) {
	await updateDoc(doc(db, 'users', uid), data);
}

// Follow a user
export async function followUser(currentUid: string, targetUid: string) {
	await setDoc(doc(db, 'users', targetUid, 'followers', currentUid), { followedAt: Date.now() });
	await setDoc(doc(db, 'users', currentUid, 'following', targetUid), { followedAt: Date.now() });
}

// Unfollow a user
export async function unfollowUser(currentUid: string, targetUid: string) {
	await deleteDoc(doc(db, 'users', targetUid, 'followers', currentUid));
	await deleteDoc(doc(db, 'users', currentUid, 'following', targetUid));
}

// Check if current user follows target
export async function isFollowing(currentUid: string, targetUid: string): Promise<boolean> {
	const docSnap = await getDoc(doc(db, 'users', targetUid, 'followers', currentUid));
	return docSnap.exists();
}

// Check if two users are friends (mutual following)
export async function isFriend(currentUid: string, targetUid: string): Promise<boolean> {
	const [a, b] = await Promise.all([
		isFollowing(currentUid, targetUid),
		isFollowing(targetUid, currentUid)
	]);
	return a && b;
}

// Get follower/following counts
export async function getFollowerCount(uid: string): Promise<number> {
	const snap = await getDocs(collection(db, 'users', uid, 'followers'));
	return snap.size;
}
export async function getFollowingCount(uid: string): Promise<number> {
	const snap = await getDocs(collection(db, 'users', uid, 'following'));
	return snap.size;
}

// Get aura and pro status
export async function getAuraAndPro(uid: string): Promise<{ aura: number; pro: boolean }> {
	const userDoc = await getDoc(doc(db, 'users', uid));
	if (userDoc.exists()) {
		const data = userDoc.data();
		return { aura: data.aura || 0, pro: !!data.pro };
	}
	return { aura: 0, pro: false };
}
