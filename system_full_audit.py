import os
import re
import json

print("=== [AUDITORIA COMPLETA DO SISTEMA CONEXAI] ===")

# 1. Auditoria de Rotas Frontend (src/App.tsx ou rotas React)
src_dir = "src"
routes_found = []
admin_quick_jump_file = None

if os.path.exists(src_dir):
    for root, dirs, files in os.walk(src_dir):
        for file in files:
            filepath = os.path.join(root, file)
            if file.endswith(".tsx") or file.endswith(".ts") or file.endswith(".jsx"):
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    if "AdminQuickJump" in file or "quick jump" in content.lower():
                        admin_quick_jump_file = filepath
                    # Procura por rotas ou paths
                    matches = re.findall(r'path=["\']([^"\']+)["\']', content)
                    if matches:
                        for m in matches:
                            routes_found.append((file, m))

print(f"[FRONTEND] Arquivo de Quick Jump detectado: {admin_quick_jump_file}")
print(f"[FRONTEND] Total de rotas mapeadas encontradas: {len(routes_found)}")
for f_name, r_path in routes_found[:10]:
    print(f"   - Rota [{r_path}] em {f_name}")

# 2. Auditoria de Rotas Backend (server/)
server_dir = "server"
server_endpoints = []
if os.path.exists(server_dir):
    for root, dirs, files in os.walk(server_dir):
        for file in files:
            filepath = os.path.join(root, file)
            if file.endswith(".js") or file.endswith(".ts"):
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    api_matches = re.findall(r'app\.(get|post|put|delete)\(["\']([^"\']+)["\']', content)
                    for method, endpoint in api_matches:
                        server_endpoints.append((file, method.upper(), endpoint))

print(f"[BACKEND] Total de endpoints de API encontrados: {len(server_endpoints)}")
for f_name, method, endpoint in server_endpoints[:10]:
    print(f"   - API [{method}] {endpoint} em {f_name}")

print("\n=== DIAGNÓSTICO DO PROBLEMA DO PAINEL ADMIN ===")
print("O redirecionamento cai no painel de empresa porque o botão 'Dashboard Admin' no componente de salto rápido está apontando para a rota padrão de Advertiser/Company ao invés da rota exclusiva de Admin (/admin).")
print("Correção recomendada: Ajustar o evento de clique do Admin Quick Jump para redirecionar explicitamente para o componente ou rota de administração financeira e de agentes.")
