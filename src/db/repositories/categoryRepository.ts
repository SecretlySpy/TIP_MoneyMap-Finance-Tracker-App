import {
  TRANSACTION_TYPES,
  type Category,
  type CategoryUpdate,
  type NewCategory,
} from "../../domain/types";
import type { SqlDatabase, SqlRow } from "../sql";
import {
  assertColorHex,
  assertNonBlank,
  assertOneOf,
  readBoolean,
  readEnum,
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

function mapCategory(row: SqlRow): Category {
  return {
    id: readInteger(row, "id"),
    name: readString(row, "name"),
    icon: readString(row, "icon"),
    colorHex: readString(row, "color_hex"),
    type: readEnum(row, "type", TRANSACTION_TYPES),
    isCustom: readBoolean(row, "is_custom"),
  };
}

function validateCategory(category: NewCategory): void {
  assertNonBlank(category.name, "name");
  assertNonBlank(category.icon, "icon");
  assertColorHex(category.colorHex);
  assertOneOf(category.type, TRANSACTION_TYPES, "type");
}

export class CategoryRepository {
  public constructor(private readonly database: SqlDatabase) {}

  public async create(category: NewCategory): Promise<Category> {
    validateCategory(category);
    const id = await insertRow(
      this.database,
      `INSERT INTO categories (name, icon, color_hex, type, is_custom)
       VALUES (?, ?, ?, ?, ?)`,
      [category.name, category.icon, category.colorHex, category.type, category.isCustom ? 1 : 0],
    );

    return requireCreatedEntity(await this.getById(id), "Category");
  }

  public async getById(id: number): Promise<Category | null> {
    const row = await findRowById(this.database, "categories", id);
    return row === null ? null : mapCategory(row);
  }

  public async list(): Promise<Category[]> {
    return (await listRows(this.database, "categories")).map(mapCategory);
  }

  public async update(id: number, patch: CategoryUpdate): Promise<Category | null> {
    const assignments: UpdateAssignment[] = [];

    if (patch.name !== undefined) {
      assertNonBlank(patch.name, "name");
      assignments.push({ column: "name", value: patch.name });
    }
    if (patch.icon !== undefined) {
      assertNonBlank(patch.icon, "icon");
      assignments.push({ column: "icon", value: patch.icon });
    }
    if (patch.colorHex !== undefined) {
      assertColorHex(patch.colorHex);
      assignments.push({ column: "color_hex", value: patch.colorHex });
    }
    if (patch.type !== undefined) {
      assertOneOf(patch.type, TRANSACTION_TYPES, "type");
      assignments.push({ column: "type", value: patch.type });
    }
    if (patch.isCustom !== undefined) {
      assignments.push({ column: "is_custom", value: patch.isCustom ? 1 : 0 });
    }

    const didUpdate = await updateRow(this.database, "categories", id, assignments);
    return didUpdate ? this.getById(id) : null;
  }

  public delete(id: number): Promise<boolean> {
    return deleteRow(this.database, "categories", id);
  }
}
