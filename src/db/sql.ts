import type { DB, Scalar, Transaction as OpSqliteTransaction } from "@op-engineering/op-sqlite";

export type SqlValue = Scalar;
export type SqlRow = Record<string, SqlValue>;

export interface SqlQueryResult {
  insertId?: number;
  rowsAffected: number;
  rows: SqlRow[];
}

export interface SqlExecutor {
  execute(query: string, parameters?: readonly SqlValue[]): Promise<SqlQueryResult>;
}

export interface SqlDatabase extends SqlExecutor {
  transaction(work: (transaction: SqlExecutor) => Promise<void>): Promise<void>;
  close(): void;
}

class OpSqliteExecutor implements SqlExecutor {
  public constructor(
    private readonly executeQuery: (
      query: string,
      parameters?: Scalar[],
    ) => Promise<{ insertId?: number; rowsAffected: number; rows: SqlRow[] }>,
  ) {}

  public async execute(
    query: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<SqlQueryResult> {
    const result = await this.executeQuery(query, [...parameters]);

    return {
      ...(result.insertId === undefined ? {} : { insertId: result.insertId }),
      rowsAffected: result.rowsAffected,
      rows: result.rows,
    };
  }
}

export class OpSqliteDatabase implements SqlDatabase {
  private readonly executor: OpSqliteExecutor;

  public constructor(private readonly database: DB) {
    this.executor = new OpSqliteExecutor(database.execute.bind(database));
  }

  public execute(
    query: string,
    parameters: readonly SqlValue[] = [],
  ): Promise<SqlQueryResult> {
    return this.executor.execute(query, parameters);
  }

  public async transaction(work: (transaction: SqlExecutor) => Promise<void>): Promise<void> {
    await this.database.transaction(async (transaction: OpSqliteTransaction) => {
      const executor = new OpSqliteExecutor(transaction.execute.bind(transaction));
      await work(executor);
    });
  }

  public close(): void {
    this.database.close();
  }
}
