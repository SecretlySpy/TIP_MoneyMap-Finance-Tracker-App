/* Reproducible local QA only: synthetic rows, real SQLite/WAL, no remote traffic. */
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const assert = require("node:assert/strict");
const { performance, monitorEventLoopDelay } = require("node:perf_hooks");
const { Worker, isMainThread, parentPort, workerData } = require("node:worker_threads");
const BetterSqlite3 = require("better-sqlite3");
const root = path.resolve(__dirname, "..");

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function summarize(name, durations, errors, elapsedMs, extra = {}) {
  return { name, operations: durations.length + errors.length, successes: durations.length, errors: errors.length,
    errorRate: errors.length / Math.max(1, durations.length + errors.length), elapsedMs,
    successfulOpsPerSecond: durations.length * 1000 / elapsedMs,
    p50Ms: percentile(durations, 0.5), p95Ms: percentile(durations, 0.95), p99Ms: percentile(durations, 0.99),
    maxMs: Math.max(0, ...durations), errorSignatures: [...new Set(errors)], ...extra };
}

if (!isMainThread) {
  const db = new BetterSqlite3(workerData.filename);
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = FULL");
  const insert = db.prepare(`INSERT INTO transactions
    (amount_minor,type,category_id,account_id,date_epoch_millis,note,recurring_rule_id)
    VALUES (100,'EXPENSE',?,?,?,'QA worker',NULL)`);
  const batch = db.transaction(() => {
    for (let row = 0; row < 10; row++) insert.run(workerData.categoryId, workerData.accountId, workerData.date);
  });
  parentPort.postMessage({ ready: true });
  parentPort.once("message", () => {
    const durations = [];
    const errors = [];
    // BEGIN IMMEDIATE lets SQLite serialize writers rather than upgrade stale reads.
    for (let operation = 0; operation < 16; operation++) {
      const start = performance.now();
      try { batch.immediate(); durations.push(performance.now() - start); }
      catch (error) { errors.push(error.code ?? error.name); }
    }
    db.close();
    parentPort.postMessage({ durations, errors });
  });
} else {
  // Transform the project's existing ES modules in Node without changing app bundling.
  const originalLoader = require.extensions[".js"];
  require.extensions[".js"] = (module, filename) => {
    if (filename.startsWith(path.join(root, "src") + path.sep) || filename.endsWith(path.join("support", "testDatabase.js"))) {
      const code = require("@babel/core").transformFileSync(filename, {
        babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
      }).code;
      module._compile(code, filename);
    } else originalLoader(module, filename);
  };

  async function run() {
    const { TestSqliteDatabase } = require("../__tests__/support/testDatabase");
    const { OpSqliteDatabase } = require("../src/db/sql");
    const { migrateDatabase } = require("../src/db/schema");
    const { AccountRepository, CategoryRepository, GoalRepository, TransactionRepository, BudgetRepository, RecurringRepository } = require("../src/db/repositories");
    const { computeDashboardTotals, buildBudgetCards } = require("../src/domain/services/financeView");
    const { computeSafeToSpend } = require("../src/domain/services/safeToSpend");
    const { runRecurringCatchUp } = require("../src/services/recurringCatchUp");
    const output = path.resolve(root, process.argv[2] ?? ".expo/qa-stress.json");
    const filename = path.join(root, ".expo", `qa-synthetic-${Date.now()}.sqlite`);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const database = new OpSqliteDatabase(new TestSqliteDatabase({ filename }));
    const scenarios = [];
    const cpuStart = process.cpuUsage();
    const memoryStart = process.memoryUsage();
    const eventLoop = monitorEventLoopDelay({ resolution: 10 });
    eventLoop.enable();
    try {
      await migrateDatabase(database);
      const account = (await new AccountRepository(database).list())[0];
      const categories = [];
      const budgets = [];
      const recurringRules = [];
      const date = new Date(2026, 8, 28, 12).getTime();
      for (let index = 0; index < 100; index++) {
        const category = await new CategoryRepository(database).create({ name: `QA ${index}`, icon: "receipt", colorHex: "#64748B", type: "EXPENSE", isCustom: true });
        categories.push(category);
        budgets.push(await new BudgetRepository(database).create({ categoryId: category.id, monthYear: "2026-09", limitMinor: 100_000 }));
        recurringRules.push(await new RecurringRepository(database).create({ amountMinor: 100, type: "EXPENSE", categoryId: category.id, accountId: account.id,
          note: "QA bill", frequency: "MONTHLY", nextRunEpochMillis: date, isActive: true, reminderEnabled: false, reminderLeadDays: 14, icon: null, anchorDay: 28 }));
      }
      const insertStart = performance.now();
      await database.transaction(async (tx) => {
        for (let index = 0; index < 10_000; index++) {
          await new TransactionRepository(tx).create({ amountMinor: 100, type: "EXPENSE", categoryId: categories[index % 100].id, accountId: account.id,
            dateEpochMillis: date, note: "QA synthetic", recurringRuleId: null });
        }
      });
      scenarios.push(summarize("atomic-10000-row-import", [performance.now() - insertStart], [], performance.now() - insertStart, { rows: 10_000 }));
      const transactions = await new TransactionRepository(database).list();
      assert.equal(transactions.length, 10_000);
      const categoriesById = new Map(categories.map((row) => [row.id, row]));
      const input = { accounts: [account], transactions, budgets, recurringRules, goals: [], categoriesById, monthYear: "2026-09" };
      const dashboard = () => {
        assert.equal(computeDashboardTotals(input.accounts, transactions, input.monthYear).expenseMinor, 1_000_000);
        assert.equal(buildBudgetCards(budgets, transactions, categoriesById, input.monthYear).length, 100);
        assert.equal(computeSafeToSpend(input).safeMinor, 8_990_000);
      };
      // Warm caches/JIT before timing; yield between iterations to sample loop delay.
      for (let warmup = 0; warmup < 5; warmup++) dashboard();
      const durations = [];
      const start = performance.now();
      for (let index = 0; index < 100; index++) {
        const sampleStart = performance.now(); dashboard(); durations.push(performance.now() - sampleStart);
        await new Promise((resolve) => setImmediate(resolve));
      }
      scenarios.push(summarize("dashboard-10000-rows-100-budgets-100-rules", durations, [], performance.now() - start));
      const goal = await new GoalRepository(database).create({ name: "QA concurrent goal", targetMinor: 100_000 });
      const goals = new GoalRepository(database);
      for (const concurrency of [1, 4, 16, 32]) {
        const samples = [];
        const errors = [];
        const stageStart = performance.now();
        for (let burst = 0; burst < 16; burst++) {
          await Promise.all(Array.from({ length: concurrency }, async () => {
            const operationStart = performance.now();
            try { await goals.contribute(goal.id, 1); samples.push(performance.now() - operationStart); }
            catch (error) { errors.push(error.name); }
          }));
        }
        scenarios.push(summarize(`goal-contribution-concurrency-${concurrency}`, samples, errors, performance.now() - stageStart, { concurrency }));
      }
      assert.equal((await goals.getById(goal.id)).currentMinor, 16 * (1 + 4 + 16 + 32));
      const catchStart = performance.now();
      const catchDurations = [];
      const catchResults = await Promise.all(Array.from({ length: 32 }, async () => {
        const operationStart = performance.now();
        const result = await runRecurringCatchUp(database, { nowEpochMillis: date });
        catchDurations.push(performance.now() - operationStart);
        return result;
      }));
      assert.equal(catchResults.reduce((sum, result) => sum + result.transactionsCreated, 0), 100);
      scenarios.push(summarize("recurring-catch-up-concurrency-32", catchDurations, [], performance.now() - catchStart, { concurrency: 32, postedRuns: 100 }));
      for (const concurrency of [1, 4, 16, 32]) {
        const workers = Array.from({ length: concurrency }, () => new Worker(__filename, { workerData: { filename, accountId: account.id, categoryId: categories[0].id, date } }));
        try {
          await Promise.all(workers.map((worker) => new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); })));
          const results = workers.map((worker) => new Promise((resolve, reject) => { worker.once("message", resolve); worker.once("error", reject); }));
          const stageStart = performance.now();
          workers.forEach((worker) => worker.postMessage({ start: true }));
          const completed = await Promise.all(results);
          scenarios.push(summarize(`wal-writer-concurrency-${concurrency}`, completed.flatMap((row) => row.durations), completed.flatMap((row) => row.errors), performance.now() - stageStart, { concurrency, rowsPerOperation: 10, includesWorkerStartup: false }));
        } finally { await Promise.all(workers.map((worker) => worker.terminate())); }
      }
      const expectedRows = 10_000 + 100 + 16 * (1 + 4 + 16 + 32) * 10;
      assert.equal((await database.execute("SELECT count(*) AS count FROM transactions")).rows[0].count, expectedRows);
      assert.equal((await database.execute("PRAGMA integrity_check")).rows[0].integrity_check, "ok");
      assert.deepEqual((await database.execute("PRAGMA foreign_key_check")).rows, []);
      const queryPlans = {};
      queryPlans.monthRange = (await database.execute("EXPLAIN QUERY PLAN SELECT * FROM transactions WHERE date_epoch_millis >= ? AND date_epoch_millis < ? ORDER BY date_epoch_millis DESC LIMIT 50", [date - 86_400_000, date + 86_400_000])).rows;
      queryPlans.recurringDuplicateCheck = (await database.execute("EXPLAIN QUERY PLAN SELECT id FROM transactions WHERE recurring_rule_id = ? AND date_epoch_millis = ? LIMIT 1", [recurringRules[0].id, date])).rows;
      const memoryEnd = process.memoryUsage();
      const result = { recordedAt: new Date().toISOString(), environment: { node: process.version, platform: process.platform, architecture: process.arch,
        cpuModel: os.cpus()[0].model, logicalCpus: os.cpus().length, driver: "better-sqlite3", driverVersion: require("better-sqlite3/package.json").version, sqlcipher: false, journalMode: "WAL", synchronous: "FULL" },
        workload: { initialRows: 10_000, budgets: 100, rules: 100, maxConcurrency: 32, finalRows: expectedRows, synthetic: true, remoteRequests: 0 },
        scenarios, integrity: "ok", foreignKeyViolations: 0, queryPlans, cpuTimeMicros: process.cpuUsage(cpuStart),
        memory: { startRssBytes: memoryStart.rss, endRssBytes: memoryEnd.rss, startHeapBytes: memoryStart.heapUsed, endHeapBytes: memoryEnd.heapUsed },
        eventLoop: { p95Ms: eventLoop.percentile(95) / 1e6, p99Ms: eventLoop.percentile(99) / 1e6, maxMs: eventLoop.max / 1e6 },
        acceptance: { zeroOperationErrors: scenarios.every((scenario) => scenario.errors === 0),
          desktopDashboardP95Under50Ms: scenarios.find((scenario) => scenario.name.startsWith("dashboard")).p95Ms < 50,
          writerP99UnderBusyTimeout5000Ms: scenarios.filter((scenario) => scenario.name.startsWith("wal-writer")).every((scenario) => scenario.p99Ms < 5000) },
        limits: ["Desktop SQLite driver; not native SQLCipher or device UI performance.", "RSS delta includes module loading and warmup; not proof of leak freedom.", "Concurrency is local operations/connections, not remote users or HTTP RPS."] };
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
      console.log(JSON.stringify({ output: path.relative(root, output), integrity: result.integrity, scenarios: scenarios.map(({ name, operations, errors, p95Ms, p99Ms }) => ({ name, operations, errors, p95Ms, p99Ms })) }, null, 2));
      if (scenarios.some((scenario) => scenario.errors > 0)) process.exitCode = 1;
    } finally { eventLoop.disable(); database.close(); }
  }
  run().catch((error) => { console.error(error.stack); process.exitCode = 1; });
}
