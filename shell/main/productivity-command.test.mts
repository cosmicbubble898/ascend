import { describe, expect, it } from "vitest";
import { validProductivityCommand } from "./productivity-command.js";

describe("bounded productivity commands", () => {
  const period = { start: 1000, end: 86401000 };
  it("bounds timed pauses, focus, plans, and local AI commands", () => {
    for (const hours of [1, 4, 24, 48])
      expect(
        validProductivityCommand({ ...period, action: "pause", hours }),
      ).toBe(true);
    expect(
      validProductivityCommand({ ...period, action: "state", range: "week" }),
    ).toBe(true);
    expect(
      validProductivityCommand({
        ...period,
        action: "save_plan",
        planId: "",
        title: "Draft",
        project: "Ascend",
        minutes: 25,
        completed: false,
      }),
    ).toBe(true);
    for (const command of [
      { action: "pause" },
      { action: "pause", hours: 2 },
      { action: "pause", hours: "4" },
      { action: "focus_start", planId: "", minutes: 0 },
      { action: "delete_plan", planId: "foreign-id" },
      {
        action: "preferences",
        goalMinutes: 120,
        breakMinutes: 60,
        aiModel: "example-cloud",
      },
      {
        action: "ai_suggest",
        ids: ["seg_" + "a".repeat(32)],
        endpoint: "https://example.com",
      },
      {
        action: "context_rule",
        app: "chrome.exe",
        pattern: "",
        category: "Work",
        project: "",
        task: "",
        planning: "planned",
      },
      { action: "apply_ai", project: "", task: "", planning: "arbitrary" },
    ])
      expect(validProductivityCommand({ ...period, ...command })).toBe(false);
  });
  it("allows only the intended commands and periods", () => {
    expect(validProductivityCommand({ ...period, action: "start" })).toBe(true);
    for (const command of [
      { ...period, action: "shell" },
      { ...period, action: "state", path: "C:/secret" },
      { ...period, action: "state", end: Infinity },
      { ...period, action: "state", start: -1 },
      {
        ...period,
        action: "settings",
        settings: { details: true, excluded: ["C:/secret"] },
      },
      {
        ...period,
        action: "correct",
        ids: ["other"],
        category: "Work",
        project: "",
      },
    ])
      expect(validProductivityCommand(command)).toBe(false);
  });
  it("allows reversible corrections and explicit settings", () => {
    expect(
      validProductivityCommand({
        ...period,
        action: "profile",
        name: "Samarth",
        role: "Builder",
        notes: "Improve focus and reduce repeated work.",
      }),
    ).toBe(true);
    expect(
      validProductivityCommand({
        ...period,
        action: "profile",
        name: "x".repeat(81),
        role: "Builder",
        notes: "",
      }),
    ).toBe(false);
    expect(
      validProductivityCommand({
        ...period,
        action: "correct",
        ids: ["seg_" + "a".repeat(32)],
        category: null,
        project: "",
      }),
    ).toBe(true);
    expect(
      validProductivityCommand({
        ...period,
        action: "settings",
        settings: {
          details: false,
          excluded: ["chrome.exe"],
          visionEnabled: true,
          activityAnalysisEnabled: true,
        },
      }),
    ).toBe(true);
  });
});
