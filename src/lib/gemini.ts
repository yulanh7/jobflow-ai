import { GoogleGenerativeAI } from "@google/generative-ai";
import { isRateLimitError } from "./utils";

export const geminiPrimary = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
export const geminiFallback = process.env.GEMINI_API_KEY_2
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY_2)
  : null;

export async function generateWithFallback<T>(
  fn: (client: GoogleGenerativeAI) => Promise<T>
): Promise<T> {
  try {
    return await fn(geminiPrimary);
  } catch (err) {
    if (isRateLimitError(err) && geminiFallback) {
      return await fn(geminiFallback);
    }
    throw err;
  }
}
