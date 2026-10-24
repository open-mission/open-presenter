import { create } from "zustand";
import { getSetting, setSetting } from "@/core/ipc/commands";

interface AudioSettingsState {
  selectedDeviceId: string;
  masterVolume: number;
  devices: MediaDeviceInfo[];
  loaded: boolean;
  load(): Promise<void>;
  refreshDevices(): Promise<void>;
  setSelectedDevice(deviceId: string): Promise<void>;
  setMasterVolume(volume: number): Promise<void>;
}

const SETTING_AUDIO_DEVICE = "audio_output_device_id";
const SETTING_AUDIO_VOLUME = "audio_master_volume";

export const useAudioSettingsStore = create<AudioSettingsState>((set, get) => ({
  selectedDeviceId: "",
  masterVolume: 1.0,
  devices: [],
  loaded: false,

  load: async () => {
    let savedDevice = "";
    let savedVol = 1.0;

    try {
      const dev = await getSetting(SETTING_AUDIO_DEVICE);
      if (dev) savedDevice = dev;
      else savedDevice = localStorage.getItem(SETTING_AUDIO_DEVICE) || "";
    } catch {
      savedDevice = localStorage.getItem(SETTING_AUDIO_DEVICE) || "";
    }

    try {
      const vol = await getSetting(SETTING_AUDIO_VOLUME);
      if (vol) savedVol = parseFloat(vol);
      else {
        const raw = localStorage.getItem(SETTING_AUDIO_VOLUME);
        if (raw) savedVol = parseFloat(raw);
      }
    } catch {
      // fallback
    }

    set({
      selectedDeviceId: savedDevice,
      masterVolume: isNaN(savedVol) ? 1.0 : savedVol,
      loaded: true,
    });

    await get().refreshDevices();
  },

  refreshDevices: async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = all.filter((d) => d.kind === "audiooutput");
      set({ devices: audioOutputs });
    } catch {
      // ignore
    }
  },

  setSelectedDevice: async (deviceId: string) => {
    set({ selectedDeviceId: deviceId });
    try {
      await setSetting(SETTING_AUDIO_DEVICE, deviceId);
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(SETTING_AUDIO_DEVICE, deviceId);
    } catch {
      // ignore
    }
  },

  setMasterVolume: async (volume: number) => {
    const clamped = Math.max(0, Math.min(1, volume));
    set({ masterVolume: clamped });
    try {
      await setSetting(SETTING_AUDIO_VOLUME, clamped.toString());
    } catch {
      // ignore
    }
    try {
      localStorage.setItem(SETTING_AUDIO_VOLUME, clamped.toString());
    } catch {
      // ignore
    }
  },
}));

void useAudioSettingsStore.getState().load();
