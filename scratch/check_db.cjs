const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.post.count();
  const posts = await prisma.post.findMany({ take: 5 });
  console.log('Total posts in DB:', count);
  console.log('Sample posts:', JSON.stringify(posts, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
