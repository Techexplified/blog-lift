-- Aligns "Post" with prisma/schema.prisma (shop + index).

ALTER TABLE "Post" ADD COLUMN "shop" TEXT NOT NULL DEFAULT '';

CREATE INDEX "Post_shop_idx" ON "Post"("shop");
