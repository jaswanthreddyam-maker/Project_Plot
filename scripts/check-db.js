const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.user.count();
        console.log('--- USER COUNT ---');
        console.log(count);
        const users = await prisma.user.findMany({ select: { email: true } });
        console.log('--- USERS ---');
        users.forEach(u => console.log(u.email));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
