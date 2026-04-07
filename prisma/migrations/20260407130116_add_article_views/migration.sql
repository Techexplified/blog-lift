-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "shopifyArticleId" TEXT,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "shop" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ArticleView" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleView_shop_idx" ON "ArticleView"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleView_shop_articleId_key" ON "ArticleView"("shop", "articleId");

-- CreateIndex
CREATE INDEX "Post_shop_shopifyArticleId_idx" ON "Post"("shop", "shopifyArticleId");
