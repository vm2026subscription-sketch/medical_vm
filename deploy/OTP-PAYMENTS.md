# Enable OTP and Razorpay

The integration is implemented and tested with isolated provider responses. Your actual `.env` credentials have not been changed, and no real OTP or payment was sent during these checks. Credentials alone do not configure provider dashboards: complete the settings below, restart the backend, then verify real delivery and a Razorpay test-mode payment.

## Email OTP

In `backend/.env`:

```dotenv
EMAIL_OTP_PROVIDER=smtp
SMTP_HOST=your-provider-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
SMTP_FROM="MedPath by Vidyarthi Mitra <your-verified-sender-address>"
```

Use your provider's verified sender/domain and SMTP credentials. Port 587 requires STARTTLS; port 465 uses TLS immediately. For Gmail, use an eligible account with 2-Step Verification and an App Password, not the normal account password. See [Google's App Password instructions](https://support.google.com/accounts/answer/185833?hl=en).

Restart the backend, select **Email** on Login, request a code and check inbox/spam. Confirm that a correct code logs in and an already-used code is rejected. Codes expire in five minutes, allow five verification attempts, and have a 60-second resend cooldown per recipient across IP addresses. Requesting a new code replaces the previous challenge. SMTP acceptance is not proof of inbox delivery; check your provider's delivery logs if mail is missing.

## Phone OTP (separate from email)

Choose one supported provider. Filling SMTP settings only enables email login.

**MSG91:**

```dotenv
OTP_PROVIDER=msg91
MSG91_AUTH_KEY=your-auth-key
MSG91_TEMPLATE_ID=your-sendotp-template-id
```

Configure an approved SendOTP template and the sender/DLT mapping required by your account. Use the SendOTP template ID expected by the OTP API, rather than a campaign/flow ID. Confirm your account has SMS balance. See [MSG91 OTP API](https://docs.msg91.com/otp) and [MSG91 template/DLT setup](https://msg91.com/guide/steps-for-dlt-process-registration).

**Twilio Verify:**

```dotenv
OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_VERIFY_SID=your-verify-service-sid
```

Create a Verify service, configure a **six-digit** code, enable the destination country and complete any account/trial restrictions. This integration uses Twilio Verify's send/check endpoints, not the generic Messaging API. See [Twilio Verify](https://www.twilio.com/docs/verify/api/verification) and [Verification Check](https://www.twilio.com/docs/verify/api/verification-check).

`mock` is development-only and is rejected in production. All real provider paths have timeouts; failed sends cannot be used to log in. New OTP storage uses the `OtpChallenge` collection. Existing accounts are preserved, but any code requested before deploying this version must be requested again.

## Razorpay

1. In Razorpay, obtain **Test mode** keys for staging first. Use **Live mode** keys only when the merchant account is activated and the production journey has been verified. Never mix a test key with a live secret.
2. Set these backend variables:

   ```dotenv
   RAZORPAY_KEY_ID=your-key-id
   RAZORPAY_KEY_SECRET=your-key-secret
   RAZORPAY_WEBHOOK_SECRET=your-own-long-random-webhook-secret
   ```

   The webhook secret is a value you choose and enter in both `.env` and the Razorpay webhook settings. It is different from the API key secret and must not be blank. Checkout is intentionally unavailable until all three are configured.
3. In the Razorpay Dashboard, create a webhook for:

   ```text
   https://medical.vidyarthimitra.org/api/v1/billing/webhook/razorpay
   ```

   Use the same secret, enable `payment.captured` and `payment.failed`, and save it in the same Test/Live mode as your keys. `order.paid` is also supported but is optional. For staging use its own deployed HTTPS URL and Test-mode webhook. The URL must reach Express without an authentication page or proxy rewrite. See [Razorpay webhook setup](https://razorpay.com/docs/webhooks/) and [signature validation/testing](https://razorpay.com/docs/webhooks/validate-test/).
4. Configure **automatic payment capture** in Razorpay. Premium and counselling bookings are activated only for captured payments, not merely authorized payments. See [capture settings](https://razorpay.com/docs/payments/payments/capture-settings/).
5. In the MedPath admin panel, publish an active plan such as Season Pass with **price 99 (rupees)**, the intended validity in days and accurate feature descriptions. No plan is seeded automatically. A checkout with less than INR 1 payable is rejected; use admin grants for free premium access. Counselling also needs an active service, counsellor and future availability slots.
6. Ensure MongoDB Atlas/a replica set is configured and run `npm run prepare:production` in the backend before deploying. Start the API and worker. The configured database was prepared during this code update; each separate staging/production database needs its own preparation.
7. Restart the backend after editing `.env`. With Compose, use `docker compose up -d --force-recreate api worker`; a plain container restart does not reload changed `env_file` values. Deploy the updated frontend build as well. No Razorpay secret belongs in frontend `VITE_*` variables.

## Acceptance checks before real customers

- Email/phone: request, receive and verify a real OTP; test an incorrect code, expiry, resend and reuse rejection.
- Payment: sign in with a test user, complete a Razorpay Test-mode payment, verify **Payment confirmed**, then verify premium cutoff access and the paid record in Admin > Payments.
- Check Razorpay webhook delivery logs for a successful response. Replay the event: it must not add another subscription or consume the coupon again.
- Confirming the browser checkout sends its signature to the backend. The server checks ownership, order, amount, currency and the provider's captured state. Webhooks and browser confirmation share one transactional activation flow.
- If confirmation is delayed or unavailable, the page stays pending and keeps a payment reference through refresh. **Check payment status** queries the provider through the backend and can recover a missed webhook. Do not create another checkout if debited. The pending reference is stored per browser tab; a reference from another signed-in account cannot be used because the backend enforces ownership.
- Counselling: payment confirmation reserves the exact booking. A late payment whose slot has been released/reassigned is marked `manual_review`, with details in Admin > Payments; another student's slot is never overwritten. Contact the student and arrange rebooking or a refund. Refund execution is an operations action in Razorpay, not an automatic promise from this website. The counselling team must provide a real meeting link separately.

The isolated tests validate signature rejection, captured-state enforcement, duplicate/concurrent webhooks, transaction rollback/retry, missed-webhook recovery, recipient cooldown, OTP expiry/reuse and provider error handling. Actual SMTP/SMS delivery, merchant activation, webhook reachability and live settlement still require the configured services and deployed domain.
