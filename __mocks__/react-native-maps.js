const React = require("react");
const { View } = require("react-native");

class MockMapView extends React.Component {
  animateToRegion = jest.fn();
  fitToCoordinates = jest.fn();

  render() {
    return React.createElement(
      View,
      { ...this.props, testID: this.props.testID || "google-map-view" },
      this.props.children,
    );
  }
}

const MockMarker = (props) => {
  return React.createElement(
    View,
    { ...props, testID: props.testID || `marker-${props.identifier || "pin"}` },
    props.children,
  );
};

module.exports = {
  __esModule: true,
  default: MockMapView,
  Marker: MockMarker,
  PROVIDER_GOOGLE: "google",
  PROVIDER_DEFAULT: "default",
  Callout: (props) => React.createElement(View, props, props.children),
};
