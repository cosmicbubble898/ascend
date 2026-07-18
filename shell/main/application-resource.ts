import path from "node:path";

const APPLICATION_RESOURCES = new Map<string, string>([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/styles.css", "styles.css"],
]);

export function resolveApplicationResource(
  requestUrl: string,
  rendererRoot: string,
): string | undefined {
  let url: URL;
  try {
    url = new URL(requestUrl);
  } catch {
    return undefined;
  }

  if (
    url.protocol !== "ascend:" ||
    url.hostname !== "app" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    return undefined;
  }

  const resourceName = APPLICATION_RESOURCES.get(url.pathname);
  return resourceName === undefined
    ? undefined
    : path.join(rendererRoot, resourceName);
}
