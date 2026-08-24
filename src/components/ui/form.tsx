import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

function Form({ className, ...props }: React.ComponentProps<"form">) {
  return <form data-slot="form" className={cn("grid gap-4", className)} {...props} />;
}

function FormField({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="form-field" className={cn("grid gap-2", className)} {...props} />;
}

function FormLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="form-label" className={cn("text-[13px] font-medium", className)} {...props} />;
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p data-slot="form-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="form-message"
      role="alert"
      className={cn("text-sm text-destructive", className)}
      {...props}
    />
  );
}

export { Form, FormField, FormLabel, FormDescription, FormMessage };
