import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "bg-card text-foreground border-border",
        },
      }}
    />
  );
}
