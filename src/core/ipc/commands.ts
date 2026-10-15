import type {
  LiveSlide,
  MonitorInfo,
  OutputTarget,
} from "../types";
import { invokeCommand } from "./tauri";

export async function listMonitors(): Promise<MonitorInfo[]> {
  return (await invokeCommand<MonitorInfo[]>("list_monitors")) ?? [];
}

export async function openOutputWindow(
  target: OutputTarget,
  monitorId: string | null,
): Promise<void> {
  await invokeCommand("open_output_window", { target, monitor_id: monitorId });
}

export async function closeOutputWindow(
  target: OutputTarget,
): Promise<void> {
  await invokeCommand("close_output_window", { target });
}

export async function publishSlide(slide: LiveSlide): Promise<void> {
  await invokeCommand("go_live", { slide });
}

export async function setBlackout(blackout: boolean): Promise<void> {
  await invokeCommand("set_blackout", { blackout });
}

export async function fetchLiveSlide(): Promise<LiveSlide | null> {
  return invokeCommand<LiveSlide>("get_live_slide");
}

export async function fetchServerHost(): Promise<string> {
  return (await invokeCommand<string>("get_server_host")) ?? "localhost";
}
