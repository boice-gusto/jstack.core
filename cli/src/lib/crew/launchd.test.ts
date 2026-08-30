import { describe, expect, test } from "bun:test";
import { renderPlist, type InstallPaths } from "./launchd.js";

const P: InstallPaths = {
  plist: "/x/plist",
  binary: "/x/crewd",
  stdout: "/x/out.log",
  stderr: "/x/err.log",
};

describe("renderPlist default (interval) mode", () => {
  test("uses StartInterval, no KeepAlive, no resident env vars", () => {
    const xml = renderPlist(P, "/proj", 60);
    expect(xml).toContain("<key>StartInterval</key><integer>60</integer>");
    expect(xml).not.toContain("KeepAlive");
    expect(xml).not.toContain("JSTACK_CREW_RESIDENT");
    expect(xml).not.toContain("JSTACK_CREW_TICK_INTERVAL_MS");
  });

  test("{ resident: false } renders identically to omitting the option", () => {
    expect(renderPlist(P, "/proj", 60, { resident: false })).toBe(
      renderPlist(P, "/proj", 60),
    );
  });
});

describe("renderPlist resident mode", () => {
  test("uses KeepAlive, no StartInterval, and sets the resident env vars", () => {
    const xml = renderPlist(P, "/proj", 60, { resident: true });
    expect(xml).toContain("<key>KeepAlive</key><true/>");
    expect(xml).not.toContain("StartInterval");
    expect(xml).toContain("<key>JSTACK_CREW_RESIDENT</key><string>1</string>");
    expect(xml).toContain(
      "<key>JSTACK_CREW_TICK_INTERVAL_MS</key><string>60000</string>",
    );
  });

  test("converts intervalSeconds to milliseconds for the tick-interval env var", () => {
    const xml = renderPlist(P, "/proj", 5, { resident: true });
    expect(xml).toContain(
      "<key>JSTACK_CREW_TICK_INTERVAL_MS</key><string>5000</string>",
    );
  });

  test("still sets RunAtLoad, matching the interval mode's initial-start behavior", () => {
    const xml = renderPlist(P, "/proj", 60, { resident: true });
    expect(xml).toContain("<key>RunAtLoad</key><true/>");
  });
});

test("both modes produce well-formed plist XML (balanced dict/array tags)", () => {
  for (const resident of [false, true]) {
    const xml = renderPlist(P, "/proj", 60, { resident });
    const opens = (xml.match(/<dict>/g) ?? []).length;
    const closes = (xml.match(/<\/dict>/g) ?? []).length;
    expect(opens).toBe(closes);
    expect(xml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(xml.trim().endsWith("</plist>")).toBe(true);
  }
});
