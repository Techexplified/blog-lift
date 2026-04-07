-- Draft vs published + updatedAt for Neon/Postgres

ALTER TABLE "Post" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Post" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "Post_shop_published_idx" ON "Post"("shop", "published");
