declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}
let loading: Promise<boolean> | null = null;
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (!ok) script.remove();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 15000);
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => finish(Boolean(window.Razorpay));
    script.onerror = () => finish(false);
    document.body.appendChild(script);
  }).finally(() => {
    loading = null;
  });
  return loading;
}
