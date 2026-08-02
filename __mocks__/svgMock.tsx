import type { SvgProps } from "react-native-svg";

// Jest does not run Metro's SVG transformer, so a native view-free stub is sufficient.
export default function SvgMock(_props: SvgProps) {
  return null;
}
