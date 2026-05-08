import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const coins = [
  { symbol: "BTC/USDT", apiSymbol: "BTCUSDT", name: "Bitcoin", price: 0, change: 0, icon: "₿" },
  { symbol: "ETH/USDT", apiSymbol: "ETHUSDT", name: "Ethereum", price: 0, change: 0, icon: "◆" },
  { symbol: "DOGE/USDT", apiSymbol: "DOGEUSDT", name: "Dogecoin", price: 0, change: 0, icon: "Ð" },
  { symbol: "PAXG/USDT", apiSymbol: "PAXGUSDT", name: "Gold Token", price: 0, change: 0, icon: "▰" },
  { symbol: "TRX/USDT", apiSymbol: "TRXUSDT", name: "TRON", price: 0, change: 0, icon: "T" },
];

function makeCandles(base = 80000) {
  let last = base;
  return Array.from({ length: 34 }, (_, i) => {
    const open = last;
    const close = open + (Math.random() - 0.45) * 160;
    const high = Math.max(open, close) + Math.random() * 80;
    const low = Math.min(open, close) - Math.random() * 80;
    last = close;
    return { i, open, close, high, low };
  });
}

function MiniChart({ base, apiSymbol }) {
  const [candles, setCandles] = useState(() => makeCandles(base));

  useEffect(() => {
    setCandles(prev => {
      const next = [...prev];
      const lastIndex = next.length - 1;
      const last = next[lastIndex];
      next[lastIndex] = {
        ...last,
        close: base,
        high: Math.max(last.high, base),
        low: Math.min(last.low, base),
      };
      return next;
    });
  }, [base]);

  useEffect(() => {
    const loadRealKlines = async () => {
      if (!apiSymbol) return;
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=1m&limit=34`);
        const data = await res.json();
        if (!Array.isArray(data)) return;
        setCandles(data.map(k => ({
          i: k[0],
          open: Number(k[1]),
          high: Number(k[2]),
          low: Number(k[3]),
          close: Number(k[4]),
        })));
      } catch (error) {
        console.log("Kline fetch failed", error);
      }
    };

    loadRealKlines();
    const timer = setInterval(loadRealKlines, 60000);
    return () => clearInterval(timer);
  }, [apiSymbol]);

  const max = Math.max(...candles.map(c => c.high));
  const min = Math.min(...candles.map(c => c.low));
  const h = 260;
  const w = 540;
  const scale = v => h - ((v - min) / (max - min || 1)) * h + 12;

  return (
    <div className="rounded-xl bg-slate-950 p-3 overflow-hidden">
      <div className="flex justify-around text-slate-400 text-sm mb-2">
        <span className="text-sky-400 border-b-2 border-sky-400 px-2">1M</span><span>5M</span><span>30M</span><span>1H</span><span>4H</span><span>1D</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h + 28}`} className="w-full h-72">
        {[0,1,2,3,4].map(n => <line key={n} x1="0" x2={w} y1={25+n*48} y2={25+n*48} stroke="rgba(255,255,255,.07)" />)}
        {candles.map((c, idx) => {
          const x = idx * 15 + 14;
          const up = c.close >= c.open;
          const y = Math.min(scale(c.open), scale(c.close));
          const height = Math.max(4, Math.abs(scale(c.open) - scale(c.close)));
          return <motion.g key={c.i || idx} initial={{ opacity: 0.65 }} animate={{ opacity: 1 }}>
            <line x1={x+4} x2={x+4} y1={scale(c.high)} y2={scale(c.low)} stroke={up ? "#24d18b" : "#ff5670"} strokeWidth="2" />
            <rect x={x} y={y} width="8" height={height} rx="1" fill={up ? "#24d18b" : "#ff5670"} />
          </motion.g>;
        })}
        <text x="70" y="250" fill="#38bdf8" fontSize="16">Chart by TradingView</text>
      </svg>
    </div>
  );
}

export default function App() {
  const [connected, setConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletError, setWalletError] = useState("");
  const [marketCoins, setMarketCoins] = useState(coins);
  const [selectedSymbol, setSelectedSymbol] = useState(coins[0].symbol);
  const selected = marketCoins.find(c => c.symbol === selectedSymbol) || marketCoins[0];
  const [page, setPage] = useState("market");
  const [orderOpen, setOrderOpen] = useState(false);
  const [direction, setDirection] = useState("Up");
  const [amount, setAmount] = useState(0);
  const [balance, setBalance] = useState(10000);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const loadRealPrices = async () => {
      try {
        const updated = await Promise.all(coins.map(async coin => {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${coin.apiSymbol}`);
          const data = await res.json();
          const price = Number(data.lastPrice);
          const change = Number(data.priceChangePercent);
          return {
            ...coin,
            price: Number(price.toFixed(price > 10 ? 4 : 6)),
            change: Number(change.toFixed(2)),
          };
        }));
        setMarketCoins(updated);
      } catch (error) {
        console.log("Price fetch failed", error);
      }
    };

    loadRealPrices();
    const timer = setInterval(loadRealPrices, 2000);
    return () => clearInterval(timer);
  }, []);

  const connectWallet = async () => {
    setWalletError("");

    if (!window.ethereum) {
      setWalletError("请用 MetaMask / OKX Wallet / Trust Wallet 的内置浏览器打开，或先安装钱包插件。");
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts?.[0] || "";
      setWalletAddress(address);
      setConnected(!!address);
    } catch (error) {
      setWalletError("钱包连接被取消，或钱包没有授权。");
    }
  };

  const shortAddress = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : "";

  const submitOrder = () => {
    const value = Number(amount);
    if (!value || value <= 0 || value > balance) return;
    const win = Math.random() > 0.45;
    const pnl = win ? value * 0.08 : -value * 0.06;
    setBalance(b => +(b + pnl).toFixed(2));
    setOrders([{ coin: selected.symbol, direction, value, pnl: +pnl.toFixed(2), time: new Date().toLocaleTimeString() }, ...orders]);
    setOrderOpen(false);
    setAmount(0);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center p-0 sm:p-6">
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl sm:rounded-[2rem] overflow-hidden relative">
        <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-b-[2rem] text-white p-6 pb-8">
          <div className="flex items-center justify-between mb-7">
            <span className="text-3xl">☰</span>
            <Button onClick={connectWallet} className="bg-white/10 hover:bg-white/20 border border-white/80 rounded-xl px-5">
              {connected ? shortAddress : "Connect wallet"}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-semibold">Web3 Demo</h1>
              <p className="text-white/80 mt-2">模拟交易系统 · 不涉及真实资金</p>
              {walletError && <p className="mt-2 text-sm bg-white/20 rounded-lg px-3 py-2">{walletError}</p>}
            </div>
            <div className="text-6xl">💳</div>
          </div>
        </div>

        <div className="grid grid-cols-4 text-center px-5 -mt-1 py-5 gap-2 font-semibold">
          <div><div className="text-3xl text-blue-600">💼</div><p>My account</p></div>
          <div><div className="text-3xl text-blue-600">⬆️</div><p>Demo Assets</p></div>
          <div><div className="text-3xl text-blue-600">📊</div><p>AI Finance</p></div>
          <div><div className="text-3xl text-blue-600">💬</div><p>Chat</p></div>
        </div>

        <div className="px-5 pb-24">
          <div className="flex items-end justify-between mt-5 mb-5">
            <h2 className="text-3xl font-medium">Market</h2>
            <div className="text-right"><p className="text-sm text-slate-500">Demo Balance</p><p className="font-bold">USDT {balance.toFixed(2)}</p></div>
          </div>
          <div className="flex gap-3 mb-5">
            <Button className="rounded-full bg-blue-600 px-5">Hot Coins</Button>
            <Button variant="outline" className="rounded-full text-xl">★</Button>
            <Button variant="outline" className="rounded-full px-5">All products</Button>
          </div>

          <div className="space-y-1">
            {marketCoins.map(coin => <button key={coin.symbol} onClick={() => { setSelectedSymbol(coin.symbol); setPage("detail"); }} className="w-full flex items-center justify-between border-b py-4 hover:bg-slate-50 rounded-xl px-2 active:scale-[0.99] transition">
              <div className="flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold">{coin.icon}</div>
                <div><p className="text-xl font-bold">{coin.symbol}</p><p className="text-slate-500">USDT</p></div>
              </div>
              <motion.p key={coin.price} initial={{ opacity: 0.45, y: -3 }} animate={{ opacity: 1, y: 0 }} className={coin.change >= 0 ? "text-green-500 font-bold text-xl" : "text-red-500 font-bold text-xl"}>{coin.price}</motion.p>
              <span className={coin.change >= 0 ? "bg-green-500 text-white rounded-lg px-3 py-2" : "bg-red-500 text-white rounded-lg px-3 py-2"}>{coin.change > 0 ? "+" : ""}{coin.change}%</span>
            </button>)}
          </div>

          {page === "detail" && <div className="fixed inset-0 z-40 bg-white overflow-y-auto sm:static sm:rounded-2xl sm:mt-7">
            <div className="p-5">
              <button onClick={() => setPage("market")} className="text-3xl mb-5">←</button>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold text-xl">{selected.icon}</div>
                  <h3 className="text-3xl font-semibold">{selected.symbol}</h3>
                </div>
                <button className="text-3xl">☆</button>
              </div>
              <motion.p key={selected.price} initial={{ opacity: 0.45, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-4xl font-semibold">US$ {selected.price}</motion.p>
              <p className={selected.change >= 0 ? "text-green-600 text-xl" : "text-red-600 text-xl"}>US$ {(selected.price * selected.change / 100).toFixed(4)} ({selected.change}%)</p>
              <div className="mt-6"><MiniChart base={selected.price} apiSymbol={selected.apiSymbol}/></div>
              <p className="mt-2 text-sm text-slate-500">价格来自 Binance 实时行情，1M K线每 60 秒更新一次</p>
              <h3 className="text-2xl font-semibold mt-6 mb-3">Market Statistics</h3>
              <Button onClick={() => setOrderOpen(true)} className="w-full mt-2 rounded-xl h-14 bg-gradient-to-r from-blue-600 to-cyan-400 text-lg">Order</Button>
              <div className="mt-6 flex justify-between border-b py-4 text-lg"><span>24 hours</span><span>US$ 25917</span></div>
              <div className="mt-2 flex justify-between border-b py-4 text-lg"><span>Demo balance</span><span>{balance.toFixed(2)} USDT</span></div>
            </div>
          </div>}

          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-3">Order History</h3>
            {orders.length === 0 ? <p className="text-slate-500">暂无模拟订单</p> : orders.map((o, idx) => <div key={idx} className="flex justify-between border-b py-3 text-sm">
              <span>{o.time} · {o.coin} · {o.direction}</span><span className={o.pnl >= 0 ? "text-green-600" : "text-red-600"}>{o.pnl >= 0 ? "+" : ""}{o.pnl} USDT</span>
            </div>)}
          </div>
        </div>

        {orderOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 flex items-end">
          <motion.div initial={{ y: 420 }} animate={{ y: 0 }} className="bg-white rounded-t-3xl w-full p-5">
            <div className="flex justify-between items-center border-b pb-4"><h2 className="text-2xl font-semibold">{selected.symbol} Delivery</h2><button onClick={() => setOrderOpen(false)} className="text-2xl">×</button></div>
            <div className="flex justify-between mt-5">
              <div className="flex gap-3"><div className="w-11 h-11 rounded-full bg-orange-400 text-white flex items-center justify-center font-bold">{selected.icon}</div><div><p className="text-xl font-semibold">{selected.name} Coin</p><p>Buy <span className={direction === "Up" ? "text-green-600" : "text-red-600"}>{direction}</span></p></div></div>
              <div className="text-right"><span className="text-blue-600">●</span><p>Demo</p></div>
            </div>
            <p className="mt-5 mb-2 text-lg">Delivery time</p>
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" className="h-14 text-lg">⏱ 60S</Button>
              <Button onClick={() => setDirection("Up")} className={direction === "Up" ? "h-14 bg-green-600 text-lg" : "h-14 bg-slate-400 text-lg"}>Up</Button>
              <Button onClick={() => setDirection("Fall")} className={direction === "Fall" ? "h-14 bg-red-600 text-lg" : "h-14 bg-slate-400 text-lg"}>Fall</Button>
            </div>
            <p className="mt-5 mb-2 text-lg">Purchase amount</p>
            <div className="flex items-center border rounded-xl p-3 bg-slate-50">
              <span className="text-2xl mr-3">₮</span><input value={amount} onChange={e => setAmount(e.target.value)} className="flex-1 bg-transparent outline-none text-xl" placeholder="0" type="number" />
              <span className="text-slate-500">Minimum: 1</span><span className="ml-3 text-blue-600 text-xl">↻</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">Available assets: {balance.toFixed(2)}</p>
            <Button onClick={submitOrder} className="w-full mt-4 h-14 bg-green-700 rounded-xl text-lg">Order</Button>
          </motion.div>
        </motion.div>}
      </div>
    </div>
  );
}
