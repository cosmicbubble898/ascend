import { contextBridge } from "electron";

const shellMetadata = Object.freeze({
  version: "0.0.0",
});

contextBridge.exposeInMainWorld("ascend", shellMetadata);
