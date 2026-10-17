import { Toaster as Sonner } from "sonner";
import { useAppStore } from "@/store/app-store";

export function Toaster() {
  const theme = useAppStore((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      toastOptions={{
        classNames: {
          toast: "bg-card text-foreground border-border",
        },
      }}
    />
  );
}
