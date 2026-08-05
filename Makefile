# Atalhos para separar DEV e PRODUÇÃO na mesma máquina.
#
# DEV  -> projeto `lattescnpq-dev`, portas 8002/3002, hot-reload. Isolado.
# PROD -> projeto `lattescnpq`,     portas 8001/3001, deploy público.
#
# Os alvos de dev sempre passam --env-file e os -f corretos, então um
# `make dev` nunca toca nos containers de produção.

DEV  := docker compose --env-file .env.dev -f docker-compose.yml -f docker-compose.dev.yml
PROD := docker compose -f docker-compose.yml -f docker-compose.override.yml

# Supabase self-hosted. Mora FORA deste repo, em /srv/docker/lattes-supabase,
# junto das outras stacks de infra da máquina (caddy, forgejo, ollama...) e
# versionado no repo /srv/docker. Motivo: é um serviço com estado, e este repo
# precisa ser descartável para o deploy automático poder dar `git reset --hard`.
# Só o caminho de storage sobe; ver o docker-compose.lattes.yml de lá.
SUPA_DIR := /srv/docker/lattes-supabase
SUPA := docker compose --project-directory $(SUPA_DIR) --env-file $(SUPA_DIR)/.env \
        -f $(SUPA_DIR)/docker-compose.yml -f $(SUPA_DIR)/docker-compose.lattes.yml
SUPA_SERVICES := db rest storage

.PHONY: dev dev-build dev-down dev-logs dev-ps prod-up prod-build prod-down prod-logs ps \
        supabase-up supabase-down supabase-logs supabase-ps supabase-backup

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

## --- Supabase self-hosted (storage) -----------------------------------------
supabase-up:     ## Sobe o Supabase local (só db, rest, storage e imgproxy)
	$(SUPA) up -d $(SUPA_SERVICES)
supabase-down:   ## Derruba o Supabase local (dados ficam em /srv/docker/lattes-supabase/volumes)
	$(SUPA) down
supabase-logs:   ## Logs do Supabase local
	$(SUPA) logs -f $(SUPA_SERVICES)
supabase-ps:     ## Containers do Supabase local
	$(SUPA) ps
supabase-backup: ## Backup do Supabase local (banco + arquivos)
	sh supabase/backup.sh

ps:         ## Todos os containers Compose da máquina
	docker compose ls
