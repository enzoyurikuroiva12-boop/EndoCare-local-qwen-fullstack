import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { storage: { from: vi.fn() } } }));
import { getProfileAvatarPath } from "./authProfile";
import { getInitials } from "@/components/ProfileAvatar";
import { getProfilePhotoExtension, isProfilePhotoMimeType, PROFILE_PHOTO_MAX_BYTES } from "./profilePhoto";
import { getMetrics } from "@/components/ProfilePhotoEditor";

describe("foto de perfil", () => {
  it("aceita somente imagens rasterizadas permitidas e respeita o limite", () => {
    expect(isProfilePhotoMimeType("image/jpeg")).toBe(true);
    expect(isProfilePhotoMimeType("image/png")).toBe(true);
    expect(isProfilePhotoMimeType("image/webp")).toBe(true);
    expect(isProfilePhotoMimeType("image/svg+xml")).toBe(false);
    expect(PROFILE_PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it("gera extensão estável e rejeita caminho de outro usuário", () => {
    expect(getProfilePhotoExtension("image/jpeg")).toBe("jpg");
    expect(getProfilePhotoExtension("image/webp")).toBe("webp");
    expect(getProfileAvatarPath({ id: "user-1", user_metadata: { avatar_path: "user-1/photo.webp" } })).toBe("user-1/photo.webp");
    expect(getProfileAvatarPath({ id: "user-1", user_metadata: { avatar_path: "user-2/photo.webp" } })).toBeNull();
  });

  it("mantém o recorte quadrado dentro da imagem em diferentes níveis de zoom", () => {
    expect(getMetrics(1200, 800, 1)).toEqual({ cropSize: 800, minX: 400, maxX: 800, minY: 400, maxY: 400 });
    expect(getMetrics(1200, 800, 2)).toEqual({ cropSize: 400, minX: 200, maxX: 1000, minY: 200, maxY: 600 });
  });

  it("usa iniciais quando não há foto", () => {
    expect(getInitials("Ana Silva")).toBe("AS");
    expect(getInitials("Ana")).toBe("AN");
    expect(getInitials(" ")).toBe("EC");
  });
});
