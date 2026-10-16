.PHONY: up down build migrate seed test lint logs clean

# ---- Docker ----
up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-worker:
	docker compose logs -f worker

# ---- Database ----
migrate:
	docker compose exec api alembic upgrade head

migrate-create:
	docker compose exec api alembic revision --autogenerate -m "$(MSG)"

migrate-downgrade:
	docker compose exec api alembic downgrade -1

seed:
	docker compose exec api python -m scripts.seed_db

# ---- Testing ----
test:
	docker compose exec api pytest tests/ -v --cov=app --cov-report=term-missing
	cd frontend && npm run test

test-backend:
	docker compose exec api pytest tests/ -v --cov=app --cov-report=term-missing

test-frontend:
	cd frontend && npm run test

test-e2e:
	cd frontend && npx playwright test

# ---- Linting ----
lint:
	docker compose exec api ruff check app/ tests/
	docker compose exec api ruff format --check app/ tests/
	cd frontend && npm run lint

lint-fix:
	docker compose exec api ruff check --fix app/ tests/
	docker compose exec api ruff format app/ tests/
	cd frontend && npm run lint -- --fix

# ---- Utilities ----
shell-api:
	docker compose exec api bash

shell-db:
	docker compose exec postgres psql -U rekon_user -d rekonsiliasi

generate-keys:
	docker compose exec api python -m scripts.generate_keys

generate-data:
	docker compose exec api python -m scripts.generate_synthetic_data

clean:
	docker compose down -v --remove-orphans
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
