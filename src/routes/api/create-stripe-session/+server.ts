import Stripe from 'stripe';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const priceId = process.env.STRIPE_PRO_PRICE_ID;

const stripe = stripeSecretKey
	? new Stripe(stripeSecretKey, {
			apiVersion: '2024-06-20'
		})
	: null;

export const POST: RequestHandler = async ({ request, url }) => {
	if (!stripe) {
		return json({ error: 'Stripe secret key missing' }, { status: 500 });
	}

	if (!priceId) {
		return json({ error: 'Stripe price ID missing' }, { status: 500 });
	}

	let payload: { uid?: string };

	try {
		payload = await request.json();
	} catch (error) {
		return json({ error: 'Invalid JSON payload' }, { status: 400 });
	}

	if (!payload?.uid || typeof payload.uid !== 'string') {
		return json({ error: 'Missing or invalid uid' }, { status: 400 });
	}

	// Validate UID format (Firebase UIDs are typically 28 characters)
	if (payload.uid.length < 10 || payload.uid.length > 128) {
		return json({ error: 'Invalid uid format' }, { status: 400 });
	}

	// Sanitize UID - only allow alphanumeric and basic chars
	const sanitizedUid = payload.uid.replace(/[^a-zA-Z0-9_-]/g, '');
	if (sanitizedUid !== payload.uid) {
		return json({ error: 'Invalid uid characters' }, { status: 400 });
	}

	try {
		const session = await stripe.checkout.sessions.create({
			payment_method_types: ['card'],
			line_items: [
				{
					price: priceId,
					quantity: 1
				}
			],
			mode: 'payment',
			success_url: `${url.origin}/pro?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${url.origin}/pro`,
			metadata: { uid: sanitizedUid }
		});

		if (!session.url) {
			return json({ error: 'Unable to create checkout session' }, { status: 500 });
		}

		return json({ url: session.url });
	} catch (error) {
		console.error('[stripe] failed to create checkout session', error);
		return json({ error: 'Failed to create Stripe session' }, { status: 500 });
	}
};
