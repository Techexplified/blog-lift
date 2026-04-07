import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      console.log(`Handling CUSTOMERS_DATA_REQUEST for ${shop}`);
      break;
    case "CUSTOMERS_REDACT":
      console.log(`Handling CUSTOMERS_REDACT for ${shop}`);
      break;
    case "SHOP_REDACT":
      console.log(`Handling SHOP_REDACT for ${shop}`);
      break;
    default:
      console.warn(`Unhandled webhook topic: ${topic} for ${shop}`);
  }

  return new Response(null, { status: 200 });
};
