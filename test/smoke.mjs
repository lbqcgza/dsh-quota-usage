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

/** Non-empty visible text of a stubbed element's direct children. */
function textsOf(node) {
	return (node.children ?? []).map(textOf).filter(Boolean);
}

const React = {
	createElement: (type, props, ...children) => ({
		type,
		props: props ?? {},
		children: children.flat().filter((child) => child !== null && child !== undefined && child !== false)
	}),
	useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
	// Present so a hook-using render still works here, even though the widget
	// currently reads the store without any local state of its own.
	useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
	useEffect: () => {}
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

assert.deepEqual(injected, ['shell.overlay', 'sidebar.footer.action'], 'the widget claims the sidebar-foot list seat');
assert.equal(registered.length, 2, 'the pre-read phase is mirrored in the frame-wide overlay');
assert.equal(registered[0].meta.id, 'dsh-quota-usage-state:loading');
const seat = registered.find((entry) => entry.meta.name === 'sidebar.footer.action');
assert.ok(seat, 'the sidebar-foot seat is registered');
const { meta, component } = seat;
assert.equal(meta.name, 'sidebar.footer.action');
assert.equal(meta.id, 'dsh-quota-usage');
assert.equal(meta.locale, mod.NS);
assert.equal(meta.label(), '额度');

const t = ctx.locale.bind(mod.NS);
const render = (wide) => component({ wide, t, ...meta.inject() });

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
	textsOf(ready),
	['额度', '¥13.34', '（赠¥1.00）'],
	'the ready row leads with the total credit and parenthesizes the bonus'
);
assert.match(ready.props.title, /^总余额 ¥13\.34 · 充值余额 ¥12\.34 · 赠金余额 ¥1\.00 · 更新于 .+ · 每 60 秒自动刷新 · 点击立即刷新$/);

/* ------------------------------------------- the spinner is absent until asked */

const idleSlot = ready.children[ready.children.length - 1];
assert.equal(idleSlot.type, 'span', 'the balance is trailed by the spinner slot');
assert.equal(idleSlot.props.className, 'dshQuota_ringSlot');
assert.deepEqual(idleSlot.children, [], 'the slot reserves its width but draws nothing on its own');
assert.ok(
	ready.children.every((child) => child.type !== 'svg'),
	'no ring is drawn before the user asks for a refresh'
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

const spinnerSlot = during.children[during.children.length - 1];
assert.equal(spinnerSlot.props.className, 'dshQuota_ringSlot', 'the spinner keeps the trailing slot');
const spinner = spinnerSlot.children[0];
assert.equal(spinner.type, 'svg', 'the spinner is drawn inside the trailing slot');
assert.match(spinner.props.className, /dshQuota_ringSpin/, 'the ring spins');
assert.equal(spinner.props.width, 14);
assert.equal(spinner.props['aria-hidden'], 'true');
assert.equal(spinner.children.length, 2, 'the spinner has a track and an arc');
const spinnerCircumference = 2 * Math.PI * (14 - 2) / 2;
assert.equal(spinner.children[1].props.strokeDasharray, spinnerCircumference);
assert.equal(spinner.children[1].props.strokeDashoffset, spinnerCircumference * 0.75, 'a quarter of the ring is drawn');

await clicked;
const settled = render(true);
assert.equal(settled.props['data-refreshing'], 'false', 'the spinner clears as soon as the read settles');
assert.ok(settled.children.every((child) => child.type !== 'svg' || child.props.width !== 14), 'no wide spinner remains');

/* -------------------------------------------- the click handler uses that path */

ready.props.onClick();
assert.equal(render(true).props['data-refreshing'], 'true', 'clicking the row starts a user-initiated refresh');
const joined = meta.inject().quotaStore.refresh();
assert.equal(render(true).props['data-refreshing'], 'true', 'an auto call joins the running read without clearing the indicator');
await joined;
assert.equal(render(true).props['data-refreshing'], 'false', 'the joined read clears the indicator when it settles');

/* ------------------------------------------------------ the rail spinner (rail) */

const rail = render(false);
assert.deepEqual(textsOf(rail), ['13.34'], 'the rail row drops the symbol and the label');
assert.equal(rail.props['data-refreshing'], 'false');
assert.equal(rail.children.length, 1, 'the idle rail row is only its digits');
assert.equal(rail.children[0].props.className, 'dshQuota_railValue');

const railClicked = meta.inject().quotaStore.refreshNow();
const railDuring = render(false);
assert.equal(railDuring.props['data-refreshing'], 'true');
assert.equal(railDuring.children[0].type, 'svg', 'the rail spinner wraps the button');
assert.equal(railDuring.children[0].props.width, 34);
assert.equal(railDuring.children[0].props.className, 'dshQuota_ringOverlay dshQuota_ring dshQuota_ringSpin');
assert.equal(railDuring.children[1].props.className, 'dshQuota_railValue', 'the digits sit above the ring');
await railClicked;
assert.equal(render(false).children.length, 1, 'the rail spinner clears with the read');

balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'CNY', balance: '0.004' }], bonusWallets: [] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(textsOf(render(true)), ['额度', '<¥0.01'], 'a positive sub-cent balance renders as <0.01');

balanceResult = { ok: true, value: { status: 'ready', value: [], bonusWallets: [{ currency: 'CNY', balance: '4.34' }] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(
	textsOf(render(true)),
	['额度', '¥4.34', '（赠¥4.34）'],
	'a bonus-only wallet still totals correctly and keeps the parenthesized bonus'
);
const bonusCell = render(true).children.find((child) => child.props?.className === 'dshQuota_bonus');
assert.ok(bonusCell, 'the bonus keeps its own accent cell');

balanceResult = { ok: true, value: null };
await meta.inject().quotaStore.refresh();
assert.deepEqual(textsOf(render(true)), ['额度', '未登录'], 'a signed-out account names its state instead of vanishing');

balanceResult = { ok: false, value: undefined };
await meta.inject().quotaStore.refresh();
assert.deepEqual(textsOf(render(true)), ['额度', '读取失败'], 'a Remote failure renders the retry copy');

balanceCalls.length = 0;
balanceResult = { ok: true, value: { status: 'ready', value: [{ currency: 'USD', balance: '3.5' }], bonusWallets: [] } };
await meta.inject().quotaStore.refresh();
assert.deepEqual(textsOf(render(true)), ['额度', '$3.50'], 'a USD wallet renders with the dollar sign and no bonus');

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