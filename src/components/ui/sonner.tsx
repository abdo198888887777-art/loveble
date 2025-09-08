import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

// Safe wrapper to avoid rendering [object Object] if callers pass an object
function formatArg(arg: any) {
  if (arg === undefined || arg === null) return arg;
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object') {
    if (typeof arg.message === 'string') return arg.message;
    try {
      return JSON.stringify(arg);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function makeSafe(fn: any) {
  return (...args: any[]) => {
    if (args.length === 0) return fn();
    const first = args[0];
    const rest = args.slice(1);

    // If caller passed an object with title/description, format those fields instead of stringifying whole object
    if (first && typeof first === 'object' && (first.title || first.description)) {
      const safe = { ...first } as any;
      if (safe.title && typeof safe.title !== 'string' && !React.isValidElement(safe.title)) safe.title = formatArg(safe.title);
      if (safe.description && typeof safe.description !== 'string' && !React.isValidElement(safe.description)) safe.description = formatArg(safe.description);
      return fn(safe, ...rest);
    }

    return fn(formatArg(first), ...rest);
  };
}

const toast = ((...args: any[]) => makeSafe(sonnerToast)(...args)) as any;

toast.success = makeSafe(sonnerToast.success);
toast.error = makeSafe(sonnerToast.error);
toast.loading = makeSafe(sonnerToast.loading);
toast.dismiss = sonnerToast.dismiss.bind(sonnerToast);

export { Toaster, toast };
