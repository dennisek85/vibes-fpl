export const AUTH_STORAGE_KEY = "fpl_hub_auth_active_pin";

export function getActivePin(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_STORAGE_KEY);
}

export function isPinVerified(): boolean {
  return !!getActivePin();
}

export function saveActivePin(pin: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(AUTH_STORAGE_KEY, pin.trim());
  }
}

export function logoutPin(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
