import type { KeyboardEvent } from "react";

export function shouldSubmitMessageOnEnter(key: string, shiftKey: boolean, isComposing: boolean) {
  return key === "Enter" && !shiftKey && !isComposing;
}

export function handleMessageComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (!shouldSubmitMessageOnEnter(event.key, event.shiftKey, event.nativeEvent.isComposing)) return;
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}
