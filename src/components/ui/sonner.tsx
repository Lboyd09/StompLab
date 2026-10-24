import { useEffect, useState } from "react";
import { Toaster as Sonner } from "sonner";
import { useAppStore } from "@/store/app-store";

export function Toaster() {
  const theme = useAppStore((s) => s.theme);
  // On a phone the bottom is the Download bar and the nav, so toasts go to the top there.
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return (
    <Sonner
      theme={theme}
      position={phone ? "top-center" : "bottom-right"}
      toastOptions={{
        classNames: {
          toast: "bg-card text-foreground border-border",
        },
      }}
    />
  );
}
