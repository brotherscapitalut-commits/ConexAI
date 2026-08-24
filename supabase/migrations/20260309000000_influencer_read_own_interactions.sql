-- Influencers podem ler suas próprias interações (cliques) para ver contador no painel
CREATE POLICY "Users can read own interactions"
  ON public.interactions FOR SELECT
  USING (auth.uid() = user_id);
