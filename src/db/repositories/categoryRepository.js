import { TRANSACTION_TYPES, } from "../../domain/types";
import { assertColorHex, assertNonBlank, assertOneOf, readBoolean, readEnum, readInteger, readString, } from "../validation";
import { deleteRow, findRowById, insertRow, listRows, requireCreatedEntity, updateRow, } from "./shared";
function mapCategory(row) {
    return {
        id: readInteger(row, "id"),
        name: readString(row, "name"),
        icon: readString(row, "icon"),
        colorHex: readString(row, "color_hex"),
        type: readEnum(row, "type", TRANSACTION_TYPES),
        isCustom: readBoolean(row, "is_custom"),
    };
}
function validateCategory(category) {
    assertNonBlank(category.name, "name");
    assertNonBlank(category.icon, "icon");
    assertColorHex(category.colorHex);
    assertOneOf(category.type, TRANSACTION_TYPES, "type");
}
export class CategoryRepository {
    constructor(database) {
        this.database = database;
    }
    async create(category) {
        validateCategory(category);
        const id = await insertRow(this.database, `INSERT INTO categories (name, icon, color_hex, type, is_custom)
       VALUES (?, ?, ?, ?, ?)`, [category.name, category.icon, category.colorHex, category.type, category.isCustom ? 1 : 0]);
        return requireCreatedEntity(await this.getById(id), "Category");
    }
    async getById(id) {
        const row = await findRowById(this.database, "categories", id);
        return row === null ? null : mapCategory(row);
    }
    async list() {
        return (await listRows(this.database, "categories")).map(mapCategory);
    }
    async update(id, patch) {
        const assignments = [];
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
    delete(id) {
        return deleteRow(this.database, "categories", id);
    }
}
