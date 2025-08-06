declare module '$lib/firebase' {
	import type { Firestore } from 'firebase/firestore';
	export const db: Firestore;
}
