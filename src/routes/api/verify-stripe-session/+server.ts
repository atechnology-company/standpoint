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

	// Validate types
	if (typeof payload.session_id !== 'string' || typeof payload.uid !== 'string') {
		return json({ success: false, error: 'Invalid parameter types' }, { status: 400 });
	}

	// Validate session_id format (Stripe session IDs start with cs_)
	if (!payload.session_id.startsWith('cs_') || payload.session_id.length > 200) {
		return json({ success: false, error: 'Invalid session_id format' }, { status: 400 });
	}

	// Validate UID format
	if (payload.uid.length < 10 || payload.uid.length > 128) {
		return json({ success: false, error: 'Invalid uid format' }, { status: 400 });
	}

	// Sanitize inputs
	const sanitizedUid = payload.uid.replace(/[^a-zA-Z0-9_-]/g, '');
	const sanitizedSessionId = payload.session_id.replace(/[^a-zA-Z0-9_]/g, '');

	try {
		const session = await stripe.checkout.sessions.retrieve(sanitizedSessionId);

		const paymentComplete =
			session.payment_status === 'paid' && session.metadata?.uid === sanitizedUid;

		if (paymentComplete) {
			return json({ success: true });
		}

		return json({ success: false, error: 'Payment not verified' });
	} catch (error) {
		console.error('[stripe] failed to verify session', error);
		return json({ success: false, error: 'Failed to verify Stripe session' }, { status: 500 });
	}
};
