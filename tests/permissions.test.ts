import { canAccessCommerce, canReplyToTickets, isViewer } from "@/lib/permissions";
import type { Profile } from "@/types/domain";

function profile(role: Profile["role"]): Profile {
  return {
    id: "u1",
    company_id: "c1",
    role,
    first_name: "First",
    last_name: "Last",
    email: "test@example.com"
  };
}

describe("permissions", () => {
  it("viewer is read-only", () => {
    const viewer = profile("viewer");
    expect(isViewer(viewer)).toBe(true);
    expect(canReplyToTickets(viewer)).toBe(false);
    expect(canAccessCommerce(viewer)).toBe(false);
  });

  it("operator can reply and access commerce", () => {
    const operator = profile("operator");
    expect(canReplyToTickets(operator)).toBe(true);
    expect(canAccessCommerce(operator)).toBe(true);
  });
});
