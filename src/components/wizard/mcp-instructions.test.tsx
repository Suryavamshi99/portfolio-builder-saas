import { describe, expect, it, vi, beforeEach } from "vitest";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { McpWaitingPanel } from "./McpWaitingPanel";
import { ConnectContent } from "@/routes/connect";
import { apiClient } from "@/lib/api-client";

// Mock tanstack react-router
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  createFileRoute: () => () => ({ component: () => null }),
}));

describe("MCP Connection and Next Steps Instructions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("McpWaitingPanel", () => {
    it("renders non-connected state with CTA link to /connect", () => {
      vi.spyOn(apiClient, "getMcpStatus").mockResolvedValue({
        connected: false,
        connections: [],
        latestJob: null,
      });

      const html = renderToString(<McpWaitingPanel />);
      expect(html).toContain("Use Your Claude or ChatGPT");
      expect(html).toContain("Connect Claude or ChatGPT");
      expect(html).toContain('href="/connect"');
      // Should NOT show the post-connection next steps when not connected
      expect(html).not.toContain("Next Steps in Claude");
      expect(html).not.toContain("Start a new chat");
    });

    it("renders next steps instructions once connected in McpWaitingPanel", () => {
      const html = renderToString(
        <McpWaitingPanel
          initialStatus={{
            connected: true,
            connections: [],
            latestJob: null,
          }}
        />
      );
      expect(html).toContain("Connected");
      expect(html).toContain("Next Steps in Claude");
      expect(html).toContain("Start a new chat");
      expect(html).toContain("Shipfolio tool");
      expect(html).toContain("Build my Shipfolio portfolio");
      expect(html).toContain("Copy");
    });
  });

  describe("ConnectContent Route Screen", () => {
    it("renders setup instructions when not connected", () => {
      const html = renderToString(
        <ConnectContent
          initialStatus={{
            connected: false,
            connections: [],
            latestJob: null,
          }}
        />
      );

      expect(html).toContain("Connect Claude or ChatGPT");
      expect(html).toContain("Setup Instructions");
      expect(html).toContain("Steps for Claude.ai");
      // Should NOT show the post-connection next steps instructions
      expect(html).not.toContain("What to do next");
      expect(html).not.toContain("MCP Connection Active");
      expect(html).not.toContain("Start a new chat session");
    });

    it("renders step-by-step instructions screen ONLY once connected", () => {
      const html = renderToString(
        <ConnectContent
          initialStatus={{
            connected: true,
            connections: [],
            latestJob: null,
          }}
        />
      );

      // Successfully connected header
      expect(html).toContain("Connected to Claude");
      expect(html).toContain("MCP Connection Active");

      // What to do next instructions
      expect(html).toContain("What to do next");
      expect(html).toContain("Start a new chat session");
      expect(html).toContain("Verify the Shipfolio connector is active");
      expect(html).toContain("Paste and send this prompt");
      expect(html).toContain("Build my Shipfolio portfolio");
      expect(html).toContain("Copy Prompt");
      expect(html).toContain("Watch your live portfolio build");
      expect(html).toContain("Return to Wizard &amp; Watch Live");
      expect(html).toContain("Go to Studio");

      // Initial setup instructions should be hidden by default
      expect(html).not.toContain("Steps for Claude.ai:");
      expect(html).toContain("connector technical details &amp; URL");
    });
  });
});
