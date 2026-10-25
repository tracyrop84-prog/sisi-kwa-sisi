import "server-only";

// Every SMS goes through sendSms. SMS_MODE picks how:
// - "test" (the default): prints the message to the server log instead of sending it
// - add real providers here later, e.g. "africastalking" with its own API key
//   in server-only environment variables (never NEXT_PUBLIC_).
export async function sendSms(to: string, message: string): Promise<void> {
  const mode = process.env.SMS_MODE || "test";
  switch (mode) {
    case "test":
      console.log(`[SMS test mode] To ${to}: ${message}`);
      return;
    default:
      throw new Error(`Unknown SMS_MODE "${mode}". Use "test" until a real provider is added in src/lib/sms.ts.`);
  }
}
