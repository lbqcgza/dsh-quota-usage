/**
 * dsh-quota-usage — browser half.
 *
 * Adds one additive entry to the sidebar's `sidebar.footer.action` list seat.
 * The sidebar renders that seat inside its foot, directly ABOVE
 * `sidebar.settings` — the seat that holds the account launcher row (avatar +
 * user name). Because both seats live in the root-scoped sidebar foot, the
 * widget is present on every page of the app, not per panel or per session.
 *
 * The number comes from the shipped account Remote namespace
 * (`ctx.remote.account.getBalance`), the same source the Account settings page
 * reads: recharge wallets plus bonus wallets. Nothing is cached to disk and no
 * credential ever reaches this bundle.
 */
window.__ModuleLoader__.load({
	id: "dsh-quota-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		//#region styles
		const css =
			// Shared metrics: the amount gives up exactly the spinner's box plus one
			// row gap while the indicator is up, and the ease is intentionally
			// non-linear so the slide starts quickly and settles gently.
			".dshQuota_row,.dshQuota_rowRail{--dsh-quota-gap:8px;--dsh-quota-spinner:14px;--dsh-quota-ease:cubic-bezier(0.22,0.61,0.36,1);--dsh-quota-slide:260ms}" +
			".dshQuota_row{position:relative;flex:1 1 auto;box-sizing:border-box;min-width:0;min-height:42px;margin:8px 0 0;padding:5px 10px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:12px;flex-direction:column;justify-content:center;gap:1px;font-family:inherit;font-size:12px;line-height:16px;text-align:left;display:flex;overflow:hidden}" +
			".dshQuota_row:hover,.dshQuota_row:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}" +
			// The credit line. The spinner is anchored here rather than to the row so
			// it stays centred on the amount once the usage sub-title adds a line.
			".dshQuota_main{position:relative;min-width:0;min-height:20px;align-items:center;gap:var(--dsh-quota-gap);display:flex}" +
			".dshQuota_usage{min-width:0;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;font-variant-numeric:tabular-nums;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}" +
			".dshQuota_label{flex:none;text-overflow:ellipsis;white-space:nowrap;overflow:hidden}" +
			// The amount is pinned right by its own auto margin, so an idle row keeps
			// the number flush to the row's edge instead of reserving spinner space.
			".dshQuota_amount{flex:none;min-width:0;margin-left:auto;align-items:center;gap:var(--dsh-quota-gap);display:inline-flex;transition:transform var(--dsh-quota-slide) var(--dsh-quota-ease)}" +
			".dshQuota_row[data-refreshing=true] .dshQuota_amount{transform:translateX(calc(-1 * (var(--dsh-quota-spinner) + var(--dsh-quota-gap))))}" +
			".dshQuota_value{flex:none;color:var(--dsw-alias-label-primary);font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}" +
			".dshQuota_bonus{flex:none;color:var(--dsw-alias-label-primary);font-size:11px;font-variant-numeric:tabular-nums;white-space:nowrap}" +
			".dshQuota_row[data-phase=loading] .dshQuota_value,.dshQuota_row[data-phase=failed] .dshQuota_value{color:var(--dsw-alias-label-tertiary);font-size:12px}" +
			// Only transform and opacity animate here, so the reveal runs on the
			// compositor and never reflows the row mid-slide.
			".dshQuota_spinner{position:absolute;top:50%;right:0;width:var(--dsh-quota-spinner);height:var(--dsh-quota-spinner);margin-top:calc(var(--dsh-quota-spinner) / -2);align-items:center;justify-content:center;display:inline-flex;opacity:0;transform:scale(.6);pointer-events:none;transition:opacity 160ms var(--dsh-quota-ease),transform var(--dsh-quota-slide) var(--dsh-quota-ease)}" +
			".dshQuota_row[data-refreshing=true] .dshQuota_spinner{opacity:1;transform:scale(1)}" +
			".dshQuota_rowRail{position:relative;box-sizing:border-box;width:36px;height:36px;margin:0;padding:0;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;font-family:inherit;font-size:11px;font-variant-numeric:tabular-nums;display:inline-flex;overflow:hidden}" +
			".dshQuota_rowRail:hover,.dshQuota_rowRail:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}" +
			".dshQuota_ring{flex:none;display:block}" +
			".dshQuota_ringTrack{stroke:var(--dsw-alias-border-l2)}" +
			".dshQuota_ringArc{stroke:var(--dsw-alias-label-secondary)}" +
			".dshQuota_ringOverlay{position:absolute;inset:1px;pointer-events:none;opacity:0;transform:scale(.6);transition:opacity 160ms var(--dsh-quota-ease),transform var(--dsh-quota-slide) var(--dsh-quota-ease)}" +
			".dshQuota_rowRail[data-refreshing=true] .dshQuota_ringOverlay{opacity:1;transform:scale(1)}" +
			// The Settings → General row. That slot passes no props and projects no
			// label, so this draws its own title, hint, and control.
			".dshQuota_pref{box-sizing:border-box;width:100%;min-width:0;align-items:center;gap:16px;padding:10px 0;display:flex;justify-content:space-between}" +
			".dshQuota_prefText{min-width:0}" +
			".dshQuota_prefTitle{color:var(--dsw-alias-label-primary);font-size:13px;line-height:20px}" +
			".dshQuota_prefHint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}" +
			".dshQuota_switch{position:relative;flex:none;width:36px;height:20px;cursor:pointer}" +
			".dshQuota_switchInput{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}" +
			".dshQuota_switchTrack{position:absolute;inset:0;border-radius:10px;background:var(--dsw-alias-border-l2);pointer-events:none;transition:background 160ms cubic-bezier(0.22,0.61,0.36,1)}" +
			".dshQuota_switchInput:checked ~ .dshQuota_switchTrack{background:var(--dsw-alias-brand-primary)}" +
			".dshQuota_switchInput:focus-visible ~ .dshQuota_switchTrack{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}" +
			".dshQuota_switchKnob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;pointer-events:none;transition:transform 160ms cubic-bezier(0.22,0.61,0.36,1)}" +
			".dshQuota_switchInput:checked ~ .dshQuota_switchKnob{transform:translateX(16px)}" +
			// The spin runs only while the indicator is up; an idle ring is static.
			".dshQuota_row[data-refreshing=true] .dshQuota_ringSpin,.dshQuota_rowRail[data-refreshing=true] .dshQuota_ringSpin{animation:dshQuota_spin 1s linear infinite}" +
			".dshQuota_railValue{position:relative;z-index:1}" +
			"@keyframes dshQuota_spin{to{transform:rotate(360deg)}}" +
			"@media (prefers-reduced-motion:reduce){.dshQuota_ringSpin{animation:none}.dshQuota_amount,.dshQuota_spinner,.dshQuota_ringOverlay{transition:none}}";
		const tagId = "dsh-quota-usage/quota.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-quota-usage";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		const classNames = {
			row: "dshQuota_row",
			rowRail: "dshQuota_rowRail",
			label: "dshQuota_label",
			main: "dshQuota_main",
			usage: "dshQuota_usage",
			pref: "dshQuota_pref",
			prefText: "dshQuota_prefText",
			prefTitle: "dshQuota_prefTitle",
			prefHint: "dshQuota_prefHint",
			switch: "dshQuota_switch",
			switchInput: "dshQuota_switchInput",
			switchTrack: "dshQuota_switchTrack",
			switchKnob: "dshQuota_switchKnob",
			amount: "dshQuota_amount",
			value: "dshQuota_value",
			bonus: "dshQuota_bonus",
			spinner: "dshQuota_spinner",
			ring: "dshQuota_ring",
			ringOverlay: "dshQuota_ringOverlay",
			railValue: "dshQuota_railValue"
		};
		//#endregion

		//#region locales
		/** Dictionary namespace owned by this plugin. */
		const NS = "quota.usage";
		/** Simplified Chinese copy (the key-set source of truth). */
		const zh = {
			label: "额度",
			loading: "读取中…",
			failed: "读取失败",
			unavailable: "未连接",
			signedOut: "未登录",
			titleLoading: "正在读取账号额度…",
			titleFailed: "额度读取失败，点击重试",
			titleUnavailable: "页面还没拿到账号接口，正在重试",
			titleSignedOut: "未登录 DeepSeek 账号",
			titleTotal: "总余额",
			titleRecharge: "充值余额",
			titleBonus: "赠金余额",
			titleUpdated: "更新于",
			titleInterval: "每 {seconds} 秒自动刷新",
			titleRefreshing: "正在刷新…",
			titleRefresh: "点击立即刷新",
			usageLabel: "本会话用量",
			usageLine: "约 {cost}",
			titleUsage: "本会话用量",
			titleEstimate: "估算",
			prefTitle: "额度用量副标题",
			prefHint: "在额度下方显示当前会话用量的估算金额",
			titleUsageNote: "token 取自会话日志；金额按官方价目表推算，不是账单金额（空闲/高峰两档价差 2 倍，历史 token 无法逐条还原时段）",
			bonusSuffix: "（赠{amount}）"
		};
		/** English copy, checked complete against the zh key set. */
		const en = {
			label: "Credit",
			loading: "Loading…",
			failed: "Unavailable",
			unavailable: "Not connected",
			signedOut: "Signed out",
			titleLoading: "Reading account credit…",
			titleFailed: "Could not read the balance; click to retry",
			titleUnavailable: "The page has no account interface yet; retrying",
			titleSignedOut: "No DeepSeek account is signed in",
			titleTotal: "Total credit",
			titleRecharge: "Recharge balance",
			titleBonus: "Bonus balance",
			titleUpdated: "Updated",
			titleInterval: "Auto refresh every {seconds}s",
			titleRefreshing: "Refreshing…",
			titleRefresh: "Click to refresh now",
			usageLabel: "Session usage",
			usageLine: "≈{cost}",
			titleUsage: "Session usage",
			titleEstimate: "estimate",
			prefTitle: "Credit usage sub-title",
			prefHint: "Show the current session's estimated usage under the credit",
			titleUsageNote: "Tokens come from the session log; the amount is derived from the official price list, not billed (off-peak and peak differ 2x, and historical tokens carry no time-of-day record)",
			bonusSuffix: " (bonus {amount})"
		};
		/** Which dictionary key names each non-ready phase. */
		const PHASE_TEXT = {
			loading: "loading",
			failed: "failed",
			unavailable: "unavailable",
			"signed-out": "signedOut"
		};
		//#endregion

		//#region formatting
		/**
		* The UI build identity the account Remote methods carry. It only labels the
		* requesting client on Platform's side, so it mirrors the version the shipped
		* Account surfaces report for this DSH release.
		*/
		const CLIENT_VERSION = "0.2.0-rc.2";
		/** Fraction of the spinner ring the arc covers while a manual read runs. */
		const SPIN_ARC = 0.25;
		/**
		* The smallest amount that earns its own cell.
		*
		* Below one cent the formatter prints `<0.01`, which reads as noise rather
		* than as a balance — so a bonus that was never granted, or one drained to a
		* sub-cent remainder, hides its whole bracket instead of showing that.
		* The same threshold keeps the tooltip from listing an empty bonus row.
		*/
		const MIN_VISIBLE_AMOUNT = 0.01;
		/** How often the balance is re-read while the page stays open. */
		const REFRESH_MS = 60_000;
		/** Platform currency symbols this surface renders. */
		const CURRENCY_SYMBOL = { CNY: "¥", USD: "$" };
		/**
		* Official DeepSeek price list, CNY per million tokens, as published at
		* <https://api-docs.deepseek.com/zh-cn/quick_start/pricing> and read on
		* 2026-10-03. Off-peak is exactly half of peak; peak hours are Beijing time
		* Mon-Fri 09:00-12:00 and 14:00-18:00 excluding public holidays, and every
		* other hour is off-peak.
		*
		* Prices change: this table is the only thing to edit when they do.
		*/
		const PRICE_CNY_PER_MILLION = {
			"deepseek-flash": {
				offPeak: { inputMiss: 1, inputHit: 0.02, output: 4 },
				peak: { inputMiss: 2, inputHit: 0.04, output: 8 }
			},
			"deepseek-v4-pro": {
				offPeak: { inputMiss: 4.5, inputHit: 0.15, output: 13.5 },
				peak: { inputMiss: 9, inputHit: 0.3, output: 27 }
			}
		};
		/**
		* The model a session's tokens are priced as when nothing names one.
		*
		* The persisted `tokenUsage` projection carries counts only — no model, no
		* per-request timeline — so a mixed-model session cannot be priced exactly.
		* Flash is DSH's default here, and it is also the cheaper of the two.
		*/
		const PRICED_MODEL = "deepseek-flash";
		/**
		* The one browser-storage key this plugin owns: whether the usage sub-title
		* is drawn. It is a display preference, so it lives with the display and
		* never leaves the machine.
		*/
		const USAGE_PREFERENCE_KEY = "dsh-quota-usage:show-usage";
		/**
		* Read the usage sub-title preference.
		* @returns true when the sub-title should be drawn; true when storage is unavailable.
		*/
		function readUsagePreference() {
			try {
				return window.localStorage.getItem(USAGE_PREFERENCE_KEY) !== "0";
			} catch {
				return true;
			}
		}
		/**
		* Persist the usage sub-title preference.
		* @param show - the new value.
		*/
		function writeUsagePreference(show) {
			try {
				window.localStorage.setItem(USAGE_PREFERENCE_KEY, show ? "1" : "0");
			} catch {}
		}
		/** Platform Web amount formatting: two decimals with digit grouping. */
		const amountFormat = new Intl.NumberFormat(undefined, {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		});
		/**
		* Round one Platform amount for display, following the Platform Web rules:
		* a positive sub-cent amount shows as `<0.01`, and a nonzero magnitude never
		* renders as `0.00`.
		* @param value - the parsed Platform amount.
		* @returns the localized digits, or the `<0.01` marker.
		*/
		function formatDigits(value) {
			if (value > 0) {
				if (value < 0.01) return "<0.01";
				return amountFormat.format(Math.floor(value * 100) / 100);
			}
			if (value < 0) return amountFormat.format(-Math.round(Math.max(Math.abs(value), 0.01) * 100) / 100);
			return amountFormat.format(0);
		}
		/**
		* Render one currency amount with its symbol.
		* @param value - the amount in `currency`.
		* @param currency - the Platform wallet currency.
		* @returns the display string.
		*/
		function formatAmount(value, currency) {
			const digits = formatDigits(value);
			const symbol = CURRENCY_SYMBOL[currency] ?? "";
			return digits.startsWith("<") ? "<" + symbol + digits.slice(1) : symbol + digits;
		}
		/** Parse one Platform wallet amount without manufacturing a zero. */
		function walletValue(wallet) {
			const value = Number(wallet?.balance);
			return Number.isFinite(value) ? value : 0;
		}
		/** Sum the wallets of one currency. */
		function sumWallets(wallets, currency) {
			return wallets.reduce((total, wallet) => total + (wallet?.currency === currency ? walletValue(wallet) : 0), 0);
		}
		/**
		* Reduce the Remote payload to one currency's recharge, bonus and total.
		*
		* Platform's `get_user_summary` splits the wallet into `normal_wallets`
		* (充值余额, labelled "balance" by the Account page) and `bonus_wallets`
		* (赠金余额, labelled "bonusBalance"). The credit the user can actually spend
		* is their sum, so that is what the widget leads with.
		* @param wallets - Platform recharge wallets.
		* @param bonusWallets - Platform bonus wallets.
		* @returns the display amounts, or undefined when neither list carries a wallet.
		*/
		function summarize(wallets, bonusWallets) {
			const all = [...wallets, ...bonusWallets];
			if (all.length === 0) return undefined;
			const currency = (all.find((wallet) => wallet?.currency === "CNY") ?? all[0]).currency;
			const recharge = sumWallets(wallets, currency);
			const bonus = sumWallets(bonusWallets, currency);
			return {
				currency,
				recharge,
				bonus,
				total: recharge + bonus
			};
		}
		/**
		* Drop trailing zeros from a fixed-precision number.
		* @param value - the number to render.
		* @param digits - how many fraction digits it was rendered with.
		* @returns the trimmed string.
		*/
		function trimZeros(value, digits) {
			return value.toFixed(digits).replace(/\.?0+$/, "");
		}
		/**
		* Render a token count compactly.
		*
		* The unit is fixed ASCII rather than `Intl` compact notation so the string
		* is identical in every locale — which also makes it assertable.
		* @param value - the token count.
		* @returns e.g. `842`, `12.8k`, `1.28M`.
		*/
		function formatTokens(value) {
			if (!Number.isFinite(value) || value <= 0) return "0";
			if (value < 1e3) return String(Math.round(value));
			if (value < 1e6) return trimZeros(value / 1e3, value < 1e4 ? 1 : 0) + "k";
			return trimZeros(value / 1e6, value < 1e7 ? 2 : 1) + "M";
		}
		/**
		* Total billed tokens for one session.
		*
		* The prompt side is the three disjoint buckets DSH itself groups as
		* `billedInputTokens` (uncached, cache-read, cache-write); the output side is
		* one bucket.
		* @param usage - the `tokenUsage` projection value.
		* @returns the token count.
		*/
		function billedTokens(usage) {
			return (usage?.uncachedInputTokens ?? 0) + (usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0) + (usage?.outputTokens ?? 0);
		}
		/**
		* Estimate one session's spend in CNY from its token buckets.
		*
		* Two caveats belong to the data, not to this arithmetic, and both are why
		* the caller presents the result as an estimate rather than a figure:
		*
		* - The `tokenUsage` projection carries no per-request timeline, so a session's
		*   tokens cannot be split between peak and off-peak hours after the fact.
		*   Both bands are computed and shown as a pair.
		* - The official list has no cache-write column, so cache writes are billed at
		*   the cache-miss input rate — the same prompt-side grouping DSH uses.
		* @param usage - the `tokenUsage` projection value.
		* @returns the off-peak and peak estimates, in CNY.
		*/
		function estimateCost(usage) {
			const price = PRICE_CNY_PER_MILLION[PRICED_MODEL];
			const missInput = (usage?.uncachedInputTokens ?? 0) + (usage?.cacheWriteTokens ?? 0);
			const hitInput = usage?.cacheReadTokens ?? 0;
			const output = usage?.outputTokens ?? 0;
			const band = (rates) => (missInput * rates.inputMiss + hitInput * rates.inputHit + output * rates.output) / 1e6;
			return { offPeak: band(price.offPeak), peak: band(price.peak) };
		}
		/**
		* Render one estimated amount to cents.
		*
		* Unlike {@link formatDigits}, which truncates a Platform balance the way
		* Platform Web does, an estimate is rounded: it is this plugin's own
		* arithmetic, and truncating it would print an exact 5.10 as 5.09 purely
		* because the nearest double to 5.1 sits just below it.
		* @param value - the estimated amount in CNY.
		* @returns the digits, or the `<0.01` marker.
		*/
		function formatEstimate(value) {
			if (!(value > 0)) return amountFormat.format(0);
			if (value < 0.005) return "<0.01";
			return amountFormat.format(Math.round(value * 100) / 100);
		}
		/**
		* Render an estimate as one CNY range.
		* @param cost - the result of {@link estimateCost}.
		* @returns e.g. `¥1.20–2.40`, or `¥<0.01` when even the peak band is sub-cent.
		*/
		function formatCostRange(cost) {
			const symbol = CURRENCY_SYMBOL.CNY;
			const high = formatEstimate(cost.peak);
			if (high === "<0.01") return symbol + "<0.01";
			return symbol + formatEstimate(cost.offPeak) + "–" + high;
		}
		//#endregion

		//#region store
		/**
		* Build the account balance reader the widget subscribes to.
		*
		* The store owns one Remote read at a time, a periodic re-read, a
		* visibility/focus re-read, and the account state stream so a login or
		* sign-out refreshes the number. It never throws into React.
		* @param ctx - the browser plugin context.
		* @returns the snapshot source and its lifecycle operations.
		*/
		function createBalanceStore(ctx) {
			let snapshot = {
				phase: "loading",
				amount: undefined,
				updatedAt: 0,
				// True only while a read the user asked for is in flight: the refresh
				// indicator follows this and nothing else, so background polling and
				// the initial load never show it.
				userRefreshing: false,
				// The poll cadence currently armed, for the tooltip's static hint.
				intervalMs: 0,
				// What the session-scoped bridge last reported: the active session's
				// id and its `tokenUsage` buckets. Root-scoped seats cannot read
				// projections, so this is the only way the foot row learns them.
				sessionUsage: undefined,
				// The usage sub-title display preference, seeded from local storage.
				showUsage: readUsagePreference()
			};
			const listeners = new Set();
			let inflight;
			let timer;
			let stream;
			let disposed = false;
			/** False until the first successful read; the namespace may mount after this plugin. */
			let settled = false;
			/** Fast cadence while the account namespace has not answered yet. */
			const RETRY_MS = 5e3;

			const publish = (next) => {
				snapshot = next;
				for (const listener of [...listeners]) listener();
			};
			/**
			* Resolve the account Remote namespace.
			*
			* The API gateway registers every Remote namespace as its own Cordis
			* service under the dotted key `remote.<namespace>`
			* (`RemoteNamespaceService` extends `Service` with that key), so
			* `ctx.get("remote.account")` is the canonical lookup. The nested
			* `ctx.remote.account` property is only a convenience accessor and may
			* not be materialized on a context that never injected the dotted key.
			* @returns the namespace service, or undefined while it is unmounted.
			*/
			const account = () => {
				try {
					const registered = typeof ctx.get === "function" ? ctx.get("remote.account") : undefined;
					if (registered !== undefined) return registered;
				} catch {}
				try {
					const nested = ctx.remote?.account;
					if (nested !== undefined) return nested;
				} catch {}
				try {
					return ctx["remote.account"];
				} catch {
					return undefined;
				}
			};
			/** The per-request identity the account Remote methods require. */
			const metadata = () => ({
				version: CLIENT_VERSION,
				locale: ctx.locale.getSnapshot().active,
				timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60
			});
			const settle = (result) => {
				if (disposed) return;
				const value = result !== undefined && result.ok === true ? result.value : undefined;
				if (value === null) {
					publish({ ...snapshot, phase: "signed-out", amount: undefined, updatedAt: Date.now(), userRefreshing: false, stale: false });
					return;
				}
				if (value === undefined || value.status !== "ready") {
					publish(snapshot.amount === undefined
						? { ...snapshot, phase: "failed", amount: undefined, updatedAt: Date.now(), userRefreshing: false }
						: { ...snapshot, phase: "ready", userRefreshing: false, stale: true });
					return;
				}
				publish({
					...snapshot,
					phase: "ready",
					amount: summarize(value.value ?? [], value.bonusWallets ?? []),
					updatedAt: Date.now(),
					userRefreshing: false,
					stale: false
				});
				settled = true;
				schedule();
			};
			/**
			* Read the balance once.
			* @param userInitiated - true only from the widget's click handler, which
			*   is the one call that shows the refresh indicator while it runs.
			* @returns the in-flight read, shared with any concurrent caller.
			*/
			const refresh = (userInitiated) => {
				if (disposed) return Promise.resolve();
				const requested = userInitiated === true;
				if (inflight !== undefined) {
					// The read already running answers this call too; a click still
					// gets its indicator for whatever is left of that read.
					if (requested && !snapshot.userRefreshing) publish({ ...snapshot, userRefreshing: true });
					return inflight;
				}
				if (requested !== snapshot.userRefreshing) publish({ ...snapshot, userRefreshing: requested });
				const api = account();
				if (api === undefined || typeof api.getBalance !== "function") {
					publish({ ...snapshot, phase: "unavailable", amount: undefined, updatedAt: 0, userRefreshing: false });
					return Promise.resolve();
				}
				let request;
				try {
					request = api.getBalance(metadata());
				} catch {
					request = Promise.reject(new Error("dsh-quota-usage: account metadata unavailable"));
				}
				inflight = Promise.resolve(request).then(settle, () => settle(undefined)).finally(() => {
					inflight = undefined;
				});
				return inflight;
			};
			/**
			* Re-arm the poll at the cadence the current confidence deserves, and
			* publish the cadence the tooltip reports.
			*/
			const schedule = () => {
				if (timer !== undefined) clearInterval(timer);
				const intervalMs = settled ? REFRESH_MS : RETRY_MS;
				timer = setInterval(refresh, intervalMs);
				publish({ ...snapshot, intervalMs });
			};
			const onVisibility = () => {
				if (document.visibilityState === "visible") refresh();
			};
			const watchAccount = () => {
				const remote = ctx.remote;
				if (remote === undefined || typeof remote.$stream !== "function") return;
				const api = account();
				if (api === undefined || typeof api.watch !== "function") return;
				stream = remote.$stream({
					name: "account",
					open: (signal) => api.watch(signal),
					ended: () => new Error("account stream ended")
				});
				(async () => {
					try {
						for await (const frame of stream) {
							if (disposed) return;
							if (typeof frame?.accept === "function") frame.accept();
							refresh();
						}
					} catch {}
				})();
			};
			return {
				getSnapshot: () => snapshot,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				start: () => {
					refresh();
					try {
						schedule();
						document.addEventListener("visibilitychange", onVisibility);
						window.addEventListener("focus", refresh);
						ctx.on("connection/reset", refresh);
						watchAccount();
					} catch {}
				},
				refresh,
				/** Force one read and show the indicator for as long as it runs. */
				refreshNow: () => refresh(true),
				/**
				* Take the token buckets the session bridge just read.
				*
				* Called from the bridge's effect on every projection change, so an
				* unchanged report must not republish: that would re-render the foot row
				* for nothing. The comparison is by value because the projection hands
				* back a fresh object each time.
				* @param sessionId - the session the buckets belong to.
				* @param usage - the `tokenUsage` projection value, or undefined.
				*/
				reportSessionUsage: (sessionId, usage) => {
					if (disposed) return;
					const next = usage === undefined ? undefined : {
						sessionId,
						uncachedInputTokens: usage.uncachedInputTokens ?? 0,
						cacheReadTokens: usage.cacheReadTokens ?? 0,
						cacheWriteTokens: usage.cacheWriteTokens ?? 0,
						outputTokens: usage.outputTokens ?? 0
					};
					const current = snapshot.sessionUsage;
					const same = next === undefined
						? current === undefined
						: current !== undefined
							&& current.sessionId === next.sessionId
							&& current.uncachedInputTokens === next.uncachedInputTokens
							&& current.cacheReadTokens === next.cacheReadTokens
							&& current.cacheWriteTokens === next.cacheWriteTokens
							&& current.outputTokens === next.outputTokens;
					if (same) return;
					publish({ ...snapshot, sessionUsage: next });
				},
				/**
				* Turn the usage sub-title on or off, and remember the choice.
				* @param show - the new value.
				*/
				setShowUsage: (show) => {
					if (disposed) return;
					const next = show === true;
					if (next === snapshot.showUsage) return;
					writeUsagePreference(next);
					publish({ ...snapshot, showUsage: next });
				},
				dispose: () => {
					disposed = true;
					if (timer !== undefined) clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisibility);
					window.removeEventListener("focus", refresh);
					try {
						stream?.dispose?.();
					} catch {}
					listeners.clear();
				}
			};
		}
		//#endregion

		//#region component
		/**
		* Build the circular refresh spinner.
		*
		* It is shown only while a read the user asked for is in flight, so the arc
		* simply holds {@link SPIN_ARC} of the ring and the whole element rotates.
		* @param size - the square edge in px.
		* @param stroke - the arc thickness in px.
		* @param className - an extra class for the ring (used by the rail overlay).
		* @returns the SVG element.
		*/
		function ringElement(size, stroke, className) {
			const radius = (size - stroke) / 2;
			const circumference = 2 * Math.PI * radius;
			const spinClass = className === undefined ? classNames.ring : className + " " + classNames.ring;
			return React.createElement("svg", {
				className: spinClass + " dshQuota_ringSpin",
				viewBox: "0 0 " + size + " " + size,
				width: size,
				height: size,
				"aria-hidden": "true",
				focusable: "false"
			}, React.createElement("circle", {
				className: "dshQuota_ringTrack",
				cx: size / 2,
				cy: size / 2,
				r: radius,
				fill: "none",
				strokeWidth: stroke
			}), React.createElement("circle", {
				className: "dshQuota_ringArc",
				cx: size / 2,
				cy: size / 2,
				r: radius,
				fill: "none",
				strokeWidth: stroke,
				strokeLinecap: "round",
				strokeDasharray: circumference,
				strokeDashoffset: circumference * (1 - SPIN_ARC),
				transform: "rotate(-90 " + size / 2 + " " + size / 2 + ")"
			}));
		}
		/**
		* Build the tooltip and accessible name for one snapshot.
		* @param state - the current balance snapshot.
		* @param t - this page's locale reader.
		* @returns the composed description.
		*/
		function describe(state, t) {
			if (state.phase === "loading") return t("titleLoading");
			if (state.phase === "failed") return t("titleFailed");
			if (state.phase === "unavailable") return t("titleUnavailable");
			if (state.phase === "signed-out") return t("titleSignedOut");
			const parts = [];
			if (state.amount !== undefined) {
				parts.push(t("titleTotal") + " " + formatAmount(state.amount.total, state.amount.currency));
				parts.push(t("titleRecharge") + " " + formatAmount(state.amount.recharge, state.amount.currency));
				if (state.amount.bonus >= MIN_VISIBLE_AMOUNT) parts.push(t("titleBonus") + " " + formatAmount(state.amount.bonus, state.amount.currency));
				if (state.updatedAt > 0) {
					parts.push(t("titleUpdated") + " " + new Date(state.updatedAt).toLocaleTimeString(undefined, {
						hour: "2-digit",
						minute: "2-digit"
					}));
				}
			}
			if (state.userRefreshing) parts.push(t("titleRefreshing"));
			else if (state.intervalMs > 0) parts.push(t("titleInterval", { seconds: Math.round(state.intervalMs / 1000) }));
			// The sub-title shows the money alone, so the exact token count and the
			// estimate caveat both live here instead.
			const usageTokens = state.sessionUsage === undefined ? 0 : billedTokens(state.sessionUsage);
			if (state.showUsage === true && usageTokens > 0) {
				parts.push(t("titleUsage") + " " + formatTokens(usageTokens) + " tokens · " + t("titleEstimate") + " " + formatCostRange(estimateCost(state.sessionUsage)));
				parts.push(t("titleUsageNote"));
			}
			parts.push(t("titleRefresh"));
			return parts.join(" · ");
		}
		/**
		* The sidebar-foot widget: a credit readout that sits above the account row.
		*
		* Every phase renders something: a readout that silently disappears because
		* the account namespace has not answered yet is indistinguishable from a
		* broken plugin, so the row always names its state. The amount is pinned to
		* the row's right edge and gives up exactly the spinner's box while a
		* user-initiated read runs, so the row never reserves that space when idle.
		*
		* The spinner stays mounted and is revealed by the row's `data-refreshing`
		* attribute: a transition needs the element to persist, and keeping the
		* motion on transform/opacity means the slide never reflows the row.
		*
		* Under the credit line sits the usage sub-title the session bridge feeds.
		* It appears only once a session has reported, so a page with no session
		* open — or a build with no session slots — keeps the single-line shape.
		* @param props - the seat's owner share (`wide`) plus this plugin's injected store and locale reader.
		* @returns the row.
		*/
		function QuotaRow({ wide, t, quotaStore }) {
			const state = React.useSyncExternalStore(quotaStore.subscribe, quotaStore.getSnapshot, quotaStore.getSnapshot);
			const ready = state.phase === "ready" && state.amount !== undefined;
			const spinning = state.userRefreshing === true;
			const description = describe(state, t);
			const value = ready
				? formatAmount(state.amount.total, state.amount.currency)
				: t(PHASE_TEXT[state.phase] ?? "loading");
			const bonus = ready && state.amount.bonus >= MIN_VISIBLE_AMOUNT
				? t("bonusSuffix", { amount: formatAmount(state.amount.bonus, state.amount.currency) })
				: undefined;
			const usage = state.sessionUsage;
			const usageTokens = usage === undefined ? 0 : billedTokens(usage);
			const usageLine = state.showUsage === true && usageTokens > 0
				? t("usageLine", { cost: formatCostRange(estimateCost(usage)) })
				: undefined;
			const refresh = () => {
				quotaStore.refreshNow();
			};
			if (!wide) {
				return React.createElement("button", {
					type: "button",
					className: classNames.rowRail,
					title: description,
					"aria-label": description,
					"data-phase": state.phase,
					"data-refreshing": spinning ? "true" : "false",
					onClick: refresh
				}, ringElement(34, 2, classNames.ringOverlay), React.createElement("span", { className: classNames.railValue }, ready ? formatDigits(state.amount.total) : t("label")));
			}
			return React.createElement("button", {
				type: "button",
				className: classNames.row,
				title: description,
				"aria-label": description,
				"data-phase": state.phase,
				"data-refreshing": spinning ? "true" : "false",
				onClick: refresh
			}, React.createElement("span", { className: classNames.main }, React.createElement("span", { className: classNames.label }, t("label")), React.createElement("span", { className: classNames.amount }, React.createElement("span", { className: classNames.value }, value), bonus !== undefined && React.createElement("span", { className: classNames.bonus }, bonus)), React.createElement("span", { className: classNames.spinner }, ringElement(14, 2, undefined))), usageLine !== undefined && React.createElement("span", { className: classNames.usage }, usageLine));
		}
		/**
		* Headless bridge from a session-scoped seat to the foot row.
		*
		* `sidebar.footer.action` is root-scoped, so it cannot read a session's
		* projections — `conversation.composer.dock` can. This component renders
		* nothing; it watches `tokenUsage` for the session in view and hands the
		* buckets to the store the row reads.
		*
		* The report runs in an effect rather than during render: the projection hands
		* back a fresh object on every change, and publishing during render would make
		* the notification a render-phase side effect.
		* @param props - the session's id and projection reader, plus this plugin's injected store.
		* @returns null — the seat stays visually untouched.
		*/
		function UsageBridge({ sessionId, useProjection, quotaStore }) {
			const usage = useProjection("tokenUsage");
			React.useEffect(() => {
				quotaStore.reportSessionUsage(sessionId, usage);
			});
			return null;
		}
		/**
		* The Settings → General row that turns the usage sub-title on or off.
		*
		* That seat passes no props and projects no label, so the row draws its own
		* copy and control and writes through its own inject face. The checkbox is a
		* real `input` — visually replaced by the track and knob — so it keeps native
		* keyboard and screen-reader behaviour.
		* @param props - this plugin's injected store and locale reader.
		* @returns the preference row.
		*/
		function UsagePreferenceRow({ t, quotaStore }) {
			const state = React.useSyncExternalStore(quotaStore.subscribe, quotaStore.getSnapshot, quotaStore.getSnapshot);
			const toggle = (event) => {
				quotaStore.setShowUsage(event.target.checked);
			};
			return React.createElement("div", { className: classNames.pref },
				React.createElement("div", { className: classNames.prefText },
					React.createElement("div", { className: classNames.prefTitle }, t("prefTitle")),
					React.createElement("div", { className: classNames.prefHint }, t("prefHint"))),
				React.createElement("label", { className: classNames.switch },
					React.createElement("input", {
						type: "checkbox",
						className: classNames.switchInput,
						checked: state.showUsage === true,
						"aria-label": t("prefTitle"),
						onChange: toggle
					}),
					React.createElement("span", { className: classNames.switchTrack, "aria-hidden": "true" }),
					React.createElement("span", { className: classNames.switchKnob, "aria-hidden": "true" })));
		}
		//#endregion

		//#region plugin
		/** Services this browser half needs before it activates. */
		const inject = ["slots", "locale", "remote"];
		/**
		* Reduce a thrown value to one short line for the mount trace.
		* @param error - whatever the step threw.
		* @returns the message text.
		*/
		function describeError(error) {
			if (error instanceof Error) return error.message;
			return String(error);
		}
		/**
		* Publish one mount failure where a maintainer can read it.
		*
		* A browser UI plugin must never take the page boot down: when the shell's
		* activation audit sees a failed fiber it aborts the whole boot, and on the
		* desktop that crash makes the launcher rewrite the profile. So this half
		* swallows its own mount error instead, logs it, and parks the trace in the
		* frame-wide overlay's occupant list — an invisible no-op entry whose id is
		* the trace, readable through the client Slot inspection.
		* @param ctx - the browser plugin context.
		* @param trace - the completed step trace, in order.
		*/
		function publishMountTrace(ctx, trace) {
			try {
				ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: "dsh-quota-usage-diag:" + trace.join(" | ").slice(0, 400),
					order: 1e3
				}, () => null));
			} catch {}
		}
		/**
		* Mount the sidebar-foot credit widget.
		*
		* Every step is isolated so a failure names itself in the trace instead of
		* failing the Cordis fiber, which the shell treats as a fatal boot error.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const trace = [];
			/**
			* Run one mount step, recording its outcome before anything can escape.
			* @param label - the step name that appears in the trace.
			* @param operation - the step itself.
			* @returns whatever the step returned.
			*/
			const step = (label, operation) => {
				try {
					const value = operation();
					trace.push(label + "=ok");
					return value;
				} catch (error) {
					trace.push(label + "=!" + describeError(error));
					throw error;
				}
			};
			try {
				const t = step("bind", () => ctx.locale.bind(NS));
				step("dict", () => {
					try {
						return ctx.effect(() => ctx.locale.register(NS, {
							zh,
							en
						}), "dsh-quota-usage: dictionaries");
					} catch (error) {
						// A second mount of the same page (the shell creates every boot
						// entry concurrently, and an HMR graph sync can mount again)
						// finds the namespace already registered; the dictionary the
						// first mount installed still serves this translator.
						if (!/already has locale/.test(describeError(error))) throw error;
						return undefined;
					}
				});
				const store = step("store", () => createBalanceStore(ctx));
				step("start", () => ctx.effect(() => {
					store.start();
					return () => store.dispose();
				}, "dsh-quota-usage: account balance reader"));
				step("mirror", () => ctx.effect(() => {
					// The frame-wide overlay is the only live surface this plugin can
					// publish into that a maintainer can read back through the client
					// Slot inspection, so while the row has no amount its phase is
					// mirrored there as a no-op entry id and withdrawn once it has one.
					let disposeMirror;
					const mirror = () => {
						try {
							disposeMirror?.();
						} catch {}
						disposeMirror = undefined;
						const phase = store.getSnapshot().phase;
						if (phase === "ready") return;
						disposeMirror = ctx.slots.inject("shell.overlay", () => ctx.slots.register({
							name: "shell.overlay",
							id: "dsh-quota-usage-state:" + phase,
							order: 1e3
						}, () => null));
					};
					mirror();
					const stop = store.subscribe(mirror);
					return () => {
						stop();
						try {
							disposeMirror?.();
						} catch {}
					};
				}, "dsh-quota-usage: state mirror"));
				step("seat", () => ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
					name: "sidebar.footer.action",
					id: "dsh-quota-usage",
					order: -10,
					locale: NS,
					label: () => t("label"),
					inject: () => ({ quotaStore: store })
				}, QuotaRow)));
				// The usage sub-title needs a session's projections, which only a
				// session-scoped seat can read. This seat is always mounted while a
				// session is open, and the registered component renders nothing.
				step("bridge", () => ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
					name: "conversation.composer.dock",
					id: "dsh-quota-usage-usage",
					order: 5,
					locale: NS,
					label: () => t("usageLabel"),
					inject: () => ({ quotaStore: store })
				}, UsageBridge)));
				// The on/off switch for that sub-title, next to the composer's own
				// performance-usage row (order 30).
				step("pref", () => ctx.slots.inject("settings.general.item", () => ctx.slots.register({
					name: "settings.general.item",
					id: "dsh-quota-usage-usage",
					order: 31,
					locale: NS,
					label: () => t("prefTitle"),
					inject: () => ({ quotaStore: store })
				}, UsagePreferenceRow)));
			} catch (error) {
				console.error("dsh-quota-usage: mount failed — " + trace.join(" | "), error);
				publishMountTrace(ctx, trace);
			}
		}
		//#endregion

		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
