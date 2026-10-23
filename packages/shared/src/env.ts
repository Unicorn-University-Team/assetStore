// Reads a variable that the service cannot run without; fails at startup instead of on the first request.
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set (see .env.example)`);
  }
  return value;
}
