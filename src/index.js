export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Test
    if (url.pathname === "/api/test") {
      return Response.json({
        success: true,
        message: "JobKit Pro backend is working!"
      });
    }

    // Create ₹99 Payment Link
    if (
      url.pathname === "/api/create-payment" &&
      request.method === "POST"
    ) {
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
          "JK" + Date.now().toString();

        const auth = btoa(
          `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
        );

        const response = await fetch(
          "https://api.razorpay.com/v1/payment_links",
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              amount: 9900,
              currency: "INR",
              accept_partial: false,
              reference_id: referenceId,
              description: "JobKit Pro Premium",
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
                "https://jobkit-pro.jrtufan51.workers.dev/api/payment-success",
              callback_method: "get"
            })
          }
        );

        const result = await response.json();

        if (!response.ok) {
          return Response.json(
            {
              success: false,
              message: "Razorpay payment link creation failed."
            },
            { status: 500 }
          );
        }

        return Response.json({
          success: true,
          payment_url: result.short_url,
          payment_link_id: result.id,
          reference_id: referenceId
        });

      } catch (error) {
        return Response.json(
          {
            success: false,
            message: "Payment setup failed."
          },
          { status: 500 }
        );
      }
    }

    // Payment success callback
    if (
      url.pathname === "/api/payment-success" &&
      request.method === "GET"
    ) {
      const paymentLinkId =
        url.searchParams.get("razorpay_payment_link_id");

      if (!paymentLinkId) {
        return new Response(
          "Payment information missing.",
          { status: 400 }
        );
      }

      try {
        const auth = btoa(
          `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
        );

        const response = await fetch(
          `https://api.razorpay.com/v1/payment_links/${paymentLinkId}`,
          {
            headers: {
              Authorization: `Basic ${auth}`
            }
          }
        );

        const link = await response.json();

        if (
          response.ok &&
          link.status === "paid" &&
          link.amount_paid >= 9900
        ) {
          const redirectUrl =
            "https://jrtufan51-lab.github.io/jobkit-pro/" +
            "?premium=unlocked&reference_id=" +
            encodeURIComponent(
              link.reference_id || ""
            );

          return Response.redirect(
            redirectUrl,
            302
          );
        }

        return new Response(
          "Payment has not been confirmed yet.",
          { status: 400 }
        );

      } catch (error) {
        return new Response(
          "Payment verification failed.",
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
          return new Response(
            "Missing signature",
            { status: 400 }
          );
        }

        const secret =
          env.RAZORPAY_WEBHOOK_SECRET;

        if (!secret) {
          return new Response(
            "Webhook secret not configured",
            { status: 500 }
          );
        }

        const encoder = new TextEncoder();

        const key =
          await crypto.subtle.importKey(
            "raw",
            encoder.encode(secret),
            {
              name: "HMAC",
              hash: "SHA-256"
            },
            false,
            ["sign"]
          );

        const signed =
          await crypto.subtle.sign(
            "HMAC",
            key,
            encoder.encode(body)
          );

        const expected =
          [...new Uint8Array(signed)]
            .map(b =>
              b.toString(16).padStart(2, "0")
            )
            .join("");

        if (signature !== expected) {
          return new Response(
            "Invalid signature",
            { status: 400 }
          );
        }

        const data = JSON.parse(body);

        return Response.json({
          success: true,
          received: true,
          event: data.event
        });

      } catch (error) {
        return new Response(
          "Webhook error",
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
