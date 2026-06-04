NPM ?= npm

.PHONY: help install dev dev-lib build build-lab preview lint lint-fix check-links check-a11y

help:
	@echo "可用目标："
	@echo "  make install     安装依赖"
	@echo "  make dev         启动主站开发服务器"
	@echo "  make dev-lib     启动 Lab 子站开发服务器"
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
