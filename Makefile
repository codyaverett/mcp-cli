# MCP CLI Makefile
# Self-documented Makefile for managing the MCP CLI project
# Run 'make' or 'make help' to see all available targets

# ============================================================================
# Variables
# ============================================================================

# Project metadata
PROJECT_NAME := mcp-cli
VERSION := $(shell grep '"version"' deno.json | head -1 | sed 's/.*: "\(.*\)".*/\1/')
BINARY_NAME := mcp

# Paths
SRC_DIR := src
BIN_DIR := bin
INSTALL_DIR := /usr/local/bin
CONFIG_DIR := ~/.mcp-cli

# Deno settings
DENO := deno
DENO_FLAGS := --allow-all

# Platform detection
UNAME_S := $(shell uname -s)
UNAME_M := $(shell uname -m)

# Determine platform and architecture
ifeq ($(UNAME_S),Darwin)
	PLATFORM := macos
	ifeq ($(UNAME_M),arm64)
		ARCH := arm64
		BINARY_FILE := $(BIN_DIR)/$(BINARY_NAME)-macos-arm64
		COMPILE_TARGET := aarch64-apple-darwin
	else
		ARCH := x64
		BINARY_FILE := $(BIN_DIR)/$(BINARY_NAME)-macos-x64
		COMPILE_TARGET := x86_64-apple-darwin
	endif
else ifeq ($(UNAME_S),Linux)
	PLATFORM := linux
	ARCH := x64
	BINARY_FILE := $(BIN_DIR)/$(BINARY_NAME)-linux-x64
	COMPILE_TARGET := x86_64-unknown-linux-gnu
else
	PLATFORM := windows
	ARCH := x64
	BINARY_FILE := $(BIN_DIR)/$(BINARY_NAME)-windows-x64.exe
	COMPILE_TARGET := x86_64-pc-windows-msvc
endif

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# ============================================================================
# Phony Targets
# ============================================================================

.PHONY: help build build-all install uninstall clean test test-watch test-coverage \
        lint fmt fmt-check check dev run version info release

# ============================================================================
# Default Target
# ============================================================================

.DEFAULT_GOAL := help

# ============================================================================
# Help System (Self-Documenting)
# ============================================================================

help: ## Display this help message
	@echo "$(BLUE)$(PROJECT_NAME) - Makefile Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@echo "  make $(YELLOW)<target>$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*##"; printf ""} \
		/^[a-zA-Z_-]+:.*?##/ { \
			printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2 \
		}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Project Info:$(NC)"
	@echo "  Version:      $(VERSION)"
	@echo "  Platform:     $(PLATFORM)"
	@echo "  Architecture: $(ARCH)"
	@echo "  Binary:       $(BINARY_FILE)"
	@echo ""

# ============================================================================
# Build Targets
# ============================================================================

build: ## Build binary for current platform
	@echo "$(BLUE)Building $(PROJECT_NAME) for $(PLATFORM)-$(ARCH)...$(NC)"
	@mkdir -p $(BIN_DIR)
	@$(DENO) compile $(DENO_FLAGS) --target $(COMPILE_TARGET) --output $(BINARY_FILE) $(SRC_DIR)/cli.ts
	@echo "$(GREEN)✓ Build complete: $(BINARY_FILE)$(NC)"

build-all: ## Build binaries for all platforms
	@echo "$(BLUE)Building $(PROJECT_NAME) for all platforms...$(NC)"
	@mkdir -p $(BIN_DIR)
	@$(DENO) task compile:all
	@echo "$(GREEN)✓ All builds complete$(NC)"

# ============================================================================
# Installation Targets
# ============================================================================

install: build ## Build and install binary to /usr/local/bin
	@echo "$(BLUE)Installing $(BINARY_NAME) to $(INSTALL_DIR)...$(NC)"
	@sudo cp $(BINARY_FILE) $(INSTALL_DIR)/$(BINARY_NAME)
	@sudo chmod +x $(INSTALL_DIR)/$(BINARY_NAME)
	@echo "$(GREEN)✓ Installed successfully$(NC)"
	@echo "$(GREEN)Run '$(BINARY_NAME) --version' to verify installation$(NC)"

uninstall: ## Remove installed binary from /usr/local/bin
	@echo "$(BLUE)Uninstalling $(BINARY_NAME) from $(INSTALL_DIR)...$(NC)"
	@sudo rm -f $(INSTALL_DIR)/$(BINARY_NAME)
	@echo "$(GREEN)✓ Uninstalled successfully$(NC)"

# ============================================================================
# Development Targets
# ============================================================================

dev: ## Run the CLI in development mode
	@echo "$(BLUE)Running $(PROJECT_NAME) in development mode...$(NC)"
	@$(DENO) task dev

run: ## Run the CLI with arguments (usage: make run ARGS="servers list")
	@$(DENO) run $(DENO_FLAGS) $(SRC_DIR)/cli.ts $(ARGS)

# ============================================================================
# Testing Targets
# ============================================================================

test: ## Run all tests
	@echo "$(BLUE)Running tests...$(NC)"
	@$(DENO) task test

test-watch: ## Run tests in watch mode
	@echo "$(BLUE)Running tests in watch mode...$(NC)"
	@$(DENO) task test:watch

test-coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@$(DENO) task test:coverage
	@echo "$(GREEN)✓ Coverage report generated in coverage/$(NC)"

# ============================================================================
# Code Quality Targets
# ============================================================================

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	@$(DENO) task lint
	@echo "$(GREEN)✓ Lint complete$(NC)"

fmt: ## Format code
	@echo "$(BLUE)Formatting code...$(NC)"
	@$(DENO) task fmt
	@echo "$(GREEN)✓ Format complete$(NC)"

fmt-check: ## Check code formatting without modifying files
	@echo "$(BLUE)Checking code formatting...$(NC)"
	@$(DENO) task fmt:check
	@echo "$(GREEN)✓ Format check complete$(NC)"

check: ## Type-check the codebase
	@echo "$(BLUE)Type-checking code...$(NC)"
	@$(DENO) task check
	@echo "$(GREEN)✓ Type check complete$(NC)"

# ============================================================================
# Quality Assurance (Combined)
# ============================================================================

qa: fmt-check lint check test ## Run all quality checks (format, lint, type-check, test)
	@echo "$(GREEN)✓ All quality checks passed$(NC)"

# ============================================================================
# Cleanup Targets
# ============================================================================

clean: ## Remove compiled binaries and coverage reports
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf $(BIN_DIR)
	@rm -rf coverage
	@echo "$(GREEN)✓ Clean complete$(NC)"

clean-all: clean ## Remove all generated files including config
	@echo "$(BLUE)Cleaning all generated files...$(NC)"
	@rm -rf $(CONFIG_DIR)
	@echo "$(GREEN)✓ Deep clean complete$(NC)"

# ============================================================================
# Release Management
# ============================================================================

version: ## Display current version
	@echo "$(GREEN)$(PROJECT_NAME) version: $(VERSION)$(NC)"

info: ## Display project information
	@echo "$(BLUE)Project Information$(NC)"
	@echo "  Name:         $(PROJECT_NAME)"
	@echo "  Version:      $(VERSION)"
	@echo "  Platform:     $(PLATFORM)"
	@echo "  Architecture: $(ARCH)"
	@echo "  Deno:         $(shell $(DENO) --version | head -n 1)"
	@echo "  Binary:       $(BINARY_FILE)"
	@echo "  Install Dir:  $(INSTALL_DIR)"
	@echo ""

release: qa build-all ## Prepare a release (QA + build all platforms)
	@echo "$(GREEN)✓ Release build complete for version $(VERSION)$(NC)"
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  1. Review binaries in $(BIN_DIR)/"
	@echo "  2. Update CHANGELOG.md"
	@echo "  3. Create git tag: git tag -a v$(VERSION) -m 'Release v$(VERSION)'"
	@echo "  4. Push tag: git push origin v$(VERSION)"
	@echo "  5. Publish to JSR: deno publish"
	@echo ""

# ============================================================================
# Utility Targets
# ============================================================================

verify-install: ## Verify the installed binary works
	@echo "$(BLUE)Verifying installation...$(NC)"
	@if command -v $(BINARY_NAME) >/dev/null 2>&1; then \
		echo "$(GREEN)✓ $(BINARY_NAME) is installed$(NC)"; \
		$(BINARY_NAME) --version; \
	else \
		echo "$(RED)✗ $(BINARY_NAME) is not installed$(NC)"; \
		exit 1; \
	fi

benchmark: ## Run CLI benchmark (if available)
	@echo "$(BLUE)Running benchmarks...$(NC)"
	@$(DENO) bench $(DENO_FLAGS) || echo "$(YELLOW)No benchmarks found$(NC)"
