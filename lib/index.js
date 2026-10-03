/**
 * dsh-quota-usage — node half.
 *
 * Pure UI plugin: the browser half (`./lib/client.js`, discovered through the
 * package.json `dsh.client` declaration) owns everything the user sees. This
 * empty `apply` exists only so the package holds a Loader entry, which is what
 * dsh's client-modules scanner walks to compose the web boot graph.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
function apply() {}

export { apply };
