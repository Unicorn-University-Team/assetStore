import "dotenv/config";
import * as argon2 from "argon2";
import { prisma } from "./db/prisma";

const adminUsername = "admin";
const adminEmail = "admin@example.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (!adminPassword || adminPassword.trim().length === 0) {
  throw new Error("SEED_ADMIN_PASSWORD is not configured.");
}

const demoUserUsername = "demoUsername";
const demoUserEmail = "demouser@example.com";
const demoUserSusUsername = "demoSusUsername";
const demoUserSusEmail = "demosususer@example.com";

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

  if (process.env.NODE_ENV === "development") {
    const demoUserPassword = process.env.SEED_DEMO_USER_PASSWORD;
    const demoUserSusPassword = process.env.SEED_DEMO_USER_SUS_PASSWORD;
    if (!demoUserPassword || demoUserPassword.trim().length === 0) {
      throw new Error("SEED_DEMO_USER_PASSWORD is not configured.");
    }
    if (!demoUserSusPassword || demoUserSusPassword.trim().length === 0) {
      throw new Error("SEED_DEMO_USER_SUS_PASSWORD is not configured.");
    }
    const demoUserPasswordHash = await argon2.hash(demoUserPassword);
    const demoUserSusPasswordHash = await argon2.hash(demoUserSusPassword);
    await prisma.user.upsert({
      where: { email: demoUserEmail },
      update: {},
      create: {
        username: demoUserUsername,
        email: demoUserEmail,
        passwordHash: demoUserPasswordHash,
        role: "USER",
        status: "ACTIVE",
      },
    });

    await prisma.user.upsert({
      where: { email: demoUserSusEmail },
      update: {},
      create: {
        username: demoUserSusUsername,
        email: demoUserSusEmail,
        passwordHash: demoUserSusPasswordHash,
        role: "USER",
        status: "SUSPENDED",
      },
    });
  }

  console.log("Seed completed successfully.");
}

main(adminPassword)
  .catch((error) => {
    console.log("Seed failed: ", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
