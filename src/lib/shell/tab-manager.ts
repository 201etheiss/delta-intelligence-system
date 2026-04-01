const STORAGE_KEY = "di_open_tabs";

export interface TabState {
  id: string;
  label: string;
  icon: string;
  activePath: string;
  openedAt: number;
}

export const MAX_TABS = 8;

function readStorage(): TabState[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as TabState[];
  } catch {
    return [];
  }
}

function writeStorage(tabs: TabState[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
}

export function getTabs(): TabState[] {
  return readStorage();
}

export function openTab(
  moduleId: string,
  label: string,
  icon: string,
  path: string
): TabState[] {
  const current = readStorage();

  const existingIndex = current.findIndex((t) => t.id === moduleId);
  if (existingIndex !== -1) {
    const updated: TabState[] = current.map((t, i) =>
      i === existingIndex ? { ...t, activePath: path } : { ...t }
    );
    writeStorage(updated);
    return updated;
  }

  if (current.length >= MAX_TABS) {
    return current;
  }

  const newTab: TabState = {
    id: moduleId,
    label,
    icon,
    activePath: path,
    openedAt: Date.now(),
  };

  const updated: TabState[] = [...current, newTab];
  writeStorage(updated);
  return updated;
}

export function closeTab(moduleId: string): TabState[] {
  const current = readStorage();
  const updated: TabState[] = current.filter((t) => t.id !== moduleId);
  writeStorage(updated);
  return updated;
}

export function setActiveTab(_moduleId: string): TabState[] {
  // Per spec: "just marks which is active (no reorder)" — no structural change needed;
  // callers track the active id themselves. We still return the current array so
  // the caller has a consistent snapshot.
  return readStorage();
}

export function updateTabPath(moduleId: string, path: string): TabState[] {
  const current = readStorage();
  const updated: TabState[] = current.map((t) =>
    t.id === moduleId ? { ...t, activePath: path } : { ...t }
  );
  writeStorage(updated);
  return updated;
}

export function reorderTabs(fromIndex: number, toIndex: number): TabState[] {
  const current = readStorage();
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= current.length ||
    toIndex >= current.length ||
    fromIndex === toIndex
  ) {
    return current;
  }

  const tab = current[fromIndex];
  const without: TabState[] = current.filter((_, i) => i !== fromIndex);
  const updated: TabState[] = [
    ...without.slice(0, toIndex),
    tab,
    ...without.slice(toIndex),
  ];
  writeStorage(updated);
  return updated;
}
