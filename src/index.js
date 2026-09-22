export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/test") {
      return Response.json({
        success: true,
        message: "JobKit Pro backend is working!"
      });
    }

    return env.ASSETS.fetch(request);
  }
};
