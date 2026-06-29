# Atalhos para separar DEV e PRODUÇÃO na mesma máquina.
#
# DEV  -> projeto `lattescnpq-dev`, portas 8002/3002, hot-reload. Isolado.
# PROD -> projeto `lattescnpq`,     portas 8001/3001, deploy público.
#
# Os alvos de dev sempre passam --env-file e os -f corretos, então um
# `make dev` nunca toca nos containers de produção.

DEV  := docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml
PROD := docker compose -f docker-compose.yml -f docker-compose.override.yml

.PHONY: dev dev-build dev-down dev-logs dev-ps prod-up prod-build prod-down prod-logs ps

## --- Desenvolvimento -------------------------------------------------------
dev:        ## Sobe o ambiente de dev (foreground)
	$(DEV) up
dev-build:  ## Rebuild das imagens e sobe o dev
	$(DEV) up --build
dev-down:   ## Derruba apenas o ambiente de dev
	$(DEV) down
dev-logs:   ## Logs do dev
	$(DEV) logs -f
dev-ps:     ## Containers do dev
	$(DEV) ps

## --- Produção (cuidado) ----------------------------------------------------
prod-up:    ## Sobe/atualiza a produção (detached)
	$(PROD) up -d
prod-build: ## Rebuild e atualiza a produção
	$(PROD) up -d --build
prod-down:  ## Derruba a produção
	$(PROD) down
prod-logs:  ## Logs da produção
	$(PROD) logs -f

ps:         ## Todos os containers Compose da máquina
	docker compose ls
