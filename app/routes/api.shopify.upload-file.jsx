// app/routes/api.shopify.upload-file.jsx
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const { imageBase64, fileName } = await request.json();

  if (!imageBase64) {
    return Response.json({ error: "Image missing" }, { status: 400 });
  }

  // Guardrails to prevent accidental oversized uploads during review.
  // Keeps functionality identical for normal images, but blocks abuse.
  if (typeof imageBase64 !== "string" || !imageBase64.startsWith("data:image/")) {
    return Response.json({ error: "Invalid image format" }, { status: 400 });
  }
  // ~8MB base64 string cap (roughly <= ~6MB binary depending on encoding).
  if (imageBase64.length > 8_000_000) {
    return Response.json({ error: "Image too large" }, { status: 413 });
  }

  try {
    const response = await admin.graphql(
      `#graphql
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            ... on MediaImage {
              id
              image {
                url
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
      `,
      {
        variables: {
          files: [
            {
              contentType: "IMAGE",
              originalSource: imageBase64, // base64 allowed here
              filename: fileName || "blog-image.png",
            },
          ],
        },
      },
    );

    const json = await response.json();

    const error = json.data?.fileCreate?.userErrors?.[0];
    if (error) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    const url = json.data.fileCreate.files?.[0]?.image?.url;

    return Response.json({ url });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
};
