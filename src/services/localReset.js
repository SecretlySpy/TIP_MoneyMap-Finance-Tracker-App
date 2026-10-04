import { beginDatabaseReset, completeDatabaseReset, deleteFinanceDatabase } from "../db/client";
import { clearDatabaseKey } from "../db/databaseKey";
import { clearPin } from "./appLock";
import { clearMoneyMapNotifications } from "./notificationScheduler";
import { clearOnboardingDraft } from "./onboarding";
import { clearPreferences, clearSplashSeen } from "./preferences";
import {
  clearLocalResetPending,
  isLocalResetPending,
  LOCAL_RESET_PENDING_KEY,
  markLocalResetPending,
} from "./localResetState";

export { LOCAL_RESET_PENDING_KEY };
let localResetPromise = null;

async function completePersistentReset() {
  await deleteFinanceDatabase({ keepResetGuard: true });
  await clearDatabaseKey();
  await clearPin();
  await clearPreferences();
  await clearSplashSeen();
  await clearOnboardingDraft();
  await clearMoneyMapNotifications();
  await clearLocalResetPending();
  completeDatabaseReset();
}

function runPersistentReset() {
  if (localResetPromise !== null) {
    return localResetPromise;
  }
  localResetPromise = completePersistentReset().finally(() => {
    localResetPromise = null;
  });
  return localResetPromise;
}

export async function performLocalReset() {
  const acquiredDatabaseGuard = beginDatabaseReset();
  try {
    await markLocalResetPending();
  } catch (error) {
    if (acquiredDatabaseGuard) {
      completeDatabaseReset();
    }
    throw error;
  }
  await runPersistentReset();
}

export async function resumePendingLocalReset() {
  if (!(await isLocalResetPending())) {
    return false;
  }
  beginDatabaseReset();
  await runPersistentReset();
  return true;
}
