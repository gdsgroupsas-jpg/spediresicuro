import { describe, expect, it } from "vitest";

describe("Environment Check", () => {
  it("Should have Supabase URL and Key", () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("ENV CHECK:");
    console.log("URL:", url ? `${url.substring(0, 10)}...` : "UNDEFINED");
    console.log("KEY:", key ? "PRESENT" : "UNDEFINED");

    expect(url).toBeDefined();
    expect(key).toBeDefined();
    expect(url).not.toContain("placeholder");
  });
});
