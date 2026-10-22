"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { toggleSelection, type Selection } from "@/lib/betslip";
import type { Bet, League, User, Wallet } from "@/types/api";

interface AppContextValue {
  leagues: League[];
  selectedLeagueId: string;
  setSelectedLeagueId: (id: string) => void;
  selectedLeague: League | null;
  user: User | null;
  wallet: Wallet | null;
  openBets: Bet[];
  authLoading: boolean;
  slip: Selection[];
  toggleSlipSelection: (sel: Selection) => void;
  removeSlipSelection: (fixtureId: string) => void;
  clearSlip: () => void;
  refreshAccount: () => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  logout: () => Promise<void>;
  betPlacedCounter: number;
  notifyBetPlaced: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [openBets, setOpenBets] = useState<Bet[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [slip, setSlip] = useState<Selection[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [betPlacedCounter, setBetPlacedCounter] = useState(0);

  useEffect(() => {
    async function loadLeagues() {
      const res = await api.league.list();
      if (res.ok && res.data.length > 0) {
        setLeagues(res.data);
        setSelectedLeagueId((prev) => prev || res.data[0]!.id);
      }
    }
    void loadLeagues();
  }, []);

  const refreshAccount = useCallback(async () => {
    const meRes = await api.auth.me();
    if (meRes.ok) {
      setUser(meRes.data);
      const [walletRes, betsRes] = await Promise.all([
        api.wallet.get(),
        api.bets.list("pending"),
      ]);
      if (walletRes.ok) {
        setWallet(walletRes.data);
      }
      if (betsRes.ok) {
        setOpenBets(betsRes.data);
      }
    } else {
      setUser(null);
      setWallet(null);
      setOpenBets([]);
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    void refreshAccount();
  }, [refreshAccount]);

  const toggleSlipSelection = useCallback(
    (sel: Selection) => {
      if (user?.isAdmin) return;
      setSlip((prev) => toggleSelection(prev, sel));
    },
    [user?.isAdmin],
  );

  const removeSlipSelection = useCallback((fixtureId: string) => {
    setSlip((prev) => prev.filter((s) => s.fixtureId !== fixtureId));
  }, []);

  const clearSlip = useCallback(() => {
    setSlip([]);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setUser(null);
    setWallet(null);
    setOpenBets([]);
  }, []);

  const notifyBetPlaced = useCallback(() => {
    setBetPlacedCounter((c) => c + 1);
    void refreshAccount();
  }, [refreshAccount]);

  const selectedLeague = leagues.find((l) => l.id === selectedLeagueId) ?? leagues[0] ?? null;

  return (
    <AppContext.Provider
      value={{
        leagues,
        selectedLeagueId,
        setSelectedLeagueId,
        selectedLeague,
        user,
        wallet,
        openBets,
        authLoading,
        slip,
        toggleSlipSelection,
        removeSlipSelection,
        clearSlip,
        refreshAccount,
        authModalOpen,
        setAuthModalOpen,
        logout,
        betPlacedCounter,
        notifyBetPlaced,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
