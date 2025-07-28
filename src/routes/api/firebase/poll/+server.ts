import type { RequestHandler } from '@sveltejs/kit';
import { db } from './../../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const poll = await request.json();
		if (!poll.title || typeof poll.title !== 'string') {
			return new Response(JSON.stringify({ error: 'Missing or invalid poll title' }), {
				status: 400
			});
		}

		const docRef = await addDoc(collection(db, 'polls'), {
			...poll,
			stats: {
				average: 0,
				std_dev: 0,
				total_votes: 0,
				vote_positions: []
			},
			created_at: serverTimestamp()
		});

		return new Response(JSON.stringify({ id: docRef.id }), { status: 201 });
	} catch (e: unknown) {
		return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
			status: 500
		});
	}
};
