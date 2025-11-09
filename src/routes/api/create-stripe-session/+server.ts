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

	if (!payload?.uid) {
		return json({ error: 'Missing uid' }, { status: 400 });
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
			metadata: { uid: payload.uid }
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
