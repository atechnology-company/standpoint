import Stripe from 'stripe';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const stripe = stripeSecretKey
	? new Stripe(stripeSecretKey, {
			apiVersion: '2024-06-20'
		})
	: null;

interface VerifyPayload {
	session_id?: string;
	uid?: string;
}

export const POST: RequestHandler = async ({ request }) => {
	if (!stripe) {
		return json({ success: false, error: 'Stripe secret key missing' }, { status: 500 });
	}

	let payload: VerifyPayload;
	try {
		payload = await request.json();
	} catch (error) {
		return json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
	}

	if (!payload.session_id || !payload.uid) {
		return json({ success: false, error: 'Missing session_id or uid' }, { status: 400 });
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(payload.session_id);

		const paymentComplete =
			session.payment_status === 'paid' && session.metadata?.uid === payload.uid;

		if (paymentComplete) {
			return json({ success: true });
		}

		return json({ success: false, error: 'Payment not verified' });
	} catch (error) {
		console.error('[stripe] failed to verify session', error);
		return json({ success: false, error: 'Failed to verify Stripe session' }, { status: 500 });
	}
};
