import { describe, expect, it, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { SignIn } from "./SignIn";
import { StepUpDialog } from "./StepUpDialog";
import { SecurityPanel } from "./SecurityPanel";
import { registerStepUpHandler, requestStepUp } from "@/lib/admin-stepup";
import { generateQrMatrix } from "./qr-matrix";
import { QrCode } from "./qr";

describe("Admin UI Components (SSR / React output)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("SignIn Component", () => {
    it("renders admin sign-in form with username and password fields", () => {
      const html = renderToString(<SignIn onDone={() => {}} />);
      expect(html).toContain("Admin sign-in");
      expect(html).toContain("Username");
      expect(html).toContain("Password");
      expect(html).toContain("admin-username");
      expect(html).toContain("admin-password");
      expect(html).toContain("Continue");
    });
  });

  describe("QrCode and QR Matrix generator", () => {
    it("generates QR matrix for standard otpauth URI", () => {
      const uri = "otpauth://totp/Shipfolio%20Admin:owner?secret=JBSWY3DPEHPK3PXP&issuer=Shipfolio%20Admin";
      const matrix = generateQrMatrix(uri);
      expect(matrix.length).toBeGreaterThan(0);
      expect(matrix[0]?.length).toBe(matrix.length);

      const html = renderToString(<QrCode value={uri} size={200} />);
      expect(html).toContain("<svg");
      expect(html).toContain('aria-label="QR Code"');
      expect(html).toContain('width="200"');
      expect(html).toContain('height="200"');
    });
  });

  describe("StepUpDialog & requestStepUp hook", () => {
    it("StepUpDialog renders without crashing", () => {
      const html = renderToString(<StepUpDialog />);
      // Dialog Content is hidden when open=false in SSR, but component renders
      expect(typeof html).toBe("string");
    });

    it("requestStepUp hook triggers registered handler and returns result", async () => {
      const mockHandler = vi.fn().mockResolvedValue(true);
      const unregister = registerStepUpHandler(mockHandler);

      const result = await requestStepUp();
      expect(result).toBe(true);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      unregister();
    });

    it("requestStepUp returns false when no handler registered", async () => {
      registerStepUpHandler(null);
      const result = await requestStepUp();
      expect(result).toBe(false);
    });
  });

  describe("SecurityPanel Component", () => {
    it("renders security panel container cleanly", () => {
      const html = renderToString(<SecurityPanel />);
      expect(typeof html).toBe("string");
    });
  });
});
