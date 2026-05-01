import { FloorPlan } from "../components/FloorPlan";

if (!cap.open(0)) {
  std::cerr << "Error opening camera" << std::endl;
}

const mediaStream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
});
setStream(mediaStream);
if (videoRef.current) {
  videoRef.current.srcObject = mediaStream;
}

<FloorPlan
  people={state.people}
  bounds={BOUNDS}
  onTrackedPositionUpdate={handleTrackedPositionUpdate}
/>