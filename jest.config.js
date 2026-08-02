module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.js", "**/*.test.jsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.svg$": "<rootDir>/__mocks__/svgMock.jsx",
  },
  collectCoverageFrom: [
    "src/db/**/*.js",
    "src/domain/types.js",
    "src/domain/services/**/*.js",
    "src/services/**/*.js",
    "!src/db/client.js",
    "!src/db/databaseKey.js",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|nativewind|react-native-css-interop|react-native-svg|zustand)",
  ],
};
