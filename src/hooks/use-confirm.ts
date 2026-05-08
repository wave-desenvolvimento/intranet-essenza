"use client";

import { useState, useCallback } from "react";

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const confirm = useCallback(
    (options: { title: string; message: string; confirmLabel?: string; destructive?: boolean }) => {
      return new Promise<boolean>((resolve) => {
        setState({
          ...options,
          open: true,
          onConfirm: () => {
            setState((s) => ({ ...s, open: false }));
            resolve(true);
          },
        });
      });
    },
    []
  );

  const cancel = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return {
    confirm,
    dialogProps: {
      open: state.open,
      title: state.title,
      message: state.message,
      confirmLabel: state.confirmLabel,
      destructive: state.destructive,
      onConfirm: state.onConfirm,
      onCancel: cancel,
    },
  };
}
