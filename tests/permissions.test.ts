import { canAccessCommerce, isViewer } from "@/lib/permissions";
import type { Profile } from "@/types/domain";

function profile(role: Profile["role"]): Profile {
  return {
    id: "u1",
    company_id: "c1",
    tenant_id: "t1",
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
    expect(canAccessCommerce(viewer)).toBe(false);
  });

  it("operator can access commerce", () => {
    const operator = profile("operator");
    expect(canAccessCommerce(operator)).toBe(true);
  });
});
