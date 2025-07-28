import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function getUserGroup(uid: string): Promise<string | null> {
	const userDoc = await getDoc(doc(db, 'users', uid));
	if (userDoc.exists()) {
		return userDoc.data().group || null;
	}
	return null;
}

export async function setUserGroup(uid: string, group: string) {
	await setDoc(doc(db, 'users', uid), { group }, { merge: true });
}
