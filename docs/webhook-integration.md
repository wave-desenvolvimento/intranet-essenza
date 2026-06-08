# Webhook de Integração — Pedidos Aprovados

## Visão Geral

Quando um pedido muda para o status **aprovado** na intranet, um webhook (HTTP POST) é disparado automaticamente para o sistema externo configurado. Toda a lógica roda dentro do Supabase (trigger + pg_cron + pg_net), sem depender do Next.js.

---

## Fluxo

```
Pedido aprovado → Trigger no banco → Insere na webhook_queue → pg_cron (1 min)
→ POST para URL configurada com API Key → Sucesso (delivered) ou Retry (até 5x)
```

---

## 1. Configuração

### 1.1 Acessar o Supabase

1. Acesse o painel do Supabase: https://supabase.com/dashboard
2. Selecione o projeto **Essenza** (ref: `vahjdglapjrjkgncbkze`)
3. Vá em **Table Editor** → tabela `webhook_config`

### 1.2 Atualizar a configuração

Edite o registro `orders_approved` com os dados do sistema externo:

| Campo | O que preencher | Exemplo |
|---|---|---|
| `url` | URL completa do endpoint que vai receber o POST | `https://erp.exemplo.com/api/webhooks/pedidos` |
| `api_key` | Chave de autenticação fornecida pelo sistema externo | `sk_live_abc123def456` |
| `active` | Marcar como `true` para ativar | `true` |

**Via SQL Editor:**

```sql
UPDATE webhook_config
SET url = 'https://erp.exemplo.com/api/webhooks/pedidos',
    api_key = 'sk_live_abc123def456',
    active = true
WHERE name = 'orders_approved';
```

> **IMPORTANTE:** Enquanto `active = false`, nenhum webhook será enviado, mesmo que pedidos sejam aprovados.

---

## 2. Payload enviado (formato Allcance)

O sistema externo receberá um **POST** com um **array JSON** contendo o pedido:

```json
[
  {
    "id": null,
    "pedido_origem_id": null,
    "cliente_id": 48330273,
    "transportadora_id": 0,
    "transportadora_nome": "",
    "tipo_pedido_id": null,
    "criador_id": 674276,
    "nome_contato": "",
    "status": "2",
    "numero": 42,
    "rastreamento": "",
    "valor_frete": null,
    "total": 705.0,
    "condicao_pagamento": "7 DIAS",
    "condicao_pagamento_id": 2675221,
    "forma_pagamento_id": 515394,
    "data_emissao": "2026-05-26",
    "observacoes": "",
    "itens": [
      {
        "id": null,
        "produto_id": 206879199,
        "tabela_preco_id": 3217041,
        "quantidade": 30.0,
        "quantidade_grades": [],
        "preco_tabela": 23.5,
        "preco_liquido": 23.5,
        "ipi": 0.0,
        "tipo_ipi": "P",
        "st": 0.0,
        "subtotal": 705.0,
        "cotacao_moeda": 1.0,
        "excluido": false,
        "descontos_do_vendedor": [],
        "descontos_de_promocoes": [],
        "descontos_de_politicas": [],
        "observacoes": "",
        "produto_codigo": "1001",
        "produto_nome": "PRODUTO 01",
        "grupo_grades": null,
        "produto_agregador_id": null,
        "desconto_de_cupom": null
      }
    ],
    "extras": [],
    "ultima_alteracao": "2026-05-26 17:01:43",
    "cliente_razao_social": "RAZAO SOCIAL DA FRANQUIA",
    "cliente_nome_fantasia": "NOME FANTASIA DA FRANQUIA",
    "cliente_cnpj": "00005115000191",
    "cliente_inscricao_estadual": "0590064258",
    "cliente_rua": "RUA",
    "cliente_numero": "7",
    "cliente_complemento": "",
    "cliente_cep": "99150000",
    "cliente_bairro": "CENTRO",
    "cliente_cidade": "MARAU",
    "cliente_estado": "RS",
    "cliente_suframa": "",
    "contato_nome": "",
    "representada_id": 495378,
    "representada_nome_fantasia": "Essenza",
    "representada_razao_social": "Essenza",
    "status_faturamento": "0",
    "status_custom_id": null,
    "status_b2b": null,
    "endereco_entrega": {
      "id": null,
      "cep": null,
      "endereco": null,
      "numero": null,
      "complemento": null,
      "bairro": null,
      "cidade": null,
      "estado": null
    },
    "data_criacao": "2026-05-26 16:17:52",
    "cliente_telefone": [],
    "cliente_email": [],
    "cupom_de_desconto": null,
    "percentual_total_comissao_pedido": 1.5,
    "comissoes_vendedores": [
      {
        "vendedor_id": 674276,
        "percentual": 1.5
      }
    ]
  }
]
```

### Mapeamento de campos

| Campo Allcance | Origem no Essenza |
|---|---|
| `cliente_id` | `franchises.external_id` |
| `criador_id` | `profiles.external_id` (do seller ou criador) |
| `numero` | Parte numérica do `orders.purchase_order` (OC-000042 -> 42) |
| `total` | `orders.total` |
| `condicao_pagamento` | `payment_plans.name` |
| `condicao_pagamento_id` | `payment_plans.external_id` |
| `forma_pagamento_id` | `payment_plans.forma_pagamento_external_id` |
| `data_emissao` | `orders.approved_at` (YYYY-MM-DD) |
| `observacoes` | `orders.notes` |
| `cliente_*` | Campos da `franchises` (cnpj sem mascara, etc.) |
| `itens[].produto_id` | `products.external_id` |
| `itens[].tabela_preco_id` | `product_prices.external_id` |
| `itens[].quantidade` | `order_items.quantity` |
| `itens[].preco_tabela` | `order_items.unit_price` |
| `itens[].produto_codigo` | `products.sku` |
| `itens[].produto_nome` | `order_items.product_name` |
| `comissoes_vendedores` | `profiles.external_id` + `profiles.comissao_percentual` |
| `representada_*` | `webhook_config.metadata` (fixo) |
```

### Headers

| Header | Valor | Descrição |
|---|---|---|
| `Content-Type` | `application/json` | Sempre JSON |
| `X-API-Key` | Valor do campo `api_key` da config | Autenticação |
| `X-Webhook-Id` | UUID do item na fila | Idempotência — usar para evitar processar duplicatas |
| `X-Webhook-Event` | `order.approved` | Tipo do evento |

---

## 3. Campos `external_id` obrigatórios

Para o webhook montar o payload corretamente, os seguintes campos devem ser preenchidos no Supabase:

| Tabela | Campo | Descrição | Exemplo |
|---|---|---|---|
| `franchises` | `external_id` | `cliente_id` na Allcance | `48330273` |
| `franchises` | `razao_social` | Razao social do cliente | `EMPRESA LTDA` |
| `franchises` | `inscricao_estadual` | IE do cliente | `0590064258` |
| `franchises` | `address_number` | Numero do endereço | `7` |
| `franchises` | `complemento` | Complemento | `Sala 2` |
| `profiles` | `external_id` | `criador_id`/`vendedor_id` na Allcance | `674276` |
| `profiles` | `comissao_percentual` | Percentual de comissao do vendedor | `1.5` |
| `products` | `external_id` | `produto_id` na Allcance | `206879199` |
| `product_prices` | `external_id` | `tabela_preco_id` na Allcance | `3217041` |
| `payment_plans` | `external_id` | `condicao_pagamento_id` na Allcance | `2675221` |
| `payment_plans` | `forma_pagamento_external_id` | `forma_pagamento_id` na Allcance | `515394` |

**Via SQL Editor:**

```sql
-- Exemplo: vincular franquia ao cliente na Allcance
UPDATE franchises SET external_id = 48330273, razao_social = 'EMPRESA LTDA', inscricao_estadual = '0590064258', address_number = '7' WHERE slug = 'essenza-marau';

-- Exemplo: vincular vendedor
UPDATE profiles SET external_id = 674276, comissao_percentual = 1.5 WHERE id = 'uuid-do-vendedor';

-- Exemplo: vincular produto
UPDATE products SET external_id = 206879199 WHERE sku = '1001';

-- Exemplo: vincular tabela de preço
UPDATE product_prices SET external_id = 3217041 WHERE product_id = 'uuid-do-produto' AND segment = 'franquia';

-- Exemplo: vincular condição de pagamento
UPDATE payment_plans SET external_id = 2675221, forma_pagamento_external_id = 515394 WHERE name = '7 DIAS';
```

---

## 4. Requisitos do sistema externo (Allcance)

O endpoint que vai receber o webhook deve:

1. Aceitar **POST** com body JSON (array com um objeto)
2. Validar o header `X-API-Key` (comparar com a chave combinada)
3. Retornar **HTTP 2xx** (200, 201, 204) para indicar sucesso
4. Qualquer resposta **fora do range 2xx** será tratada como falha e entrará em retry
5. Responder em até **30 segundos** (após isso, é considerado timeout)
6. Usar o header `X-Webhook-Id` como chave de idempotência para evitar processar o mesmo pedido duas vezes em caso de retry

---

## 5. Retry automático

Se o sistema externo falhar ou não responder, o webhook é reenviado com backoff exponencial:

| Tentativa | Intervalo após falha |
|---|---|
| 1ª | Imediata (próximo ciclo de 1 min) |
| 2ª | +2 minutos |
| 3ª | +4 minutos |
| 4ª | +8 minutos |
| 5ª | +16 minutos |

Após **5 tentativas falhadas**, o item é marcado como `failed` e não será mais reenviado automaticamente.

---

## 6. Monitoramento

### Ver fila de webhooks

No SQL Editor do Supabase:

```sql
-- Todos os webhooks pendentes ou falhados
SELECT id, status, attempts, last_error, last_status_code, next_retry_at, created_at
FROM webhook_queue
WHERE status IN ('pending', 'processing', 'failed')
ORDER BY created_at DESC;
```

### Ver últimos webhooks entregues

```sql
SELECT id, status, attempts, delivered_at, created_at
FROM webhook_queue
WHERE status = 'delivered'
ORDER BY delivered_at DESC
LIMIT 20;
```

### Reenviar um webhook que falhou

```sql
UPDATE webhook_queue
SET status = 'pending', attempts = 0, next_retry_at = now()
WHERE id = 'uuid-do-item-aqui';
```

### Reenviar todos os falhados

```sql
UPDATE webhook_queue
SET status = 'pending', attempts = 0, next_retry_at = now()
WHERE status = 'failed';
```

---

## 7. Desativar temporariamente

Para pausar o envio de webhooks sem perder a fila:

```sql
UPDATE webhook_config SET active = false WHERE name = 'orders_approved';
```

Pedidos aprovados durante a pausa **não** entram na fila. Para reativar:

```sql
UPDATE webhook_config SET active = true WHERE name = 'orders_approved';
```

---

## 8. Alterar URL ou API Key

```sql
UPDATE webhook_config
SET url = 'https://nova-url.com/webhook',
    api_key = 'nova-api-key'
WHERE name = 'orders_approved';
```

A alteração vale imediatamente para os próximos envios. Webhooks já na fila usarão a config atualizada.

---

## 9. Troubleshooting

| Problema | Causa provável | Solução |
|---|---|---|
| Webhook não dispara | `active = false` na `webhook_config` | Ativar com `UPDATE webhook_config SET active = true ...` |
| Webhook não dispara | Pedido não mudou para `aprovado` | Verificar se o status realmente mudou (não estava já aprovado) |
| Status `failed` após 5 tentativas | Sistema externo fora do ar ou rejeitando | Verificar `last_error` e `last_status_code` na `webhook_queue` |
| Timeout (30s) | Sistema externo lento | Otimizar endpoint ou aumentar timeout no `check_webhook_responses` |
| Pedido duplicado no sistema externo | Retry entregou mais de uma vez | Sistema externo deve usar `X-Webhook-Id` como chave de idempotência |
| Jobs pg_cron não rodam | pg_cron desativado | Verificar em Database → Extensions se `pg_cron` está ativo |
