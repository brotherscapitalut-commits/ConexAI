import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const CHANNEL_NAME = "mural-influencers-online";

/**
 * Conta influenciadores online no momento (tela aberta, prontos para bate-papo).
 * Usa Supabase Realtime presence: influenciadores que estão no dashboard ou no mural
 * fazem track nesse canal; aqui apenas contamos.
 */
export function useOnlineInfluencerCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      if (!supabase?.channel) return;
      const channel = supabase.channel(CHANNEL_NAME);
      channel
        .on("presence", { event: "sync" }, () => {
          try {
            const state = channel.presenceState();
            const keys = Object.keys(state);
            let total = 0;
            keys.forEach((key) => {
              total += (state[key] || []).length;
            });
            setCount(total);
          } catch {
            setCount(0);
          }
        })
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            try {
              const state = channel.presenceState();
              const keys = Object.keys(state);
              let total = 0;
              keys.forEach((key) => {
                total += (state[key] || []).length;
              });
              setCount(total);
            } catch {
              setCount(0);
            }
          }
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    } catch {
      return () => {};
    }
  }, []);

  return count;
}

/** Faz o usuário atual ser contado como "influenciador online" (chamar no dashboard do influenciador). */
export function useTrackInfluencerOnline(userId: string | null, isInfluencer: boolean): void {
  useEffect(() => {
    if (!userId || !isInfluencer) return;
    try {
      if (!supabase?.channel) return;
      const channel = supabase.channel(CHANNEL_NAME);
      channel.track({ user_id: userId, updated_at: new Date().toISOString() });
      channel.subscribe();
      const interval = setInterval(() => {
        try {
          channel.track({ user_id: userId, updated_at: new Date().toISOString() });
        } catch {}
      }, 20000);
      return () => {
        clearInterval(interval);
        try {
          supabase.removeChannel(channel);
        } catch {}
      };
    } catch {}
  }, [userId, isInfluencer]);
}
