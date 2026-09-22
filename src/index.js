export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test API
    if (url.pathname === "/api/test") {
      return Response.json({
        success: true,
        message: "JobKit Pro backend is working!"
      });
    }

    // Razorpay Webhook
    if (url.pathname === "/api/webhook" && request.method === "POST") {
      try {
        const body = await request.text();

        const signature = request.headers.get("X-Razorpay-Signature");

        if (!signature) {
          return new Response("Missing signature", { status: 400 });
        }

        // Webhook secret must be stored in Cloudflare Secrets
        const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
          return new Response("Webhook secret not configured", {
            status: 500
          });
        }

        const encoder = new TextEncoder();

        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(webhookSecret),
          {
            name: "HMAC",
            hash: "SHA-256"
          },
          false,
          ["sign"]
        );

        const signedData = await crypto.subtle.sign(
          "HMAC",
          key,
          encoder.encode(body)
        );

        const expectedSignature = [...new Uint8Array(signedData)]
          .map(b => b.toString(16).padStart(2, "0"))
          .join("");

        if (signature !== expectedSignature) {
          return new Response("Invalid signature", {
            status: 400
          });
        }

        const data = JSON.parse(body);

        if (data.event === "payment_link.paid") {
          return Response.json({
            success: true,
            message: "Payment received"
          });
        }

        return Response.json({
          success: true,
          message: "Webhook received"
        });

      } catch (error) {
        return new Response("Webhook error", {
          status: 500
        });
      }
    }

    return env.ASSETS.fetch(request);
  }
};
