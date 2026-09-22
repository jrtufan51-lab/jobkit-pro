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

    // Create a payment link for this user
    if (url.pathname === "/api/create-payment" && request.method === "POST") {
      try {
        const data = await request.json();

        if (!data.name || !data.email || !data.phone) {
          return Response.json(
            {
              success: false,
              message: "Name, email and phone are required."
            },
            { status: 400 }
          );
        }

        const referenceId =
          "JK" + Date.now().toString().slice(-12);

        const auth = btoa(
          `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
        );

        const razorpayResponse = await fetch(
          "https://api.razorpay.com/v1/payment_links",
          {
            method: "POST",
            headers: {
              "Authorization": `Basic ${auth}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              amount: 9900,
              currency: "INR",
              accept_partial: false,
              reference_id: referenceId,
              description: "JobKit Pro Premium - ₹99",
              customer: {
                name: data.name,
                email: data.email,
                contact: data.phone
              },
              notify: {
                sms: true,
                email: true
              },
              reminder_enable: false,
              callback_url:
                "https://jrtufan51-lab.github.io/jobkit-pro/?payment=success",
              callback_method: "get"
            })
          }
        );

        const result = await razorpayResponse.json();

        if (!razorpayResponse.ok) {
          return Response.json(
            {
              success: false,
              message: "Could not create payment link."
            },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          payment_url: result.short_url,
          reference_id: referenceId
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Payment setup error."
          },
          { status: 500 }
        );
      }
    }

    // Razorpay Webhook
    if (
      url.pathname === "/api/webhook" &&
      request.method === "POST"
    ) {
      try {
        const body = await request.text();

        const signature =
          request.headers.get("X-Razorpay-Signature");

        if (!signature) {
          return new Response("Missing signature", {
            status: 400
          });
        }

        const webhookSecret =
          env.RAZORPAY_WEBHOOK_SECRET;

        if (!webhookSecret) {
          return new Response(
            "Webhook secret not configured",
            { status: 500 }
          );
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

        const signedData =
          await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(body)
          );

        const expectedSignature =
          [...new Uint8Array(signedData)]
            .map(b =>
              b.toString(16).padStart(2, "0")
            )
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
