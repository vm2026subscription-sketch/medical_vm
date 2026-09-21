import { apiRequest } from "./api-client";
export interface CheckoutResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
export interface PaymentStatus {
  paymentId: string;
  status: string;
  fulfillmentStatus: string;
  message: string;
  amount: number;
  purpose: string;
}
export async function confirmPayment(
  paymentId: string,
  response: CheckoutResponse,
): Promise<PaymentStatus> {
  const result = await apiRequest<{ data: PaymentStatus }>("/billing/verify", {
    method: "POST",
    body: { paymentId, ...response },
  });
  return result.data;
}
export async function checkPayment(paymentId: string): Promise<PaymentStatus> {
  const result = await apiRequest<{ data: PaymentStatus }>(`/billing/payments/${paymentId}`);
  return result.data;
}
