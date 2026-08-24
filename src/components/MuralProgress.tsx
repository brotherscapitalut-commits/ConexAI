import { motion } from "framer-motion";
import { STATS, MOCK_BRANDS } from "@/data/mockData";
import { Progress } from "@/components/ui/progress";
import { Flame, Target } from "lucide-react";

const MuralProgress = () => {
  const occupied = STATS.totalBlocks;
  const total = STATS.blocksAvailable;
  const percentage = Math.min(100, (occupied / total) * 100);
  const remaining = total - occupied;

  return (
    <section className="py-16">
      <div className="container mx-auto px-6">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">
              O mural está <span className="text-gradient">enchendo</span>
            </h2>
            <p className="text-muted-foreground">
              Garanta seu espaço antes que acabe — blocos premium vão primeiro!
            </p>
          </div>

          <div className="rounded-2xl border border-border surface-elevated p-8">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Ocupação do mural</span>
              <span className="text-sm font-display font-bold text-primary">{percentage.toFixed(2)}%</span>
            </div>
            <Progress value={percentage} className="h-4 mb-6" />

            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Flame className="w-5 h-5 text-primary mx-auto mb-1" />
                <div className="text-xl font-display font-bold">{remaining.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Blocos restantes</div>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                <div className="text-xl font-display font-bold">{STATS.totalClicks.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">Cliques gerados</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default MuralProgress;
