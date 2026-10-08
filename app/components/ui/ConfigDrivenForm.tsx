"use client";

import { useState, useCallback, useEffect } from "react";
import { z } from "zod";
import type { FieldConfig } from "@/app/lib/types";
import { AppInput, AppTextarea, AppSelect, AppButton } from "./";

export interface ConfigDrivenFormProps {
  fields: FieldConfig[];
  initialValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
  isLoading?: boolean;
}

function buildFieldSchema(field: FieldConfig): z.ZodTypeAny {
  let schema: z.ZodTypeAny = z.string();

  if (field.type === "email") {
    schema = z.string().email("Invalid email address");
  }

  const v = field.validation;
  if (v) {
    if (typeof v.minLength === "number") {
      schema = (schema as z.ZodString).min(
        v.minLength,
        `Must be at least ${v.minLength} characters`,
      );
    }
    if (typeof v.maxLength === "number") {
      schema = (schema as z.ZodString).max(
        v.maxLength,
        `Must be at most ${v.maxLength} characters`,
      );
    }
    if (typeof v.pattern === "string") {
      schema = (schema as z.ZodString).regex(new RegExp(v.pattern), "Invalid format");
    }
  }

  if (field.required && field.type !== "email") {
    schema = (schema as z.ZodString).min(1, `${field.label} is required`);
  }

  return schema;
}

export function ConfigDrivenForm({
  fields,
  initialValues,
  onSubmit,
  submitLabel = "Submit",
  isLoading = false,
}: ConfigDrivenFormProps) {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Coerce any non-string initial value (objects, numbers, null) to a
  // displayable string so inputs never render "[object Object]".
  const coerceValues = useCallback(
    (values?: Record<string, unknown>): Record<string, string> => {
      const out: Record<string, string> = {};
      for (const f of fields) {
        const raw = values?.[f.name];
        if (raw == null) out[f.name] = "";
        else if (typeof raw === "string") out[f.name] = raw;
        else if (typeof raw === "number" || typeof raw === "boolean") out[f.name] = String(raw);
        else out[f.name] = "";
      }
      return out;
    },
    [fields],
  );
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    coerceValues(initialValues),
  );

  // initialValues often arrive async (profile fetch). Re-sync when they
  // change so the form is prefilled instead of staying empty.
  useEffect(() => {
    setFormValues(coerceValues(initialValues));
  }, [initialValues, coerceValues]);

  const schema = z.object(
    Object.fromEntries(fields.map((f) => [f.name, buildFieldSchema(f)])),
  );

  const updateField = useCallback((name: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  // AppInput/AppTextarea/AppSelect forward native change events, not plain
  // strings. Accept both shapes so the stored value is always a string and
  // inputs never end up holding an event object ("[object Object]").
  const fieldChangeHandler = useCallback(
    (name: string) => (v: string | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value =
        typeof v === "string"
          ? v
          : (v?.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined)?.value ?? "";
      updateField(name, value);
    },
    [updateField],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFieldErrors({});

      const result = await schema.safeParseAsync(formValues);
      if (!result.success) {
        const errors: Record<string, string> = {};
        for (const issue of result.error.issues) {
          const fieldName = issue.path[0] as string;
          if (!errors[fieldName]) errors[fieldName] = issue.message;
        }
        setFieldErrors(errors);
        return;
      }

      await onSubmit(result.data as Record<string, unknown>);
    },
    [formValues, schema, onSubmit],
  );

  const renderField = (field: FieldConfig) => {
    const IconComponent = field.icon;
    const commonProps: Record<string, unknown> = {
      key: field.name,
      label: (
        <span>
          {field.label}
          {field.required && <span className="text-error-text"> *</span>}
        </span>
      ),
      placeholder: field.placeholder,
      icon: IconComponent ? <IconComponent size={16} /> : undefined,
      error: fieldErrors[field.name],
      value: formValues[field.name] ?? "",
      onChange: fieldChangeHandler(field.name),
    };

    switch (field.type) {
      case "textarea":
        return <AppTextarea {...commonProps} />;
      case "select":
        return (
          <AppSelect {...commonProps} options={field.options ?? []} />
        );
      default:
        return <AppInput {...commonProps} type={field.type} />;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {fields.map(renderField)}
      <AppButton
        type="submit"
        variant="primary"
        fullWidth
        loading={isLoading}
        disabled={isLoading}
      >
        {submitLabel}
      </AppButton>
    </form>
  );
}
