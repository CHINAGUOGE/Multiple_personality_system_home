NPM ?= npm
LAB_HOST ?= 127.0.0.1
LAB_PORT ?= 4322

.PHONY: help install dev dev-lib dev-race build build-lab preview lint lint-fix check-links check-a11y

help:
	@echo "可用目标："
	@echo "  make install     安装依赖"
	@echo "  make dev         启动主站开发服务器"
	@echo "  make dev-lib     启动 Lab 子站开发服务器"
	@echo "  make dev-race    构建并预览 Lab 子站，直接访问 /race/"
	@echo "  make build       构建主站 dist"
	@echo "  make build-lab   构建 Lab 子站 dist-lab"
	@echo "  make preview     预览主站构建结果"
	@echo "  make lint        执行代码检查"
	@echo "  make lint-fix    自动修复可修复的检查问题"
	@echo "  make check-links 检查主站构建产物链接"
	@echo "  make check-a11y  检查本地站点可访问性"

install:
	$(NPM) install

dev:
	$(NPM) run dev

dev-lib:
	$(NPM) run dev -- --config astro.config.lab.mjs

dev-race: build-lab
	@echo "Lab 预览已启动，访问首页： http://$(LAB_HOST):$(LAB_PORT)/"
	@echo "Race 直接入口： http://$(LAB_HOST):$(LAB_PORT)/race/"
	python3 -m http.server $(LAB_PORT) --bind $(LAB_HOST) --directory dist-lab

build:
	$(NPM) run build

build-lab:
	$(NPM) run build:lab

preview:
	$(NPM) run preview

lint:
	$(NPM) run lint

lint-fix:
	$(NPM) run lint:fix

check-links:
	$(NPM) run check:links

check-a11y:
	$(NPM) run check:a11y
