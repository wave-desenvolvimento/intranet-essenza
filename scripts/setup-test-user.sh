#!/bin/bash
# Creates a test user via Supabase Admin API and seeds notifications
# Usage: bash scripts/setup-test-user.sh

API_URL="http://127.0.0.1:54321"
SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
EMAIL="wesley@wavecommerce.com.br"
PASSWORD="123456"

echo "Creating test user: $EMAIL / $PASSWORD"

# Create user via Admin API
RESPONSE=$(curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Wesley Serafim\"}}")

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo "Error creating user. Response:"
  echo "$RESPONSE"
  exit 1
fi

echo "User created: $USER_ID"

# Update profile (supabase db query only supports single statements)
npx supabase db query "UPDATE profiles SET full_name = 'Wesley Serafim', franchise_id = (SELECT id FROM franchises WHERE slug = 'essenza-matriz'), status = 'active', is_franchise_admin = true, onboarding_completed = true WHERE id = '$USER_ID'" 2>/dev/null

# Assign Owner role
npx supabase db query "INSERT INTO user_roles (user_id, role_id) VALUES ('$USER_ID', (SELECT id FROM roles WHERE slug = 'owner'))" 2>/dev/null

# Insert notifications (one per call)
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Campanhas: Dia das Maes 2026', 'Novo conteudo publicado', '/pagina/campanhas', 'megaphone', false, now() - interval '5 minutes')" 2>/dev/null
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Novo pedido — Essenza Caxias', '8 itens - R\$ 1.250,00', '/gestao-de-pedidos', 'cart', false, now() - interval '15 minutes')" 2>/dev/null
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Materiais PDV: Display Ana Carolina', 'Novo conteudo publicado', '/pagina/material-corporativo', 'megaphone', false, now() - interval '1 hour')" 2>/dev/null
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Pedido #a1b2c3d4 — Aprovado', 'Status atualizado', '/novo-pedido', 'cart', true, now() - interval '2 hours')" 2>/dev/null
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Novo pedido — Essenza Gramado', '3 itens - R\$ 680,00', '/gestao-de-pedidos', 'cart', true, now() - interval '3 hours')" 2>/dev/null
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Fotos: Produto - Valentina 100ml', 'Novo conteudo publicado', '/pagina/biblioteca', 'megaphone', true, now() - interval '1 day')" 2>/dev/null
npx supabase db query "INSERT INTO notifications (user_id, title, body, href, icon, read, created_at) VALUES ('$USER_ID', 'Bem-vindo ao Hub Essenza!', 'Explore os conteudos disponiveis', '/inicio', 'bell', true, now() - interval '7 days')" 2>/dev/null

echo ""
echo "Done! Login with:"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
echo "  Notifications: 7 (3 unread)"
