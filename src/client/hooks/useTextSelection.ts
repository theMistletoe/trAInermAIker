import { type RefObject, useCallback, useState } from 'react';

export interface SelectionInfo {
  excerpt: string;
  // Position for an "ask about this" popover, relative to the container box.
  top: number;
  left: number;
}

// Matches CHAT_MESSAGE_MAX so the quoted excerpt can never exceed what
// askReportBodySchema accepts for quotedText.
const EXCERPT_MAX = 2000;

// Popover offset above the selection (px).
const POPOVER_OFFSET = 36;

export function useTextSelection(containerRef: RefObject<HTMLElement | null>): {
  selection: SelectionInfo | null;
  onMouseUp: () => void;
  clear: () => void;
} {
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  const onMouseUp = useCallback(() => {
    const container = containerRef.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      return;
    }
    // Both ends must live inside the container: a drag that starts or ends
    // outside the report body is not a quotable selection.
    const { anchorNode, focusNode } = sel;
    if (
      !anchorNode ||
      !focusNode ||
      !container.contains(anchorNode) ||
      !container.contains(focusNode)
    ) {
      setSelection(null);
      return;
    }
    const excerpt = sel.toString().trim().slice(0, EXCERPT_MAX);
    if (excerpt === '') {
      setSelection(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const host = container.getBoundingClientRect();
    setSelection({
      excerpt,
      top: rect.top - host.top - POPOVER_OFFSET,
      left: Math.max(0, rect.left - host.left),
    });
  }, [containerRef]);

  const clear = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, onMouseUp, clear };
}
