import { productivityCategories } from "../productivity-contract";

export function extraFields(
  data: Record<string, unknown>,
): string[] | undefined {
  const text = (key: string, max = 100): boolean =>
    typeof data[key] === "string" && data[key].length <= max;
  const number = (key: string, min: number, max: number): boolean =>
    typeof data[key] === "number" &&
    Number.isSafeInteger(data[key]) &&
    data[key] >= min &&
    data[key] <= max;
  const id = (key: string, prefix = "", empty = false): boolean =>
    typeof data[key] === "string" &&
    ((empty && data[key] === "") ||
      new RegExp("^" + prefix + "[0-9a-f]{32}$").test(data[key]));
  const context = (): boolean =>
    text("project") &&
    text("task") &&
    ["planned", "unplanned", "unspecified"].includes(String(data.planning));
  switch (data.action) {
    case "pause":
      return [1, 4, 24, 48].includes(Number(data.hours)) &&
        number("hours", 1, 48)
        ? ["hours"]
        : undefined;
    case "preferences":
      return number("goalMinutes", 10, 480) &&
        number("breakMinutes", 0, 90) &&
        [0, 30, 60, 90].includes(Number(data.breakMinutes)) &&
        text("aiModel") &&
        (data.aiModel === "" ||
          /^[A-Za-z0-9_.:/-]{1,100}$/.test(String(data.aiModel))) &&
        !String(data.aiModel).toLowerCase().includes("cloud")
        ? ["goalMinutes", "breakMinutes", "aiModel"]
        : undefined;
    case "profile":
      return text("name", 80) && text("role", 120) && text("notes", 500)
        ? ["name", "role", "notes"]
        : undefined;
    case "context_rule":
      return text("app", 120) &&
        /^[\w .()\-]{1,116}\.exe$/i.test(String(data.app)) &&
        text("pattern", 160) &&
        String(data.pattern).trim().length >= 3 &&
        productivityCategories.some((value) => value === data.category) &&
        context()
        ? ["app", "pattern", "category", "project", "task", "planning"]
        : undefined;
    case "remove_context_rule":
      return id("ruleId") ? ["ruleId"] : undefined;
    case "save_plan":
      return id("planId", "plan_", true) &&
        text("title") &&
        String(data.title).trim().length > 0 &&
        text("project") &&
        number("minutes", 1, 480) &&
        typeof data.completed === "boolean"
        ? ["planId", "title", "project", "minutes", "completed"]
        : undefined;
    case "delete_plan":
      return id("planId", "plan_") ? ["planId"] : undefined;
    case "focus_start":
      return id("planId", "plan_", true) && number("minutes", 1, 120)
        ? ["planId", "minutes"]
        : undefined;
    case "break_start":
    case "focus_cancel":
      return [];
    case "notice_seen":
      return id("noticeId") ? ["noticeId"] : undefined;
    case "ai_suggest":
      return Array.isArray(data.ids) &&
        data.ids.length > 0 &&
        data.ids.length <= 3000 &&
        data.ids.every(
          (item) => typeof item === "string" && /^seg_[0-9a-f]{32}$/.test(item),
        )
        ? ["ids"]
        : undefined;
    case "apply_ai":
      return context() ? ["project", "task", "planning"] : undefined;
    default:
      return undefined;
  }
}
