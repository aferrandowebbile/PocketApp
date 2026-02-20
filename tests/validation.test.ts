import { canCreateValidation } from "@/lib/validation";

describe("canCreateValidation", () => {
  it("allows new validation if no prior validation", () => {
    expect(canCreateValidation(null, new Date("2026-01-01T12:00:00.000Z"), 5)).toBe(true);
  });

  it("blocks validation inside cooldown", () => {
    expect(
      canCreateValidation("2026-01-01T11:58:00.000Z", new Date("2026-01-01T12:00:00.000Z"), 5)
    ).toBe(false);
  });

  it("allows validation after cooldown", () => {
    expect(
      canCreateValidation("2026-01-01T11:45:00.000Z", new Date("2026-01-01T12:00:00.000Z"), 5)
    ).toBe(true);
  });
});
