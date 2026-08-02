import { assertMonthYear, assertPositiveInteger, readInteger, readString, } from "../validation";
import { deleteRow, findRowById, insertRow, listRows, requireCreatedEntity, updateRow, } from "./shared";
function mapBudget(row) {
    return {
        id: readInteger(row, "id"),
        categoryId: readInteger(row, "category_id"),
        monthYear: readString(row, "month_year"),
        limitMinor: readInteger(row, "limit_minor"),
    };
}
async function assertExpenseCategory(database, categoryId) {
    const result = await database.execute("SELECT type FROM categories WHERE id = ?", [categoryId]);
    if (result.rows[0]?.type !== "EXPENSE") {
        throw new TypeError("Budgets require an existing expense category.");
    }
}
export class BudgetRepository {
    constructor(database) {
        this.database = database;
    }
    async create(budget) {
        assertPositiveInteger(budget.categoryId, "categoryId");
        assertMonthYear(budget.monthYear);
        assertPositiveInteger(budget.limitMinor, "limitMinor");
        await assertExpenseCategory(this.database, budget.categoryId);
        const id = await insertRow(this.database, `INSERT INTO budgets (category_id, month_year, limit_minor)
       VALUES (?, ?, ?)`, [budget.categoryId, budget.monthYear, budget.limitMinor]);
        return requireCreatedEntity(await this.getById(id), "Budget");
    }
    async getById(id) {
        const row = await findRowById(this.database, "budgets", id);
        return row === null ? null : mapBudget(row);
    }
    async list() {
        return (await listRows(this.database, "budgets")).map(mapBudget);
    }
    async update(id, patch) {
        const assignments = [];
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
    delete(id) {
        return deleteRow(this.database, "budgets", id);
    }
}
