export function mergePaymentDetails(existingSettings, defaultPaymentDetails) {
  return {
    ...defaultPaymentDetails,
    ...existingSettings,
  };
}
