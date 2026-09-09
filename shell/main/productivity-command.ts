import {
  productivityCategories,
  type ProductivityCommand,
} from "../productivity-contract";
import { extraFields } from "./productivity-extra-command";

export function validProductivityCommand(
  value: unknown,
): value is ProductivityCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  if (
    typeof data.start !== "number" ||
    typeof data.end !== "number" ||
    !Number.isSafeInteger(data.start) ||
    !Number.isSafeInteger(data.end) ||
    data.start < 0 ||
    data.end <= data.start ||
    data.end - data.start > 90000000 ||
    data.end > 4102444800000
  )
    return false;
  const keys = ["action", "start", "end"];
  if ("range" in data) {
    if (data.range !== "day" && data.range !== "week") return false;
    keys.push("range");
  }
  const category = (item: unknown): boolean =>
    typeof item === "string" &&
    (productivityCategories as readonly string[]).includes(item);
  switch (data.action) {
    case "state":
    case "start":
    case "delete_day":
      break;
    case "correct":
      keys.push("ids", "category", "project");
      if (
        !Array.isArray(data.ids) ||
        data.ids.length < 1 ||
        data.ids.length > 3000 ||
        !data.ids.every(
          (item: unknown) =>
            typeof item === "string" && /^seg_[0-9a-f]{32}$/.test(item),
        ) ||
        (data.category !== null && !category(data.category)) ||
        typeof data.project !== "string" ||
        data.project.length > 100
      )
        return false;
      if ("task" in data || "planning" in data) {
        if (
          typeof data.task !== "string" ||
          data.task.length > 100 ||
          !["planned", "unplanned", "unspecified"].includes(
            String(data.planning),
          )
        )
          return false;
        keys.push("task", "planning");
      }
      break;
    case "rule":
      keys.push("app", "category");
      if (
        typeof data.app !== "string" ||
        !/^[\w .()\-]{1,116}\.exe$/i.test(data.app) ||
        !category(data.category)
      )
        return false;
      break;
    case "settings": {
      keys.push("settings");
      if (!data.settings || typeof data.settings !== "object") return false;
      const settings = data.settings as Record<string, unknown>;
      if (
        Object.keys(settings).sort().join() !==
          "activityAnalysisEnabled,details,excluded,visionEnabled" ||
        typeof settings.details !== "boolean" ||
        typeof settings.visionEnabled !== "boolean" ||
        typeof settings.activityAnalysisEnabled !== "boolean" ||
        !Array.isArray(settings.excluded) ||
        settings.excluded.length > 100 ||
        !settings.excluded.every(
          (item: unknown) =>
            typeof item === "string" && /^[\w .()\-]{1,116}\.exe$/i.test(item),
        )
      )
        return false;
      break;
    }
    default: {
      const extra = extraFields(data);
      if (!extra) return false;
      keys.push(...extra);
    }
  }
  return Object.keys(data).sort().join() === keys.sort().join();
}
