/**
 * dsh-quota-usage — offline smoke test.
 *
 * Runs the shipped browser bundle against the smallest stubs that stand in for
 * the DSH web client: the module loader, React's element factory and
 * `useSyncExternalStore`, the DOM bits the bundle touches, and a fake Cordis
 * browser context. It asserts the seat that is claimed, the props the seat is
 * given, and the text the row renders for each account Remote outcome.
 *
 * `node test/smoke.mjs`
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

/* ------------------------------------------------------------------ stubs */

/** Flatten a stubbed element tree into its visible text. */
function textOf(node) {
	if (node === null || node === undefined || node === false || node === true) return '';
	if (typeof node === 'string' || typeof node === 'number') return String(node);
	if (Array.isArray(node)) return node.map(textOf).join('');
	return (node.children ?? []).map(textOf).join('');
}

/** Every visible leaf string in a stubbed tree, in document order. */
function leafTexts(node) {
	const out = [];
	const visit = (n) => {
		if (n === null || n === undefined || n === false || n === true) return;
		if (typeof n === 'string' || typeof n === 'number') { out.push(String(n)); return; }
		if (Array.isArray(n)) { n.forEach(visit); return; }
		(n.children ?? []).forEach(visit);
	};
	visit(node.children ?? []);
	return out;
}

/** Depth-first search for the first element carrying one class name. */
function findByClass(node, className) {
	if (node === null || node === undefined || typeof node !== 'object') return undefined;
	if (typeof node.props?.className === 'string' && node.props.className.split(' ').includes(className)) return node;
	for (const child of node.children ?? []) {
		const hit = findByClass(child, className);
		if (hit !== undefined) return hit;
	}
	return undefined;
}

/** Depth-first search for the first element of one type. */
function findByType(node, type) {
	if (node === null || node === undefined || typeof node !== 'object') return undefined;
	if (node.type === type) return node;
	for (const child of node.children ?? []) {
		const hit = findByType(child, type);
		if (hit !== undefined) return hit;
	}
	return undefined;
}

const React = {
	createElement: (type, props, ...children) => ({
		type,
		props: props ?? {},
		children: children.flat().filter((child) => child !== null && child !== undefined && child !== false)
	}),
	useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
	useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
	// The bridge hands its reading over from an effect, so the stub has to run
	// effects for the usage sub-title to reach the store at all.
	useEffect: (callback) => {
		callback();
	}
};

const styleTags = [];
const documentStub = {
	querySelector: () => null,
	createElement: () => ({ dataset: {}, textContent: '' }),
	head: { appendChild: (tag) => styleTags.push(tag) },
	addEventListener: () => {},
	removeEventListener: () => {},
	visibilityState: 'visible'
};

const timers = [];
const setIntervalStub = (callback, delay) => {
	timers.push({ callback, delay });
	return timers.length;
};
const clearIntervalStub = () => {};

/* ------------------------------------------------------- bundle materialization */

let entry;
const windowStub = {
	__ModuleLoader__: {
		load: (registration) => {
			entry = registration;
		}
	},
	addEventListener: () => {},
	removeEventListener: () => {}
};

new Function('window', 'document', 'setInterval', 'clearInterval', source)(
	windowStub,
	documentStub,
	setIntervalStub,
	clearIntervalStub
);

assert.equal(entry.id, 'dsh-quota-usage', 'the bundle registers under its package name');
const mod = entry.factory((request) => {
	if (request === 'react') return React;
	throw new Error(`unexpected require in the bundle: ${request}`);
});
assert.equal(mod.NS, 'quota.usage');
assert.deepEqual(mod.inject, ['slots', 'locale', 'remote']);
assert.equal(typeof mod.apply, 'function');
assert.equal(styleTags.length, 1, 'the bundle injects its stylesheet once');
assert.doesNotMatch(
	styleTags[0].textContent,
	/state-success/,
	'the bonus annotation carries no success-green accent'
);
assert.match(
	styleTags[0].textContent,
	/\.dshQuota_bonus\{[^}]*color:var\(--dsw-alias-label-primary\)/,
	'the bonus annotation is coloured like the total balance'
);

/* -------------------------------------------------------------- fake Cordis ctx */

const dictionaries = {};
const injected = [];
const registered = [];
const balanceCalls = [];
/** Swap this to drive each account Remote outcome. */
let balanceResult = {
	ok: true,
	value: { status: 'ready', value: [{ currency: 'CNY', balance: '12.34' }], bonusWallets: [{ currency: 'CNY', balance: '1.00' }] }
};

const ctx = {
	locale: {
		bind: (ns) => (key, params) => {
			const template = dictionaries[ns]?.zh?.[key] ?? key;
			if (!params) return template;
			return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
		},
		register: (ns, value) => {
			dictionaries[ns] = value;
			return () => {};
		},
		getSnapshot: () => ({ active: 'zh' })
	},
	effect: (callback) => {
		callback();
		return () => {};
	},
	on: () => () => {},
	slots: {
		inject: (name, callback) => {
			injected.push(name);
			callback();
			return () => {};
		},
		register: (meta, component) => {
			registered.push({ meta, component });
			return () => {};
		}
	},
	remote: {
		account: {
			getBalance: async (metadata) => {
				balanceCalls.push(metadata);
				return balanceResult;
			}
		},
		// Deliberately absent: the store must survive a build without the stream.
		$stream: undefined
	}
};

mod.apply(ctx);

/* -------------------------------------------------------------- the claimed seat */

assert.deepEqual(injected, ['shell.overlay', 'sidebar.footer.action', 'conversation.composer.dock'], 'the widget claims the foot seat and the session bridge seat');
assert.equal(registered.length, 3, 'the pre-read phase is mirrored, the seat claimed, and the bridge mounted');
assert.equal(registered[0].meta.id, 'dsh-quota-usage-state:loading');
const seat = registered.find((entry) => entry.meta.name === 'sidebar.footer.action');
assert.ok(seat, 'the sidebar-foot seat is registered');
const { meta, component } = seat;
assert.equal(meta.name, 'sidebar.footer.action');
assert.equal(meta.id, 'dsh-quota-usage');
assert.equal(meta.locale, mod.NS);
assert.equal(meta.label(), '额度');

const bridge = registered.find((entry) => entry.meta.name === 'conversation.composer.dock');
assert.ok(bridge, 'the session-scoped usage bridge is registered too');
assert.equal(bridge.meta.id, 'dsh-quota-usage-usage');
assert.equal(bridge.meta.order, 5);
assert.equal(typeof bridge.component, 'function');

const t = ctx.locale.bind(mod.NS);
const render = (wide) => component({ wide, t, ...meta.inject() });
/**
 * Render the bridge for one session fixture, which reports into the same store
 * the foot row reads — exactly what the real slot wiring does.
 */
const reportUsage = (sessionId, usage) => bridge.component({
	sessionId,
	useProjection: (key) => (key === 'tokenUsage' ? usage : undefined),
	...bridge.meta.inject()
});

/* -------------------------------------------------------------- rendered states */

await Promise.resolve();
await Promise.resolve();

assert.equal(balanceCalls.length, 1);
assert.deepEqual(balanceCalls[0], { version: '0.2.0-rc.2', locale: 'zh', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 });
assert.equal(timers.length, 2, 'the store re-arms its poll once the first read settles');
assert.equal(timers[0].delay, 5_000, 'the pre-read cadence retries quickly for a late namespace');
assert.equal(timers[1].delay, 60_000, 'the settled cadence is the steady one');

const ready = render(true);
assert.equal(ready.type, 'button');
assert.equal(ready.props['data-refreshing'], 'false');
assert.deepEqual(
	leafTexts(ready),
	['额度', '¥13.34', '（赠¥1.00）'],
	'the ready row leads with the total credit and parenthesizes the bonus'
);
assert.match(ready.props.title, /^总余额 ¥13\.34 · 充值余额 ¥12\.34 · 赠金余额 ¥1\.00 · 更新于 .+ · 每 60 秒自动刷新 · 点击立即刷新$/);

/* ------------------------------------ the amount owns the right edge while idle */

assert.equal(ready.children.length, 1, 'with no session report the row is a single credit line');
const main = ready.children[0];
assert.equal(main.props.className, 'dshQuota_main');
const [label, amount, spinner] = main.children;
assert.equal(label.props.className, 'dshQuota_label');
assert.equal(amount.props.className, 'dshQuota_amount', 'value and bonus travel together in one group');
assert.equal(amount.children[0].props.className, 'dshQuota_value');
assert.equal(amount.children[1].props.className, 'dshQuota_bonus');
assert.equal(spinner.props.className, 'dshQuota_spinner', 'the spinner trails the amount');
assert.equal(main.children.length, 3, 'the spinner adds no fourth flex item of its own');
assert.equal(spinner.props.className.includes('ringSlot'), false);

const sheet = styleTags[0].textContent;
assert.match(
	sheet,
	/\.dshQuota_amount\{[^}]*margin-left:auto/,
	'the amount is pinned to the right edge, so an idle row reserves no spinner space'
);
assert.match(
	sheet,
	/\.dshQuota_spinner\{[^}]*position:absolute[^}]*opacity:0/,
	'the idle spinner is out of flow and invisible'
);
assert.match(
	sheet,
	/\.dshQuota_spinner\{[^}]*transition:opacity[^}]*var\(--dsh-quota-ease\)/,
	'the spinner reveals on an eased transition'
);

/* ----------------------------------------------------- the eased slide contract */

assert.match(
	sheet,
	/--dsh-quota-ease:cubic-bezier\(/,
	'the motion curve is non-linear, not linear or ease'
);
assert.doesNotMatch(sheet, /transition:[^;}]*\bl(?:inear)\b/, 'no transition falls back to a linear curve');
assert.match(
	sheet,
	/\.dshQuota_amount\{[^}]*transition:transform var\(--dsh-quota-slide\) var\(--dsh-quota-ease\)/,
	'the amount slides on that same curve'
);
assert.match(
	sheet,
	/\.dshQuota_row\[data-refreshing=true\] \.dshQuota_amount\{transform:translateX\(calc\(-1 \* \(var\(--dsh-quota-spinner\) \+ var\(--dsh-quota-gap\)\)\)\)\}/,
	'the slide gives up exactly the spinner box plus one gap'
);
assert.match(
	sheet,
	/\.dshQuota_row\[data-refreshing=true\] \.dshQuota_spinner\{opacity:1;transform:scale\(1\)\}/,
	'the spinner reveals when the row reports a user-initiated refresh'
);
assert.match(
	sheet,
	/@media \(prefers-reduced-motion:reduce\)\{\.dshQuota_ringSpin\{animation:none\}\.dshQuota_amount,\.dshQuota_spinner,\.dshQuota_ringOverlay\{transition:none\}\}/,
	'reduced motion drops the spin and the slide'
);

/* ------------------------------------------------ background polling shows none */

const polled = meta.inject().quotaStore.refresh();
assert.equal(render(true).props['data-refreshing'], 'false', 'an automatic poll does not raise the indicator');
await polled;
assert.equal(render(true).props['data-refreshing'], 'false', 'and it stays down once the poll settles');

/* ---------------------------------------- a click shows the spinner while it runs */

const clicked = meta.inject().quotaStore.refreshNow();
const during = render(true);
assert.equal(during.props['data-refreshing'], 'true', 'the row reports the user-initiated refresh');
assert.match(during.props.title, /正在刷新… · 点击立即刷新$/, 'the tooltip names the in-flight refresh');

const ring = findByClass(during, 'dshQuota_spinner').children[0];
assert.equal(ring.type, 'svg', 'the spinner ring is mounted inside the spinner box');
assert.match(ring.props.className, /dshQuota_ringSpin/, 'the ring carries the spin hook');
assert.equal(ring.props.width, 14);
assert.equal(ring.props['aria-hidden'], 'true');
assert.equal(ring.children.length, 2, 'the spinner has a track and an arc');
const spinnerCircumference = 2 * Math.PI * (14 - 2) / 2;
assert.equal(ring.children[1].props.strokeDasharray, spinnerCircumference);
assert.equal(ring.children[1].props.strokeDashoffset, spinnerCircumference * 0.75, 'a quarter of the ring is drawn');
assert.match(
	sheet,
	/\.dshQuota_row\[data-refreshing=true\] \.dshQuota_ringSpin,\.dshQuota_rowRail\[data-refreshing=true\] \.dshQuota_ringSpin\{animation:dshQuota_spin/,
	'the spin only runs while the indicator is up'
);

await clicked;
const settled = render(true);
assert.equal(settled.props['data-refreshing'], 'false', 'the spinner clears as soon as the read settles');
assert.deepEqual(leafTexts(settled), ['额度', '¥13.34', '（赠¥1.00）'], 'the amount is back without the spinner');

/* -------------------------------------------- the click handler uses that path */

ready.props.onClick();
assert.equal(render(true).props['data-refreshing'], 'true', 'clicking the row starts a user-initiated refresh');
const joined = meta.inject().quotaStore.refresh();
assert.equal(render(true).props['data-refreshing'], 'true', 'an auto call joins the running read without clearing the indicator');
await joined;
assert.equal(render(true).props['data-refreshing'], 'false', 'the joined read clears the indicator when it settles');

/* ------------------------------------------------------ the rail spinner (rail) */

const rail = render(false);
assert.deepEqual(leafTexts(rail), ['13.34'], 'the rail row drops the symbol and the label');
assert.equal(rail.props['data-refreshing'], 'false');
assert.equal(rail.children.length, 2, 'the rail row keeps its overlay ring mounted plus the digits');
assert.equal(rail.children[0].props.className, 'dshQuota_ringOverlay dshQuota_ring dshQuota_ringSpin');
assert.equal(rail.children[1].props.className, 'dshQuota_railValue', 'the digits sit above the ring');

const railClicked = meta.inject().quotaStore.refreshNow();
const railDuring = render(false);
assert.equal(railDuring.props['data-refreshing'], 'true');
assert.equal(railDuring.children[0].type, 'svg', 'the rail spinner wraps the button');
assert.equal(railDuring.children[0].props.width, 34);
assert.equal(railDuring.children[0].props.className, 'dshQuota_ringOverlay dshQuota_ring dshQuota_ringSpin');
assert.equal(railDuring.children[1].props.className, 'dshQuota_railValue', 'the digits sit above the ring');
await railClicked;
const railSettled = render(false);
assert.equal(railSettled.props['data-refreshing'], 'false', 'the rail spinner clears with the read');
assert.equal(railSettled.children.length, 2, 'the ring stays mounted so its fade-out can animate');
assert.match(
	sheet,
	/\.dshQuota_rowRail\[data-refreshing=true\] \.dshQuota_ringOverlay\{opacity:1;transform:scale\(1\)\}/,
	'the rail ring is revealed by the same attribute'
);

balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '0.004' }], bonusWallets: [] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(leafTexts(render(true)), ['额度', '<¥0.01'], 'a positive sub-cent balance renders as <0.01');

balanceResult = { ok: true, value: { status: 'ready', value: [], bonusWallets: [{ currency: 'CNY', balance: '4.34' }] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(
	leafTexts(render(true)),
	['额度', '¥4.34', '（赠¥4.34）'],
	'a bonus-only wallet still totals correctly and keeps the parenthesized bonus'
);
const bonusCell = findByClass(render(true), 'dshQuota_bonus');
assert.ok(bonusCell, 'the bonus keeps its own accent cell inside the amount group');

/* ------------------------------------- the bonus bracket hides below one cent */

balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '12.34' }], bonusWallets: [{ currency: 'CNY', balance: '0.004' }] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(
	leafTexts(render(true)),
	['额度', '¥12.34'],
	'a drained sub-cent bonus draws no bracket at all'
);
assert.equal(
	findByClass(render(true), 'dshQuota_bonus'),
	undefined,
	'there is no bonus cell to style or space'
);
assert.doesNotMatch(render(true).props.title, /赠金余额/, 'the tooltip drops the empty bonus row too');

balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '12.34' }], bonusWallets: [{ currency: 'CNY', balance: '0.01' }] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(
	leafTexts(render(true)),
	['额度', '¥12.35', '（赠¥0.01）'],
	'one cent is the first bonus worth showing'
);
assert.match(render(true).props.title, /赠金余额 ¥0\.01/, 'and it appears in the tooltip');

balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '12.34' }], bonusWallets: [] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(leafTexts(render(true)), ['额度', '¥12.34'], 'no bonus wallet means no bonus bracket');

balanceResult = { ok: true, value: null };
await meta.inject().quotaStore.refresh();
assert.deepEqual(leafTexts(render(true)), ['额度', '未登录'], 'a signed-out account names its state instead of vanishing');

balanceResult = { ok: false, value: undefined };
await meta.inject().quotaStore.refresh();
assert.deepEqual(leafTexts(render(true)), ['额度', '读取失败'], 'a Remote failure renders the retry copy');

balanceCalls.length = 0;
balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'USD', balance: '3.5' }], bonusWallets: [] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(leafTexts(render(true)), ['额度', '$3.50'], 'a USD wallet renders with the dollar sign and no bonus');

/* --------------------------------- the usage sub-title fed by the session bridge */

// Back to a plain CNY credit so the usage assertions below read on their own.
balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '12.34' }], bonusWallets: [] } };
await meta.inject().quotaStore.refresh();
assert.equal(render(true).children.length, 1, 'no sub-title before any session reports');

// 7M tokens split across all three prompt-side buckets plus output, chosen so the
// Flash price list produces exact figures: off-peak 1.00 + 0.10 + 4.00, peak 2x.
const usageFixture = {
	uncachedInputTokens: 1_000_000,
	cacheReadTokens: 5_000_000,
	cacheWriteTokens: 0,
	outputTokens: 1_000_000
};
reportUsage('session-fixture', usageFixture);
const withUsage = render(true);
assert.equal(withUsage.children.length, 2, 'a report adds the sub-title line under the credit line');
assert.equal(withUsage.children[0].props.className, 'dshQuota_main', 'the credit line stays first');
assert.equal(withUsage.children[1].props.className, 'dshQuota_usage');
assert.deepEqual(
	leafTexts(withUsage),
	['额度', '¥12.34', '本会话 7M tokens · 约 ¥5.10–10.20'],
	'the sub-title compacts the tokens and pairs the off-peak and peak estimates'
);

let notifications = 0;
const stopWatching = meta.inject().quotaStore.subscribe(() => {
	notifications = notifications + 1;
});
reportUsage('session-fixture', { ...usageFixture });
assert.equal(notifications, 0, 'an identical report does not republish, so the row does not re-render for nothing');
reportUsage('session-fixture', { ...usageFixture, outputTokens: 1_000_100 });
assert.equal(notifications, 1, 'a changed report publishes exactly once');
stopWatching();

// Cache writes have no column of their own in the official list; they are priced
// as cache-miss input, which is the prompt-side grouping DSH uses.
reportUsage('session-fixture', { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 1_000_000, outputTokens: 0 });
assert.deepEqual(
	leafTexts(render(true)),
	['额度', '¥12.34', '本会话 1M tokens · 约 ¥1.00–2.00'],
	'a cache write is billed at the miss rate'
);

reportUsage('session-fixture', { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 100 });
assert.deepEqual(
	leafTexts(render(true)),
	['额度', '¥12.34', '本会话 100 tokens · 约 ¥<0.01'],
	'a sub-cent estimate collapses to a single <0.01 figure'
);

reportUsage('session-fixture', { uncachedInputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 });
assert.equal(render(true).children.length, 1, 'a session with no tokens yet keeps the single-line shape');

reportUsage('session-fixture', undefined);
assert.equal(render(true).children.length, 1, 'a withdrawn report drops the sub-title again');

/* ------------------------------------------- a failed mount stays inert + traceable */

const diagInjections = [];
const diagRegistered = [];
const failingCtx = {
	...ctx,
	slots: {
		inject: (name, callback) => {
			diagInjections.push(name);
			if (name === 'sidebar.footer.action') throw new Error('declaration is missing');
			callback();
			return () => {};
		},
		register: (meta) => {
			diagRegistered.push(meta);
			return () => {};
		}
	}
};

const realError = console.error;
console.error = () => {};
try {
	mod.apply(failingCtx);
} finally {
	console.error = realError;
}

assert.deepEqual(diagInjections, ['shell.overlay', 'sidebar.footer.action', 'shell.overlay'], 'a failed mount parks its trace in the frame-wide overlay seat');
assert.equal(diagRegistered.length, 2, 'the phase mirror plus the trace entry');
assert.match(
	diagRegistered[1].id,
	/^dsh-quota-usage-diag:bind=ok \| dict=ok \| store=ok \| start=ok \| mirror=ok \| seat=!declaration is missing$/,
	'the trace names the failing step and its error'
);

/* ---------------------------------------- a re-mount tolerates an existing dictionary */

const remountRegistered = [];
const remountCtx = {
	...ctx,
	locale: {
		...ctx.locale,
		register: () => {
			throw new Error('locale namespace "quota.usage" already has locale "zh"');
		}
	},
	slots: {
		inject: (name, callback) => {
			callback();
			return () => {};
		},
		register: (meta) => {
			remountRegistered.push(meta);
			return () => {};
		}
	}
};

mod.apply(remountCtx);

assert.ok(
	remountRegistered.some((meta) => meta.id === 'dsh-quota-usage'),
	'a second mount still claims the seat when the dictionary already exists'
);

console.log('dsh-quota-usage: smoke test passed');