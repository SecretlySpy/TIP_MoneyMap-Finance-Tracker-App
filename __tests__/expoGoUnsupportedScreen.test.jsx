import { render } from "@testing-library/react-native";
import { ExpoGoUnsupportedScreen } from "../src/screens/ExpoGoUnsupportedScreen";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

describe("ExpoGoUnsupportedScreen", () => {
  it("explains why Expo Go crashes and how to run the development build", async () => {
    const screen = await render(<ExpoGoUnsupportedScreen />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Expo Go cannot run MoneyMap")).toBeTruthy();
    expect(screen.getByText(/SQLCipher/)).toBeTruthy();
    expect(screen.getByText(/npm run android/)).toBeTruthy();
  });
});
