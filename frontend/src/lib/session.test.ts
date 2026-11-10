import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  clearAuth: vi.fn(),
  clearCache: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/services/api", () => ({ api: { post: mocks.post } }));
vi.mock("@/store/authStore", () => ({
  useAuthStore: { getState: () => ({ token: "token", clearAuth: mocks.clearAuth }) },
}));
vi.mock("@/lib/queryClient", () => ({ queryClient: { clear: mocks.clearCache } }));
vi.mock("sonner", () => ({ toast: { error: mocks.error } }));

import { logout } from "./session";

describe("logout", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("clears local state after the server revokes the session", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { assign } });
    mocks.post.mockResolvedValueOnce({});
    await logout();
    expect(mocks.post).toHaveBeenCalledWith("/auth/logout", undefined, { timeout: 10000 });
    expect(mocks.clearAuth).toHaveBeenCalledOnce();
    expect(mocks.clearCache).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("keeps the session and reports an error if revocation fails", async () => {
    mocks.post.mockRejectedValueOnce(new Error("offline"));
    await logout();
    expect(mocks.clearAuth).not.toHaveBeenCalled();
    expect(mocks.clearCache).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledOnce();
  });
});
