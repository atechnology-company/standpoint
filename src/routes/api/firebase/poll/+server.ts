import type { RequestHandler } from '@sveltejs/kit';
import { db } from './../../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Function to clean undefined values
function cleanUndefinedValues(obj: any): any {
	if (obj === null || obj === undefined) {
		return null;
	}

	if (Array.isArray(obj)) {
		return obj.map(cleanUndefinedValues).filter((item) => item !== undefined);
	}

	if (typeof obj === 'object') {
		const cleaned: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) {
				cleaned[key] = cleanUndefinedValues(value);
			}
		}
		return cleaned;
	}

	return obj;
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const poll = await request.json();
		if (!poll.title || typeof poll.title !== 'string') {
			return new Response(JSON.stringify({ error: 'Missing or invalid poll title' }), {
				status: 400
			});
		}

		const cleanedPoll = cleanUndefinedValues({
			...poll,
			stats: {
				average: 0,
				std_dev: 0,
				total_votes: 0,
				vote_positions: []
			},
			likes: 0,
			comments: 0,
			created_at: serverTimestamp()
		});

		const docRef = await addDoc(collection(db, 'polls'), cleanedPoll);

		return new Response(JSON.stringify({ id: docRef.id }), { status: 201 });
	} catch (e: unknown) {
		return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
			status: 500
		});
	}
};
