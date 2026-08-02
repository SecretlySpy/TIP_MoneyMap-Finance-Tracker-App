import type { Budget, BudgetUpdate, NewBudget } from "../../domain/types";
import type { SqlDatabase, SqlRow } from "../sql";
import {
  assertMonthYear,
  assertPositiveInteger,
  readInteger,
  readString,
} from "../validation";
import {
  deleteRow,
  findRowById,
  insertRow,
  listRows,
  requireCreatedEntity,
  updateRow,
  type UpdateAssignment,
} from "./shared";

function mapBudget(row: SqlRow): Budget {
  return {
    id: readInteger(row, "id"),
    categoryId: readInteger(row, "category_id"),
    monthYear: readString(row, "month_year"),
    limitMinor: readInteger(row, "limit_minor"),
  };
}

async function assertExpenseCategory(database: SqlDatabase, categoryId: number): Promise<void> {
  const result = await database.execute("SELECT type FROM categories WHERE id = ?", [categoryId]);

  if (result.rows[0]?.type !== "EXPENSE") {
    throw new TypeError("Budgets require an existing expense category.");
  }
}

export class BudgetRepository {
  public constructor(private readonly database: SqlDatabase) {}

  public async create(budget: NewBudget): Promise<Budget> {
    assertPositiveInteger(budget.categoryId, "categoryId");
    assertMonthYear(budget.monthYear);
    assertPositiveInteger(budget.limitMinor, "limitMinor");
    await assertExpenseCategory(this.database, budget.categoryId);

    const id = await insertRow(
      this.database,
      `INSERT INTO budgets (category_id, month_year, limit_minor)
       VALUES (?, ?, ?)`,
      [budget.categoryId, budget.monthYear, budget.limitMinor],
    );

    return requireCreatedEntity(await this.getById(id), "Budget");
  }

  public async getById(id: number): Promise<Budget | null> {
    const row = await findRowById(this.database, "budgets", id);
    return row === null ? null : mapBudget(row);
  }

  public async list(): Promise<Budget[]> {
    return (await listRows(this.database, "budgets")).map(mapBudget);
  }

  public async update(id: number, patch: BudgetUpdate): Promise<Budget | null> {
    const assignments: UpdateAssignment[] = [];

    if (patch.categoryId !== undefined) {
      assertPositiveInteger(patch.categoryId, "categoryId");
      await assertExpenseCategory(this.database, patch.categoryId);
      assignments.push({ column: "category_id", value: patch.categoryId });
    }
    if (patch.monthYear !== undefined) {
      assertMonthYear(patch.monthYear);
      assignments.push({ column: "month_year", value: patch.monthYear });
    }
    if (patch.limitMinor !== undefined) {
      assertPositiveInteger(patch.limitMinor, "limitMinor");
      assignments.push({ column: "limit_minor", value: patch.limitMinor });
    }

    const didUpdate = await updateRow(this.database, "budgets", id, assignments);
    return didUpdate ? this.getById(id) : null;
  }

  public delete(id: number): Promise<boolean> {
    return deleteRow(this.database, "budgets", id);
  }
}
