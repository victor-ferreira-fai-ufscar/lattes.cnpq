"use client";

import { useState } from "react";

import { getApiErrorMessage } from "@/lib/http";

export function useLattesWorkbenchFeedback() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const resetFeedback = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const notifyError = (error: unknown) => {
    setStatusMessage(null);
    setErrorMessage(getApiErrorMessage(error));
  };

  const notifySuccess = (message: string) => {
    setErrorMessage(null);
    setStatusMessage(message);
  };

  return {
    errorMessage,
    statusMessage,
    resetFeedback,
    notifyError,
    notifySuccess,
  };
}