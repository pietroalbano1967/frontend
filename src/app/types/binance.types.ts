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