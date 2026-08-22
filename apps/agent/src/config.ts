import Constants from "expo-constants";

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ||
  "https://ccc-three-kappa.vercel.app"
).replace(/\/$/, "");

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || "https://ffccfeodymiwwqshphmh.supabase.co";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
