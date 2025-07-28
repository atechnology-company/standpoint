import type { RequestHandler } from '@sveltejs/kit';
import { db } from '../../../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const tierlist = await request.json();
		// Basic validation
		if (!tierlist.title || typeof tierlist.title !== 'string') {
			return new Response(JSON.stringify({ error: 'Missing or invalid tierlist title' }), {
				status: 400
			});
		}
		if (!tierlist.owner) {
			return new Response(JSON.stringify({ error: 'Missing owner for tierlist' }), {
				status: 400
			});
		}

		// Save tierlist
		const docRef = await addDoc(collection(db, 'tierlists'), {
			...tierlist,
			created_at: serverTimestamp()
		});

		// Save placements as subcollection if provided
		if (tierlist.placements && Array.isArray(tierlist.placements)) {
			for (const placement of tierlist.placements) {
				await setDoc(doc(db, 'tierlists', docRef.id, 'placements', placement.item_id), placement);
			}
		}

		return new Response(JSON.stringify({ id: docRef.id }), { status: 201 });
	} catch (e: unknown) {
		return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
			status: 500
		});
	}
};
