import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

// Polls
export async function savePollToFirestore(poll) {
	const docRef = await addDoc(collection(db, 'polls'), poll);
	return docRef.id;
}

export async function getPollsFromFirestore() {
	const snap = await getDocs(collection(db, 'polls'));
	return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

// Tierlists
export async function saveTierlistToFirestore(tierlist) {
	const docRef = await addDoc(collection(db, 'tierlists'), tierlist);
	return docRef.id;
}

export async function getTierlistsFromFirestore() {
	const snap = await getDocs(collection(db, 'tierlists'));
	return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
