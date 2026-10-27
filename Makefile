# MyMBG monorepo targets.
# First time on this machine? Run:  make setup
SHELL := /bin/bash
STACK ?= mymbg

BACKEND_IMAGE ?= mymbg-backend:local
WEB_IMAGE     ?= mymbg-web:local
POSTGRES_IMAGE?= mymbg-postgres:local

.PHONY: help setup build deploy rebuild status ps logs-web logs-backend logs-db stop clean

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; printf "Targets:\n"} /^[a-zA-Z_-]+:.*?##/ {printf "  \033[1;36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\nFirst run:  make setup\n"

setup: ## Interactive first-run wizard (Swarm, secret, .env, build, deploy)
	./scripts/setup.sh

build: ## Build all three images
	docker build --pull --tag $(BACKEND_IMAGE)  --file apps/backend/Dockerfile apps/backend
	docker build --pull $(if $(NEXT_PUBLIC_API_URL),--build-arg NEXT_PUBLIC_API_URL=$(NEXT_PUBLIC_API_URL),) \
		--tag $(WEB_IMAGE) --file apps/web/Dockerfile apps/web
	docker build --pull --tag $(POSTGRES_IMAGE) --file deploy/postgres.Dockerfile .

deploy: ## Load .env and deploy the stack to Swarm
	@set -a; . ./.env; set +a; \
	docker stack deploy --compose-file docker-stack.yml $(STACK)

rebuild: build deploy ## Build all images then deploy

status: ## Service + task status
	@docker stack services $(STACK) && docker stack ps --no-trunc $(STACK) | head -n 15

ps: status

logs-web: ## Follow web logs
	docker service logs -f $(STACK)_web

logs-backend: ## Follow backend logs
	docker service logs -f $(STACK)_backend

logs-db: ## Follow database logs
	docker service logs -f $(STACK)_db

stop: ## Remove the stack (keeps the postgres volume)
	-docker stack rm $(STACK)

clean: ## Remove the stack and DELETE the postgres volume
	-docker stack rm $(STACK)
	-docker volume rm $$(docker volume ls -q | grep '^$(STACK)_postgres_data') || true
