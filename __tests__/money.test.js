import { formatMinor, formatPesos, formatTransactionAmount, minorToWholePesos, parseDecimalToMinor, parseEditedWholePesosToMinor, parseWholePesosToMinor, updateMoneyInput, } from "../src/domain/services/money";
describe("integer minor-unit money utilities", () => {
    it("formats grouped peso values only at the display boundary", () => {
        expect(formatMinor(4_285_000)).toBe("₱42,850");
        expect(formatMinor(2_215_000, { showCents: false })).toBe("₱22,150");
        expect(formatMinor(-18_500)).toBe("-₱185");
        expect(formatMinor(1_120_000)).toBe("₱11,200");
        expect(formatMinor(50_000)).toBe("₱500");
        expect(formatMinor(186_600)).toBe("₱1,866");
        expect(formatMinor(0)).toBe("₱0");
        expect(formatMinor(125)).toBe("₱1");
        expect(formatMinor(150)).toBe("₱2");
        expect(formatMinor(-150)).toBe("-₱2");
        expect(minorToWholePesos(-50)).toBe(-1);
        expect(formatPesos(11200)).toBe("₱11,200");
    });
    it("derives transaction signs from the transaction type", () => {
        expect(formatTransactionAmount(18_500, "EXPENSE")).toBe("-₱185");
        expect(formatTransactionAmount(3_250_000, "INCOME")).toBe("+₱32,500");
        expect(() => formatTransactionAmount(-1, "EXPENSE")).toThrow(RangeError);
    });
    it("parses decimal keypad text without floating-point currency math", () => {
        expect(parseDecimalToMinor("185.00")).toBe(18_500);
        expect(parseDecimalToMinor("0.5")).toBe(50);
        expect(parseDecimalToMinor("42")).toBe(4_200);
        expect(() => parseDecimalToMinor("1.234")).toThrow(RangeError);
    });
    it("allows only exact whole-peso new entries without changing historical parsing", () => {
        expect(parseWholePesosToMinor("11200")).toBe(1_120_000);
        expect(parseWholePesosToMinor("-185", { allowNegative: true })).toBe(-18_500);
        expect(() => parseWholePesosToMinor("0.50")).toThrow(RangeError);
        expect(() => parseWholePesosToMinor("90071992547410")).toThrow(RangeError);
        expect(parseDecimalToMinor("0.50")).toBe(50);
        expect(parseEditedWholePesosToMinor("251", 25_050)).toBe(25_050);
        expect(parseEditedWholePesosToMinor("252", 25_050)).toBe(25_200);
    });
    it("applies keypad events as a bounded string state machine", () => {
        expect(updateMoneyInput("0", "1")).toBe("1");
        expect(updateMoneyInput("18", ".")).toBe("18");
        expect(updateMoneyInput("18", "5")).toBe("185");
        expect(updateMoneyInput("1", "⌫")).toBe("0");
    });
});
