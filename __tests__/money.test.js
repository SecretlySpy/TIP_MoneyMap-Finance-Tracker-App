import { formatMinor, formatTransactionAmount, parseDecimalToMinor, updateMoneyInput, } from "../src/domain/services/money";
describe("integer minor-unit money utilities", () => {
    it("formats grouped peso values only at the display boundary", () => {
        expect(formatMinor(4_285_000)).toBe("₱42,850.00");
        expect(formatMinor(2_215_000, { showCents: false })).toBe("₱22,150");
        expect(formatMinor(-18_500)).toBe("-₱185.00");
    });
    it("derives transaction signs from the transaction type", () => {
        expect(formatTransactionAmount(18_500, "EXPENSE")).toBe("-₱185.00");
        expect(formatTransactionAmount(3_250_000, "INCOME")).toBe("+₱32,500.00");
        expect(() => formatTransactionAmount(-1, "EXPENSE")).toThrow(RangeError);
    });
    it("parses decimal keypad text without floating-point currency math", () => {
        expect(parseDecimalToMinor("185.00")).toBe(18_500);
        expect(parseDecimalToMinor("0.5")).toBe(50);
        expect(parseDecimalToMinor("42")).toBe(4_200);
        expect(() => parseDecimalToMinor("1.234")).toThrow(RangeError);
    });
    it("applies keypad events as a bounded string state machine", () => {
        expect(updateMoneyInput("0", "1")).toBe("1");
        expect(updateMoneyInput("18", ".")).toBe("18.");
        expect(updateMoneyInput("18.5", "0")).toBe("18.50");
        expect(updateMoneyInput("18.50", "9")).toBe("18.50");
        expect(updateMoneyInput("1", "⌫")).toBe("0");
    });
});
