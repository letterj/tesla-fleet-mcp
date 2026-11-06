/**
 * VehicleBackend is the production boundary.
 * This public repo ships only a mock adapter.
 * Live Fleet API and tesla-http-proxy wiring stay out of this tree.
 */

export type StatusSource = "cache" | "live" | "none";

export type StatusResult = {
  ok: boolean;
  state: string;
  source: StatusSource;
  climate?: Record<string, unknown>;
  vehicle_state?: Record<string, unknown>;
  charge?: Record<string, unknown>;
  reason?: string;
};

export type CommandResult = {
  result: boolean;
  reason: string;
  queued?: boolean;
};

export type PendingDoorResult = {
  result: boolean;
  pending: boolean;
  confirm_url?: string;
  reason: string;
};

export interface VehicleBackend {
  vehicleStatus(input: { live?: boolean }): Promise<StatusResult>;
  chargeStatus(input: { live?: boolean }): Promise<StatusResult>;
  sendNavigation(input: {
    address: string;
    locale?: string;
  }): Promise<CommandResult>;
  climateOn(): Promise<CommandResult>;
  climateOff(): Promise<CommandResult>;
  requestLock(): Promise<PendingDoorResult>;
  requestUnlock(): Promise<PendingDoorResult>;
}

export class MockVehicleBackend implements VehicleBackend {
  async vehicleStatus(input: { live?: boolean }): Promise<StatusResult> {
    return {
      ok: true,
      state: "online",
      source: input.live ? "live" : "cache",
      climate: { is_climate_on: false, inside_temp_c: 21 },
      vehicle_state: { locked: true, odometer_km: 12000 },
    };
  }

  async chargeStatus(input: { live?: boolean }): Promise<StatusResult> {
    return {
      ok: true,
      state: "online",
      source: input.live ? "live" : "cache",
      charge: { battery_level: 67, charging_state: "Disconnected" },
    };
  }

  async sendNavigation(input: {
    address: string;
    locale?: string;
  }): Promise<CommandResult> {
    if (!input.address.trim()) {
      return { result: false, reason: "address_required" };
    }
    return {
      result: true,
      reason: "mock_ok",
      queued: false,
    };
  }

  async climateOn(): Promise<CommandResult> {
    return { result: true, reason: "mock_ok" };
  }

  async climateOff(): Promise<CommandResult> {
    return { result: true, reason: "mock_ok" };
  }

  async requestLock(): Promise<PendingDoorResult> {
    return {
      result: false,
      pending: true,
      confirm_url: "https://<funnel-host>/confirm/mock-lock",
      reason: "awaiting_human_confirm",
    };
  }

  async requestUnlock(): Promise<PendingDoorResult> {
    return {
      result: false,
      pending: true,
      confirm_url: "https://<funnel-host>/confirm/mock-unlock",
      reason: "awaiting_human_confirm",
    };
  }
}
