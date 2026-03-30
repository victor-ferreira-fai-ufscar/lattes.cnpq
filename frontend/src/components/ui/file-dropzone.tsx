"use client";

import * as React from "react";
import { FileCheck2, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";

type FileDropzoneProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  accept?: string;
  disabled?: boolean;
  value?: File;
  error?: boolean;
  onChange: (file: File | undefined) => void;
};

function FileDropzone({
  accept,
  disabled,
  value,
  error,
  onChange,
  className,
  ...divProps
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const open = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) onChange(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    onChange(file);
    e.target.value = "";
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "group relative flex min-h-36 cursor-pointer select-none flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-400",
        isDragging && !disabled
          ? "border-teal-400 bg-teal-50/70"
          : "border-slate-300 bg-slate-50/50 hover:border-teal-300 hover:bg-teal-50/30",
        error && "border-red-300 bg-red-50/40",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...divProps}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="sr-only"
        tabIndex={-1}
        onChange={handleInputChange}
      />

      {value ? (
        <div
          className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3"
          onClick={(e) => e.stopPropagation()}
        >
          <FileCheck2 className="h-5 w-5 shrink-0 text-teal-600" />
          <span className="flex-1 truncate text-left text-sm font-medium text-teal-900">
            {value.name}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={clearFile}
            className="rounded-full p-1 text-teal-500 transition-colors hover:bg-teal-100 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Remover arquivo</span>
          </button>
        </div>
      ) : (
        <>
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors",
              isDragging && "border-teal-300 bg-teal-50",
            )}
          >
            <UploadCloud
              className={cn(
                "h-6 w-6 transition-colors",
                isDragging
                  ? "text-teal-500"
                  : "text-slate-400 group-hover:text-teal-500",
              )}
            />
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-700">
              {isDragging ? (
                "Solte o arquivo aqui"
              ) : (
                <>
                  Arraste ou{" "}
                  <span className="text-teal-600 underline underline-offset-2">
                    clique para selecionar
                  </span>
                </>
              )}
            </p>
            <p className="text-xs text-slate-500">Apenas .csv • máx. 5 MB</p>
          </div>
        </>
      )}
    </div>
  );
}

export { FileDropzone };
