export interface MiniTicker {
  symbol: string;
  event_time: number;
  last_price: number;
  high_price: number;
  low_price: number;
  volume: number;
}

export interface Kline {
  symbol: string;
  start_time: number;
  close_time: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  trades: number;
}

export interface WebSocketMessage {
  type: string;
  payload: MiniTicker | Kline | any;
}
export interface MarketData {
  symbol: string;
  timestamp: number;
  price: number;
  high: number;
  low: number;
  volume: number;
}

// In binance.types.ts
export interface Position {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
}

export interface Trade {
  symbol: string;
  quantity: number;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number; // ✅ Aggiunto
  fee: number;
  timestamp: number;
  status?: 'OPEN' | 'CLOSED';
  profit?: number;
  entryTime?: number;
  exitTime?: number;
  duration?: number;
}


