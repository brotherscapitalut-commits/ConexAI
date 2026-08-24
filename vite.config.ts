import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // O split por rota (React.lazy em App.tsx) resolve o código da aplicação,
    // mas as dependências continuariam todas num único `vendor` gigante,
    // baixado inteiro na primeira visita. Estes grupos separam bibliotecas
    // que só algumas telas usam.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // React precisa ficar num chunk próprio e estável: ele é usado por
          // todas as rotas, então isolá-lo maximiza o cache entre deploys.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("/react-router") ||
            id.includes("/@remix-run/")
          ) {
            return "vendor-react";
          }

          // Recharts + d3 são a dependência mais pesada do projeto e só
          // aparecem nos gráficos do dashboard e do admin.
          if (id.includes("/recharts/") || id.includes("/d3-") || id.includes("/victory-")) {
            return "vendor-charts";
          }

          // SDK do Supabase: usado na área logada e em chamadas de dados.
          if (id.includes("/@supabase/")) return "vendor-supabase";

          // Framer Motion carrega o motor de animação inteiro.
          if (id.includes("/framer-motion/") || id.includes("/motion-dom/") || id.includes("/motion-utils/")) {
            return "vendor-motion";
          }

          // Radix: muitos pacotes pequenos que juntos pesam bastante.
          if (id.includes("/@radix-ui/")) return "vendor-radix";

          // Formulários + validação: só telas de cadastro e checkout.
          if (
            id.includes("/react-hook-form/") ||
            id.includes("/@hookform/") ||
            id.includes("/zod/")
          ) {
            return "vendor-forms";
          }

          return "vendor";
        },
      },
    },
    // O limite padrão (500 kB) dispara aviso em praticamente qualquer app
    // React com gráficos. 700 kB mantém o aviso útil sem virar ruído.
    chunkSizeWarningLimit: 700,
  },
}));
