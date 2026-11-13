#!/usr/bin/env bash
#
# Shared bootstrap helpers for provider-created VPK worktrees.
#
# Provider wrappers own their stdout contracts. This file writes operational
# detail to stderr and stores short user-facing messages in
# VPK_BOOTSTRAP_MESSAGES for wrappers that need structured context.

VPK_BOOTSTRAP_MESSAGES=()
VPK_BOOTSTRAP_ENV_FILES_COPIED=()
VPK_BOOTSTRAP_DEPS_WARMED="skipped"

vpk_bootstrap_log() {
	echo "$*" >&2
}

vpk_bootstrap_add_message() {
	VPK_BOOTSTRAP_MESSAGES+=("$*")
}

vpk_bootstrap_env_basename_matches() {
	local base="$1"
	case "$base" in
		*.example)
			return 1
			;;
		.env|.env.*)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

vpk_bootstrap_is_provider_worktree_path() {
	local rel="$1"
	case "$rel" in
		.claude/worktrees/*|.rovo/worktrees/*|.codex/worktrees/*|.cursor/worktrees/*)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

vpk_bootstrap_has_project_env_file() {
	local project_dir="$1"
	local entry base

	for entry in "$project_dir"/.env "$project_dir"/.env.*; do
		[ -f "$entry" ] || continue
		base="${entry##*/}"
		case "$base" in
			*.example)
				continue
				;;
		esac
		return 0
	done

	return 1
}

# Lists ignored env files by name, NUL-separated; never reads them. The
# pathspecs keep git from listing every other ignored path, and --directory
# stops it descending into ignored directories (node_modules, .next, output,
# provider worktrees): a checkout with ~270k ignored paths answers in a fraction
# of a second instead of feeding each path through a bash loop.
vpk_bootstrap_list_ignored_env_files() {
	local source_dir="$1"
	local rel base

	while IFS= read -r -d '' rel; do
		case "$rel" in
			*/)
				continue
				;;
		esac
		vpk_bootstrap_is_provider_worktree_path "$rel" && continue
		base="${rel##*/}"
		vpk_bootstrap_env_basename_matches "$base" || continue
		printf '%s\0' "$rel"
	done < <(git -C "$source_dir" ls-files --others --ignored --exclude-standard --directory -z -- ':(glob)**/.env' ':(glob)**/.env.*' 2>/dev/null || true)
}

vpk_bootstrap_has_ignored_env_files() {
	local rel

	while IFS= read -r -d '' rel; do
		return 0
	done < <(vpk_bootstrap_list_ignored_env_files "$1")

	return 1
}

vpk_bootstrap_resolve_source_tree_path() {
	local project_dir="$1"
	local requested_source="${2:-}"
	local candidate

	if [ -n "$requested_source" ] && [ -d "$requested_source" ] && [ "$requested_source" != "$project_dir" ]; then
		printf '%s\n' "$requested_source"
		return 0
	fi

	while IFS= read -r candidate; do
		[ -n "$candidate" ] || continue
		[ "$candidate" != "$project_dir" ] || continue
		if vpk_bootstrap_has_ignored_env_files "$candidate" || [ -d "$candidate/node_modules" ]; then
			printf '%s\n' "$candidate"
			return 0
		fi
	done < <(git -C "$project_dir" worktree list --porcelain 2>/dev/null | awk '/^worktree / { print substr($0, 10) }')

	return 1
}

vpk_bootstrap_copy_ignored_env_files() {
	local source_dir="$1"
	local project_dir="$2"
	local rel source_file target_file target_parent copied_count

	copied_count=0

	while IFS= read -r -d '' rel; do
		source_file="$source_dir/$rel"
		target_file="$project_dir/$rel"
		target_parent="${target_file%/*}"

		[ -f "$source_file" ] || continue
		[ ! -f "$target_file" ] || continue

		mkdir -p "$target_parent"
		cp "$source_file" "$target_file"
		VPK_BOOTSTRAP_ENV_FILES_COPIED+=("$rel")
		copied_count=$((copied_count + 1))
	done < <(vpk_bootstrap_list_ignored_env_files "$source_dir")

	if [ "$copied_count" -gt 0 ]; then
		vpk_bootstrap_log "Copied ignored env file(s) from source worktree: ${VPK_BOOTSTRAP_ENV_FILES_COPIED[*]}"
		vpk_bootstrap_add_message "Copied ignored env file(s) from source worktree: ${VPK_BOOTSTRAP_ENV_FILES_COPIED[*]}."
	fi
}

vpk_bootstrap_find_lockfile() {
	local dir="$1"
	local lockfile

	for lockfile in pnpm-lock.yaml package-lock.json yarn.lock; do
		if [ -f "$dir/$lockfile" ]; then
			printf '%s\n' "$lockfile"
			return 0
		fi
	done

	return 1
}

vpk_bootstrap_lockfiles_match() {
	local source_dir="$1"
	local project_dir="$2"
	local lockfile

	lockfile="$(vpk_bootstrap_find_lockfile "$source_dir" || true)"
	[ -n "$lockfile" ] || return 1
	[ -f "$project_dir/$lockfile" ] || return 1

	cmp -s "$source_dir/$lockfile" "$project_dir/$lockfile"
}

vpk_bootstrap_list_top_node_modules() {
	local source_dir="$1"
	local package_path module_dir

	if [ -d "$source_dir/node_modules" ]; then
		printf '%s\n' "node_modules"
	fi

	if [ ! -f "$source_dir/pnpm-workspace.yaml" ]; then
		return 0
	fi

	while IFS= read -r package_path; do
		case "$package_path" in
			.|""|*'*'*|*'?'*|*'['*|!*|*'{'*)
				continue
				;;
		esac

		module_dir="$source_dir/$package_path/node_modules"
		if [ -d "$module_dir" ]; then
			printf '%s\n' "$package_path/node_modules"
		fi
	done < <(
		awk '
			/^packages:[[:space:]]*$/ { in_packages = 1; next }
			in_packages && /^[^[:space:]-]/ { exit }
			in_packages && /^[[:space:]]*-[[:space:]]*/ {
				line = $0
				sub(/^[[:space:]]*-[[:space:]]*/, "", line)
				sub(/[[:space:]]*(#.*)?$/, "", line)
				gsub(/^["'\'']|["'\'']$/, "", line)
				print line
			}
		' "$source_dir/pnpm-workspace.yaml"
	)
}

vpk_bootstrap_clone_node_modules() {
	local source_dir="$1"
	local project_dir="$2"
	local rel source_module target_module target_parent
	local cloned_paths=()
	local cloned_count=0

	while IFS= read -r rel; do
		[ -n "$rel" ] || continue
		source_module="$source_dir/$rel"
		target_module="$project_dir/$rel"
		target_parent="${target_module%/*}"

		[ -d "$source_module" ] || continue
		[ ! -e "$target_module" ] || continue

		mkdir -p "$target_parent"
		if cp -c -R "$source_module" "$target_module" 2>/dev/null; then
			cloned_paths+=("$target_module")
			cloned_count=$((cloned_count + 1))
		else
			if [ "$cloned_count" -gt 0 ]; then
				for target_module in "${cloned_paths[@]}"; do
					rm -rf "$target_module"
				done
			fi
			return 1
		fi
	done < <(vpk_bootstrap_list_top_node_modules "$source_dir")

	[ "$cloned_count" -gt 0 ]
}

# The completion sentinel lives in the checkout's own git dir, so a node_modules
# clone never carries the source's sentinel along and `git worktree remove`
# deletes it with the worktree. Prints nothing outside a git checkout.
vpk_bootstrap_deps_sentinel_path() {
	local git_dir

	git_dir="$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null)" || return 1
	[ -n "$git_dir" ] || return 1
	printf '%s/vpk-bootstrap-complete\n' "$git_dir"
}

vpk_bootstrap_mark_deps_complete() {
	local sentinel

	sentinel="$(vpk_bootstrap_deps_sentinel_path "$1")" || return 0
	: > "$sentinel" 2>/dev/null || true
}

# Dependencies count as ready only when the last clone or install finished: a
# node_modules left behind by a killed install has no sentinel. Outside git there
# is nowhere to keep one, so node_modules alone has to do.
vpk_bootstrap_deps_ready() {
	local project_dir="$1"
	local sentinel

	[ -f "$project_dir/package.json" ] || return 0
	[ -d "$project_dir/node_modules" ] || return 1
	sentinel="$(vpk_bootstrap_deps_sentinel_path "$project_dir")" || return 0
	[ -f "$sentinel" ]
}

vpk_bootstrap_install_dependencies() {
	local project_dir="$1"

	if [ ! -f "$project_dir/package.json" ]; then
		VPK_BOOTSTRAP_DEPS_WARMED="none"
		vpk_bootstrap_log "No package.json found; skipping dependency bootstrap."
		return 0
	fi

	vpk_bootstrap_log "Fresh worktree detected - running CI=true pnpm install --prefer-offline..."
	if (cd "$project_dir" && CI=true pnpm install --prefer-offline >&2); then
		vpk_bootstrap_mark_deps_complete "$project_dir"
		VPK_BOOTSTRAP_DEPS_WARMED="install"
		vpk_bootstrap_add_message "Bootstrapped node_modules via pnpm install."
		return 0
	fi

	VPK_BOOTSTRAP_DEPS_WARMED="failed"
	vpk_bootstrap_log "pnpm install failed during worktree bootstrap"
	vpk_bootstrap_add_message "pnpm install failed during worktree bootstrap. Re-run manually before continuing."
	return 1
}

vpk_bootstrap_warm_dependencies() {
	local project_dir="$1"
	local source_dir="${2:-}"

	if vpk_bootstrap_deps_ready "$project_dir"; then
		VPK_BOOTSTRAP_DEPS_WARMED="skipped"
		vpk_bootstrap_log "node_modules present - skipping dependency bootstrap."
		return 0
	fi

	if [ -d "$project_dir/node_modules" ]; then
		vpk_bootstrap_log "node_modules present but its last install or clone did not finish."
		vpk_bootstrap_install_dependencies "$project_dir" || true
		return 0
	fi

	if [ "${VPK_BOOTSTRAP_DISABLE_NODE_MODULES_CLONE:-0}" != "1" ] &&
		[ -n "$source_dir" ] &&
		[ -d "$source_dir" ] &&
		[ "$source_dir" != "$project_dir" ] &&
		vpk_bootstrap_lockfiles_match "$source_dir" "$project_dir"; then
		vpk_bootstrap_log "Attempting APFS clonefile warmup for node_modules..."
		if vpk_bootstrap_clone_node_modules "$source_dir" "$project_dir"; then
			vpk_bootstrap_mark_deps_complete "$project_dir"
			VPK_BOOTSTRAP_DEPS_WARMED="clone"
			vpk_bootstrap_log "Cloned node_modules from source worktree with cp -c."
			vpk_bootstrap_add_message "Bootstrapped node_modules via APFS clone."
			return 0
		fi
		vpk_bootstrap_log "APFS clonefile warmup unavailable; falling back to pnpm install."
	fi

	vpk_bootstrap_install_dependencies "$project_dir" || true
}

vpk_bootstrap_worktree() {
	local project_dir="$1"
	local requested_source="${2:-}"
	local source_dir

	VPK_BOOTSTRAP_MESSAGES=()
	VPK_BOOTSTRAP_ENV_FILES_COPIED=()
	VPK_BOOTSTRAP_DEPS_WARMED="skipped"

	project_dir="$(cd "$project_dir" && pwd -P)"

	# Every session start lands here; once env files exist and the last
	# dependency bootstrap finished there is nothing to look up or copy.
	if vpk_bootstrap_has_project_env_file "$project_dir" && vpk_bootstrap_deps_ready "$project_dir"; then
		vpk_bootstrap_log "Worktree already bootstrapped - env files and dependencies present."
		return 0
	fi

	source_dir="$(vpk_bootstrap_resolve_source_tree_path "$project_dir" "$requested_source" || true)"

	if [ -n "$source_dir" ]; then
		source_dir="$(cd "$source_dir" && pwd -P)"
		vpk_bootstrap_copy_ignored_env_files "$source_dir" "$project_dir"
	else
		vpk_bootstrap_log "No source worktree with ignored env files or node_modules found."
	fi

	if ! vpk_bootstrap_has_project_env_file "$project_dir"; then
		vpk_bootstrap_log ".env files missing in $project_dir"
		vpk_bootstrap_log "Symlink env files from the main worktree, or start from .env.local.example and fill in credentials."
		vpk_bootstrap_add_message ".env files missing - Rovo / AI Gateway flows will fail until you create them."
	fi

	vpk_bootstrap_warm_dependencies "$project_dir" "$source_dir"
}
