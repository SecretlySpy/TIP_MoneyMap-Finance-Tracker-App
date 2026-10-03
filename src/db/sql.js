class OpSqliteExecutor {
    constructor(executeQuery) {
        this.executeQuery = executeQuery;
    }
    async execute(query, parameters = []) {
        const result = await this.executeQuery(query, [...parameters]);
        return {
            ...(result.insertId === undefined ? {} : { insertId: result.insertId }),
            rowsAffected: result.rowsAffected,
            rows: result.rows,
        };
    }
}
export class OpSqliteDatabase {
    constructor(database) {
        this.database = database;
        this.executor = new OpSqliteExecutor(database.execute.bind(database));
        this.queue = Promise.resolve();
        this.inTransaction = false;
    }
    enqueue(work) {
        const pending = this.queue.then(work, work);
        this.queue = pending.catch(() => {});
        return pending;
    }
    execute(query, parameters = []) {
        if (this.inTransaction) {
            return this.executor.execute(query, parameters);
        }
        return this.enqueue(() => this.executor.execute(query, parameters));
    }
    async transaction(work) {
        return this.enqueue(async () => {
            this.inTransaction = true;
            try {
                await this.database.transaction(async (transaction) => {
                    const executor = new OpSqliteExecutor(transaction.execute.bind(transaction));
                    await work(executor);
                });
            } finally {
                this.inTransaction = false;
            }
        });
    }
    close() {
        this.database.close();
    }
}
