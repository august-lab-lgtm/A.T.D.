export function getCameraErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    switch (err.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Camera access denied. Grant permission in the browser and macOS camera privacy settings.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "No camera was found. Connect a webcam or camera device and try again.";
      case "NotReadableError":
      case "TrackStartError":
        return "Camera is currently unavailable. Another app may be using the device.";
      case "OverconstrainedError":
      case "ConstraintNotSatisfiedError":
        return "The requested camera resolution is not supported by this device.";
      case "SecurityError":
        return "Secure camera access is required. Use HTTPS or localhost.";
      default:
        return err.message || "Unable to access camera. Please check permissions.";
    }
  }

  return "Unable to access camera. Please check browser and system permissions.";
}

export function getCameraHelpText(): string {
  if (typeof window === "undefined") {
    return "";
  }

  if (!window.isSecureContext) {
    return "Camera access requires HTTPS or localhost.";
  }

  return "Allow the camera prompt in your browser, then reload the page if needed.";
}
