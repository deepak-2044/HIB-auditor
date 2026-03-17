
export interface HistoryItem {
  id: string;
  timestamp: number;
  data: any;
}

const HISTORY_KEY = 'hib_audit_history';
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const saveToHistory = (data: any) => {
  const history = getHistory();
  const id = crypto.randomUUID();
  data.id = id; // Inject ID into data for easier tracking
  const newItem: HistoryItem = {
    id,
    timestamp: Date.now(),
    data
  };
  
  const updatedHistory = [newItem, ...history];
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  cleanupHistory();
};

export const getHistory = (): HistoryItem[] => {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    return [];
  }
};

export const cleanupHistory = () => {
  const history = getHistory();
  const now = Date.now();
  const filtered = history.filter(item => (now - item.timestamp) < ONE_WEEK_MS);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
};

export const deleteHistoryItem = (id: string) => {
  const history = getHistory();
  const filtered = history.filter(item => item.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
};

export const clearHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

export const updateHistoryItemStatus = (id: string, status: 'approved' | 'flagged') => {
  const history = getHistory();
  const updated = history.map(item => {
    if (item.id === id || item.data.id === id) {
      return { 
        ...item, 
        status,
        data: { ...item.data, status } // Also update nested data
      };
    }
    return item;
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
};
