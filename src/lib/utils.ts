import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS class names, resolving conflicts with tailwind-merge
 * and handling conditional classes with clsx.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}