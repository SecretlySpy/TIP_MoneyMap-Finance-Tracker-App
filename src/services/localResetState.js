import * as SecureStore from "expo-secure-store";

export const LOCAL_RESET_PENDING_KEY = "moneymap.local-reset.pending.v1";

export async function markLocalResetPending() {
  await SecureStore.setItemAsync(LOCAL_RESET_PENDING_KEY, "pending");
}

export async function isLocalResetPending() {
  return (await SecureStore.getItemAsync(LOCAL_RESET_PENDING_KEY)) !== null;
}

export async function clearLocalResetPending() {
  await SecureStore.deleteItemAsync(LOCAL_RESET_PENDING_KEY);
}
