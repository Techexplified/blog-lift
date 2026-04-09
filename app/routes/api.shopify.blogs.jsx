import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  try {
    const { admin } = await authenticate.admin(request);

    const response = await admin.graphql(`
  query {
    blogs(first: 50) {
      edges {
        node {
          id
          title
          handle
          articles(first: 50) {
            edges {
              node {
                id
                title
                handle
                tags
                image {
                      url
                      altText
                    }
                publishedAt
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
      return new Response(
        JSON.stringify({ error: "Shopify GraphQL failed", details: json }),
        { status: 500 },
      );
    }

    return Response.json(json.data.blogs.edges);
  } catch (err) {
    console.error("🔥 API /shopify/blogs crashed:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
