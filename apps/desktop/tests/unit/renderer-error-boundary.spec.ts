import { expect, test } from "@playwright/test";
import {
  RendererErrorBoundary,
  rendererBoundaryCopy,
  startupSurfaceCopy,
} from "../../src/app/desktop-recovery";

const SENTINEL = "secret-token=/private/path";

test("startup copy switches on failure codes and never interpolates error text", () => {
  expect(startupSurfaceCopy({ kind: "loading" })).toEqual({
    titleKey: "recovery.loadingTitle",
    bodyKey: "recovery.loadingBody",
    status: "loading",
  });
  expect(
    startupSurfaceCopy({
      kind: "failed",
      failure: { code: "state-request-failed" },
      retrying: false,
    }),
  ).toEqual({
    titleKey: "recovery.failedTitle",
    bodyKey: "recovery.failedBody",
    status: "failed",
  });
  expect(
    startupSurfaceCopy({
      kind: "failed",
      failure: { code: "bridge-unavailable" },
      retrying: true,
    }).bodyKey,
  ).toBe("recovery.bridgeBody");
  expect(JSON.stringify(startupSurfaceCopy({ kind: "crashed" }))).not.toContain(SENTINEL);
});

test("error boundary derived state stores no thrown details", () => {
  const next = RendererErrorBoundary.getDerivedStateFromError(new Error(SENTINEL));
  expect(next).toEqual({ hasError: true });
  expect(JSON.stringify(next)).not.toContain("secret");
  expect(JSON.stringify(next)).not.toContain("/private/path");
});

test("crash fallback copy stays generic", () => {
  const copy = rendererBoundaryCopy();
  expect(copy.titleKey).toBe("recovery.crashedTitle");
  expect(copy.status).toBe("crashed");
  expect(JSON.stringify(copy)).not.toContain(SENTINEL);
});
