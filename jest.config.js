module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.svg$": "<rootDir>/__mocks__/svgMock.tsx",
  },
  collectCoverageFrom: [
    "src/db/**/*.ts",
    "src/domain/types.ts",
    "src/domain/services/**/*.ts",
    "!src/db/client.ts",
    "!src/db/databaseKey.ts",
  ],
};
