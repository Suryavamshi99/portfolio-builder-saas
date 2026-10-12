import { describe, expect, it, vi } from "vitest";
import {
  PHOTO_SIGNED_URL_TTL_SECONDS,
  PROMPT_SIGNED_URL_TTL_SECONDS,
  signStorageMarkers,
} from "./storage-markers";
import { embedStorageImagesInHtml } from "./template/images";
import { STORAGE_MARKER_PREFIX } from "./finalize-html";

describe("storage-markers", () => {
  it("exports TTL constants correctly", () => {
    expect(PHOTO_SIGNED_URL_TTL_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(PROMPT_SIGNED_URL_TTL_SECONDS).toBe(60 * 60);
  });

  it("signs distinct markers and replaces all occurrences", async () => {
    const createSignedUrl = vi.fn().mockImplementation((path: string) => {
      if (path === "user-1/photo.jpg") {
        return Promise.resolve({ data: { signedUrl: "https://signed.co/photo.jpg" }, error: null });
      }
      return Promise.resolve({ data: null, error: new Error("not found") });
    });

    const mockSupabase = {
      storage: {
        from: () => ({ createSignedUrl }),
      },
    } as any;

    const html = `<div>
      <img src="${STORAGE_MARKER_PREFIX}user-1/photo.jpg">
      <img src="${STORAGE_MARKER_PREFIX}user-1/photo.jpg">
      <img src="${STORAGE_MARKER_PREFIX}user-1/missing.jpg">
      <img src="${STORAGE_MARKER_PREFIX}other-user/photo.jpg">
    </div>`;

    const result = await signStorageMarkers(html, mockSupabase, "user-1", PHOTO_SIGNED_URL_TTL_SECONDS);

    // createSignedUrl should only be called for own paths
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/photo.jpg", PHOTO_SIGNED_URL_TTL_SECONDS);
    expect(createSignedUrl).toHaveBeenCalledWith("user-1/missing.jpg", PHOTO_SIGNED_URL_TTL_SECONDS);
    expect(createSignedUrl).not.toHaveBeenCalledWith("other-user/photo.jpg", expect.anything());
    expect(result).toContain('src="https://signed.co/photo.jpg"');
    // Missing should stay as marker
    expect(result).toContain(`src="${STORAGE_MARKER_PREFIX}user-1/missing.jpg"`);
    // Foreign path should stay as marker
    expect(result).toContain(`src="${STORAGE_MARKER_PREFIX}other-user/photo.jpg"`);
  });

  it("returns unchanged HTML if no markers exist", async () => {
    const mockSupabase = {
      storage: {
        from: vi.fn(),
      },
    } as any;

    const html = "<p>No markers here</p>";
    const result = await signStorageMarkers(html, mockSupabase, "user-1", 3600);
    expect(result).toBe(html);
  });
});

describe("embedStorageImagesInHtml", () => {
  it("bundles both signed URLs and storage markers when owned by user", async () => {
    const download = vi.fn().mockImplementation((path: string) => {
      return Promise.resolve({
        data: {
          arrayBuffer: () => Promise.resolve(new TextEncoder().encode(`bytes for ${path}`).buffer),
        },
        error: null,
      });
    });

    const mockSupabase = {
      storage: {
        from: () => ({ download }),
      },
    } as any;

    const html = `<div>
      <img src="https://project.supabase.co/storage/v1/object/sign/uploads/user-1/signed.png?token=123">
      <img src="${STORAGE_MARKER_PREFIX}user-1/marker.jpg">
      <img src="${STORAGE_MARKER_PREFIX}other-user/marker.jpg">
    </div>`;

    const result = await embedStorageImagesInHtml(html, mockSupabase, "user-1");

    expect(result.html).toContain('src="images/signed.png"');
    expect(result.html).toContain('src="images/marker.jpg"');
    // Foreign marker skipped
    expect(result.html).toContain(`src="${STORAGE_MARKER_PREFIX}other-user/marker.jpg"`);
    expect(result.files["images/signed.png"]).toBeDefined();
    expect(result.files["images/marker.jpg"]).toBeDefined();
    expect(result.embeddedStoragePaths).toEqual(["user-1/signed.png", "user-1/marker.jpg"]);
  });
});
