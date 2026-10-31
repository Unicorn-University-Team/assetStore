import "dotenv/config";
import * as argon2 from "argon2";
import { prisma } from "./db/prisma";

const adminUsername = "admin";
const adminEmail = "admin@example.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.trim().length === 0) {
  throw new Error("SEED_ADMIN_PASSWORD is not configured.");
}

async function main(adminPassword: string) {
  const adminPasswordHash = await argon2.hash(adminPassword);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      username: adminUsername,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
}

main(adminPassword)
  .catch((error) => {
    console.log("Seed failed: ", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
