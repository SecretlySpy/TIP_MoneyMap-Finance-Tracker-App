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
    }
    execute(query, parameters = []) {
        return this.executor.execute(query, parameters);
    }
    async transaction(work) {
        await this.database.transaction(async (transaction) => {
            const executor = new OpSqliteExecutor(transaction.execute.bind(transaction));
            await work(executor);
        });
    }
    close() {
        this.database.close();
    }
}
