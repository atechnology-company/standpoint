import os
from sanic import Blueprint, response, Request
import stripe

stripe_secret = os.environ.get('STRIPE_SECRET_KEY')
frontend_url = os.environ.get('FRONTEND_URL')
print(f"[stripe_checkout] STRIPE_SECRET_KEY set: {bool(stripe_secret)}")
print(f"[stripe_checkout] FRONTEND_URL: {frontend_url}")
stripe.api_key = stripe_secret

stripe_bp = Blueprint('stripe', url_prefix='/api')

@stripe_bp.post('/create-stripe-session')
async def create_stripe_session(request: Request):
    data = request.json
    uid = data.get('uid')
    if not uid:
        return response.json({'error': 'Missing uid'}, status=400)

    try:
        print(f"[stripe_checkout] Creating Stripe session for uid: {uid}")
        price_id = os.environ.get('STRIPE_PRO_PRICE_ID')
        if not price_id:
            return response.json({'error': 'Stripe price ID not configured'}, status=500)
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_url}/pro?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{frontend_url}/pro",
            metadata={'uid': uid}
        )
        print(f"[stripe_checkout] Session created: {session.id}, url: {session.url}")
        return response.json({'url': session.url})
    except Exception as e:
        print(f"[stripe_checkout] Error creating session: {e}")
        return response.json({'error': str(e)}, status=500)
