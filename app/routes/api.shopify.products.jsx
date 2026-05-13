import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              handle
              variants(first: 1) {
                edges {
                  node {
                    price
                    inventoryQuantity
                  }
                }
              }
              images(first: 1) {
                edges {
                  node {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
    `);

    const json = await response.json();

    if (!response.ok || json.errors) {
      console.error("Shopify GraphQL Error:", json);
      return Response.json({ error: "Shopify GraphQL failed", details: json }, { status: 500 });
    }

    const products = json.data.products.edges.map(e => ({
      id: e.node.id,
      title: e.node.title,
      handle: e.node.handle,
      price: e.node.variants.edges[0]?.node?.price || "0.00",
      inventory: e.node.variants.edges[0]?.node?.inventoryQuantity || 0,
      image: e.node.images.edges[0]?.node?.url || "",
    }));

    return Response.json(products);
  } catch (err) {
    console.error("🔥 API /shopify/products crashed:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
