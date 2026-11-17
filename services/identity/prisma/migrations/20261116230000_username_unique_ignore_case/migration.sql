-- Usernames are unique regardless of case: "Tester" can't be registered when "tester" exists.
-- Prisma can't express an index on an expression, so it is only here. UserModel.findByUsername ignores case too.
CREATE UNIQUE INDEX "user_account_username_lower_key" ON "user_account"(lower("username"));
