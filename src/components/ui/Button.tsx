import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "destructive";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:pointer-events-none disabled:opacity-50 active:scale-95",
          {
            "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md": variant === "primary",
            "bg-slate-100 text-slate-900 hover:bg-slate-200": variant === "secondary",
            "border border-slate-200 bg-transparent hover:bg-slate-50 text-slate-700": variant === "outline",
            "hover:bg-slate-100 text-slate-700": variant === "ghost",
            "bg-red-50 text-red-600 hover:bg-red-100": variant === "danger",
            "bg-red-600 text-white hover:bg-red-700": variant === "destructive",
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 py-2": size === "md",
            "h-12 px-6 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
