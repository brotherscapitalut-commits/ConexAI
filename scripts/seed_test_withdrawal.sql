-- Insere uma solicitação de saque de teste (pending) para testar Aprovar/Negar em /admin/finance.
-- Usa o primeiro perfil existente em profiles; se não houver, nada é inserido.

INSERT INTO public.withdrawal_requests (user_id, amount, status, created_at)
SELECT id, 150.00, 'pending', now()
FROM public.profiles
LIMIT 1;

-- Se withdrawal_requests não tiver UNIQUE que cause conflict, o ON CONFLICT não faz nada. Sem problemas.
-- Para garantir um único registro de teste, você pode rodar: DELETE FROM public.withdrawal_requests WHERE amount = 150 AND status = 'pending'; antes, se quiser repetir.
