import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { initializeDatabase } from "../db/client";
import { runRecurringCatchUp } from "../services/recurringCatchUp";

export const RECURRING_CATCH_UP_TASK = "moneymap-recurring-catch-up";

let taskDefined = false;

/**
 * Define the background executor once at module load (required by TaskManager).
 * Safe to import from App entry; native absence is swallowed so Jest stays green.
 */
export function defineRecurringCatchUpTask() {
  if (taskDefined) {
    return;
  }
  taskDefined = true;
  try {
    TaskManager.defineTask(RECURRING_CATCH_UP_TASK, async () => {
      try {
        const database = await initializeDatabase();
        await runRecurringCatchUp(database);
        return BackgroundTask.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    // Jest / environments without the native module.
    taskDefined = false;
  }
}

/**
 * Register the OS background worker when the API is available.
 * @returns {Promise<boolean>} true when registration succeeded
 */
export async function registerRecurringCatchUpTask() {
  defineRecurringCatchUpTask();
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) {
      return false;
    }
    const already = await TaskManager.isTaskRegisteredAsync(RECURRING_CATCH_UP_TASK);
    if (!already) {
      await BackgroundTask.registerTaskAsync(RECURRING_CATCH_UP_TASK, {
        minimumInterval: 60 * 12,
      });
    }
    return true;
  } catch {
    return false;
  }
}
