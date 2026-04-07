import { authenticate, sessionStorage } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  const sessions = await sessionStorage.findSessionsByShop(shop);
  if (sessions.length) {
    await sessionStorage.deleteSessions(sessions.map((s) => s.id));
  }

  return new Response();
};
