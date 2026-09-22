
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // TEST
    if (url.pathname === "/api/test") {
      return Response.json({
        success: true,
        message: "JobKit Pro backend is working!"
      });
    }

    // CREATE PAYMENT
    if (
      url.pathname === "/api/create-payment" &&
      request.method === "POST"
    ) {
      try {
        const data = await request.json();

        if (!data.name || !data.email || !data.phone) {
          return Response.json({
            success: false,
            message: "Name, email and phone are required."
          }, { status: 400 });
        }

        if (!env.RAZORPAY_KEY_ID) {
          return Response.json({
            success: false,
            message: "RAZORPAY_KEY_ID is missing."
          }, { status: 500 });
        }

        if (!env.RAZORPAY_KEY_SECRET) {
          return Response.json({
            success: false,
            message: "RAZORPAY_KEY_SECRET is missing."
          }, { status: 500 });
        }

        const referenceId = "JK" + Date.now();

        const auth = btoa(
          env.RAZORPAY_KEY_ID +
          ":" +
          env.RAZORPAY_KEY_SECRET
        );

        const razorpay = await fetch(
          "https://api.razorpay.com/v1/payment_links",
          {
            method: "POST",
            headers: {
              "Authorization": "Basic " + auth,
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

        const result = await razorpay.json();

        if (!razorpay.ok) {
          return Response.json({
            success: false,
            message:
              result?.error?.description ||
              "Razorpay payment link creation failed."
          }, { status: 500 });
        }

        return Response.json({
          success: true,
          payment_url: result.short_url,
          payment_link_id: result.id,
          reference_id: referenceId
        });

      } catch (error) {
        return Response.json({
          success: false,
          message: "Server error: " + error.message
        }, { status: 500 });
      }
    }

    // PAYMENT SUCCESS
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
          env.RAZORPAY_KEY_ID +
          ":" +
          env.RAZORPAY_KEY_SECRET
        );

        const response = await fetch(
          "https://api.razorpay.com/v1/payment_links/" +
          paymentLinkId,
          {
            headers: {
              "Authorization": "Basic " + auth
            }
          }
        );

        const link = await response.json();

        if (
          response.ok &&
          link.status === "paid" &&
          Number(link.amount_paid) >= 9900
        ) {
          return Response.redirect(
            "https://jrtufan51-lab.github.io/jobkit-pro/" +
            "?premium=unlocked&reference_id=" +
            encodeURIComponent(link.reference_id || ""),
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

    // WEBHOOK
    if (
      url.pathname === "/api/webhook" &&
      request.method === "POST"
    ) {
      return new Response("Webhook received", {
        status: 200
      });
    }

    // WEBSITE
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response(
      "JobKit Pro Worker is running.",
      { status: 200 }
    );
  }
};                    
